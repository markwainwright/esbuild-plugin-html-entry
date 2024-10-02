import { readFile } from "node:fs/promises";
import { dirname, relative } from "node:path";

import type { BuildOptions, Message, Plugin } from "esbuild";
import { minify, type Options as MinifyOptions } from "html-minifier-terser";

import { build, type BuildResult } from "./build.js";
import { createDeferred, Deferred } from "./deferred.js";
import { findElements, getHref, insertLinkElement, setAttributes } from "./dom.js";
import { getIntegrity } from "./integrity.js";
import { getPublicPath, getPublicPathContext } from "./public-paths.js";
import { augmentMetafile, augmentOutputFiles, type HtmlResult, type Results } from "./results.js";
import { getWorkingDirAbs } from "./working-dir.js";

export interface EsbuildPluginHtmlEntryOptions {
  subresourceNames?: string;
  integrity?: string;
  minifyOptions?: MinifyOptions;
  banner?: string;
  footer?: string;
}

type Format = "esm" | "iife";
type BuildInput = Record<Format, Set<string>>;
type BuildOutput = Record<Format, BuildResult>;
interface State {
  buildInput: BuildInput;
  deferredBuildOutput: Deferred<BuildOutput>;
  results: Results;
}

function createState(): State {
  return {
    results: {
      htmlEntryPoints: new Map(),
      inputs: {},
      outputs: {},
      outputFiles: new Map(),
    },
    buildInput: {
      esm: new Set(),
      iife: new Set(),
    },
    deferredBuildOutput: createDeferred<BuildOutput>(),
  };
}

async function buildAssets(
  buildOptions: BuildOptions,
  pluginOptions: EsbuildPluginHtmlEntryOptions,
  buildInput: BuildInput
): Promise<BuildOutput> {
  const assetNames = pluginOptions.subresourceNames ?? buildOptions.assetNames;
  const [esm, iife] = await Promise.all([
    build({ ...buildOptions, format: "esm" }, assetNames, [...buildInput.esm]),
    build({ ...buildOptions, format: "iife", splitting: false }, assetNames, [...buildInput.iife]),
  ]);

  return { esm, iife };
}

export function esbuildPluginHtmlEntry(pluginOptions: EsbuildPluginHtmlEntryOptions = {}): Plugin {
  return {
    name: "html-entry",

    setup(build) {
      const buildOptions = build.initialOptions;

      if (buildOptions.publicPath && !buildOptions.outdir) {
        // see getPublicPathContext
        throw new Error("must provide outdir if publicPath is set");
      }

      const workingDirAbs = getWorkingDirAbs(buildOptions);

      const metafileOriginallyEnabled = !!buildOptions.metafile;
      buildOptions.metafile = true;

      // TODO: Cover all entryPoints types
      const entryPointCount = Array.isArray(buildOptions.entryPoints)
        ? buildOptions.entryPoints.filter(e => typeof e === "string" && e.endsWith(".html")).length
        : 1;

      let state = createState();

      build.onLoad({ filter: /\.html?$/ }, async args => {
        const { buildInput, deferredBuildOutput, results } = state;

        const htmlPathAbs = args.path;
        const htmlPathRel = relative(workingDirAbs, htmlPathAbs);
        const htmlDirAbs = dirname(htmlPathAbs);

        const htmlContents = await readFile(htmlPathAbs);
        const htmlContentsString = htmlContents.toString("utf-8");

        const [$, elements] = findElements(htmlContentsString);

        const htmlResult: HtmlResult = {
          imports: new Map(),
          inputBytes: htmlContents.byteLength,
        };

        const errors: Message[] = [];
        const warnings: Message[] = [];
        const watchFiles = new Set<string>();

        const resolveOptions = {
          kind: "import-statement" as const,
          importer: htmlPathAbs,
          resolveDir: htmlDirAbs,
        };

        const assets = (
          await Promise.all(
            elements.map(async element => {
              const assetHref = getHref($, element);
              const resolveResult = await build.resolve(assetHref, resolveOptions);

              if (resolveResult.external) {
                return null;
              }

              if (resolveResult.errors.length) {
                errors.push(...resolveResult.errors);
                return null;
              }

              if (resolveResult.warnings.length) {
                warnings.push(...resolveResult.warnings);
              }

              const assetPathRel = relative(workingDirAbs, resolveResult.path);

              return { assetPathRel, assetHref, element };
            })
          )
        ).filter(asset => asset !== null);

        assets.forEach(({ assetPathRel, assetHref, element }) => {
          htmlResult.imports.set(assetPathRel, assetHref);
          buildInput[element.format].add(assetPathRel);
        });

        results.htmlEntryPoints.set(htmlPathRel, htmlResult);

        if (results.htmlEntryPoints.size === entryPointCount) {
          const o = await buildAssets(buildOptions, pluginOptions, buildInput);
          deferredBuildOutput.resolve(o);
        }

        const [buildOutput, publicPathContext] = await Promise.all([
          deferredBuildOutput, // TODO: timeout
          getPublicPathContext(htmlPathAbs, buildOptions),
        ]);

        await Promise.all(
          assets.map(async ({ element, assetPathRel }) => {
            const output = buildOutput[element.format].get(assetPathRel);

            if (!output) {
              throw new Error(`Missing build output for ${element.format} ${assetPathRel}`);
            }

            const { mainOutputPathAbs, cssOutputPathAbs, outputFiles, outputs, inputs } = output;

            output.watchFiles.forEach(watchFile => watchFiles.add(watchFile));

            outputFiles?.forEach(({ path, ...outputFile }) =>
              results.outputFiles.set(path, outputFile)
            );

            Object.assign(results.outputs, outputs);
            Object.assign(results.inputs, inputs);

            setAttributes(
              $,
              element,
              getPublicPath(publicPathContext, mainOutputPathAbs),
              await getIntegrity(pluginOptions.integrity, mainOutputPathAbs, outputFiles)
            );

            if (cssOutputPathAbs) {
              setAttributes(
                $,
                insertLinkElement($, element.element),
                getPublicPath(publicPathContext, cssOutputPathAbs),
                await getIntegrity(pluginOptions.integrity, cssOutputPathAbs, outputFiles)
              );
            }
          })
        );

        const html = $.html();
        let contents = buildOptions.minify
          ? await minify(html, {
              maxLineLength: buildOptions.lineLimit ?? undefined,
              ...pluginOptions.minifyOptions,
            })
          : html;

        if (pluginOptions.banner) {
          contents = `${pluginOptions.banner}\n${contents}`;
        }
        if (pluginOptions.footer) {
          contents += `\n${pluginOptions.footer}`;
        }

        return {
          contents,
          loader: "copy",
          resolveDir: dirname(htmlPathAbs),
          errors,
          warnings,
          watchFiles: [...watchFiles],
        };
      });

      build.onEnd(result => {
        const { results } = state;

        result.outputFiles = result.outputFiles
          ? augmentOutputFiles(result.outputFiles, results.outputFiles)
          : undefined;

        result.metafile =
          metafileOriginallyEnabled && result.metafile
            ? augmentMetafile(result.metafile, results)
            : undefined;

        state = createState();
      });
    },
  };
}
