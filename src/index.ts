import { readFile } from "node:fs/promises";
import { dirname, relative } from "node:path";

import type { BuildOptions, Message, Metafile, Plugin } from "esbuild";
import { minify, type Options as MinifyOptions } from "html-minifier-terser";

import { build, type BuildResult } from "./build.js";
import { createDeferred, type Deferred } from "./deferred.js";
import { findElements, getHref, getHtml, insertLinkElement, setAttributes } from "./dom.js";
import { getIntegrity } from "./integrity.js";
import { NAMESPACE } from "./namespace.js";
import { getPublicPath, getPublicPathContext } from "./public-paths.js";
import { augmentMetafile, augmentOutputFiles, type HtmlEntryPointMetadata } from "./results.js";
import { timeout } from "./timeout.js";
import { getWorkingDirAbs } from "./working-dir.js";

const KIND = "import-statement";

export interface EsbuildPluginHtmlEntryOptions {
  readonly subresourceNames?: string;
  readonly integrity?: string;
  readonly minifyOptions?: MinifyOptions;
  readonly banner?: string;
  readonly footer?: string;
}

type Format = "esm" | "iife";
/** Relative paths of subresources to build, for ESM and IIFE */
type SubBuildInput = Record<Format, Set<string>>;
type SubBuildOutput = Record<Format, BuildResult>;

/** Creates state object for the lifecycle of a single build (multiple HTML files) */
function createBuildState(): {
  readonly htmlEntryPointPaths: Set<string>;
  readonly subBuildInput: SubBuildInput;
  readonly deferredSubBuildOutput: Deferred<SubBuildOutput>;
  readonly htmlEntryPointMetadata: HtmlEntryPointMetadata;
} {
  return {
    htmlEntryPointPaths: new Set(),
    subBuildInput: {
      esm: new Set(),
      iife: new Set(),
    },
    deferredSubBuildOutput: createDeferred(),
    htmlEntryPointMetadata: new Map(),
  };
}

/** Creates state object for the lifecycle of a single `onLoad` call (single HTML file) */
function createLoadState(): {
  readonly errors: Message[];
  readonly warnings: Message[];
  readonly watchFiles: Set<string>;
  /** Map of resolved entry point path to original import href */
  readonly imports: Metafile["inputs"][string]["imports"];
} {
  return {
    errors: [],
    warnings: [],
    watchFiles: new Set(),
    imports: [],
  };
}

async function runSubBuild(
  buildOptions: BuildOptions,
  pluginOptions: EsbuildPluginHtmlEntryOptions,
  input: SubBuildInput
): Promise<SubBuildOutput> {
  const entryNames = pluginOptions.subresourceNames ?? buildOptions.assetNames;

  const [esm, iife] = await Promise.all([
    build({ ...buildOptions, entryNames, format: "esm" }, [...input.esm]),
    build({ ...buildOptions, entryNames, format: "iife", splitting: false }, [...input.iife]),
  ]);

  return { esm, iife };
}

async function buildOutputHtml(
  buildOptions: BuildOptions,
  pluginOptions: EsbuildPluginHtmlEntryOptions,
  html: string
) {
  let outputHtml;

  if (buildOptions.minify) {
    outputHtml = await minify(html, {
      maxLineLength: buildOptions.lineLimit ?? undefined,
      ...(pluginOptions.minifyOptions ?? { collapseWhitespace: true }),
    });
  } else if (buildOptions.lineLimit) {
    outputHtml = await minify(html, { maxLineLength: buildOptions.lineLimit });
  } else {
    outputHtml = html;
  }

  if (pluginOptions.banner) {
    outputHtml = `${pluginOptions.banner}\n${outputHtml}`;
  }
  if (pluginOptions.footer) {
    outputHtml = `${outputHtml}\n${pluginOptions.footer}`;
  }

  return outputHtml;
}

export function esbuildPluginHtmlEntry(pluginOptions: EsbuildPluginHtmlEntryOptions = {}): Plugin {
  return {
    name: "html-entry",

    setup(build) {
      const buildOptions = build.initialOptions;
      if (!buildOptions.outdir) {
        throw new Error("Must provide outdir");
      }

      let buildState = createBuildState();
      const workingDirAbs = getWorkingDirAbs(buildOptions);

      build.onResolve({ filter: /\.html?$/ }, async ({ path, ...args }) => {
        if (args.kind !== "entry-point" || args.namespace === NAMESPACE) {
          return;
        }

        const resolveResult = await build.resolve(path, { ...args, namespace: NAMESPACE });

        buildState.htmlEntryPointPaths.add(resolveResult.path);

        return { ...resolveResult, namespace: NAMESPACE };
      });

      build.onLoad({ namespace: NAMESPACE, filter: /\.html?$/ }, async args => {
        const {
          htmlEntryPointPaths,
          subBuildInput,
          deferredSubBuildOutput,
          htmlEntryPointMetadata,
        } = buildState;

        const htmlPathAbs = args.path;
        const htmlContentBuffer = await readFile(htmlPathAbs);
        const htmlContentString = htmlContentBuffer.toString("utf-8");
        const htmlDirAbs = dirname(htmlPathAbs);

        const [$, elements] = findElements(htmlContentString, buildOptions.charset);

        const loadState = createLoadState();
        const resolveOptions = {
          kind: KIND,
          importer: htmlPathAbs,
          resolveDir: htmlDirAbs,
        } as const;

        const subresources = (
          await Promise.all(
            elements.map(async element => {
              const href = getHref($, element);
              const {
                path: pathAbs,
                external,
                errors,
                warnings,
              } = await build.resolve(href, resolveOptions);

              if (errors.length) {
                loadState.errors.push(...errors);
                return null;
              }

              if (warnings.length) {
                loadState.warnings.push(...warnings);
              }

              return { pathRel: relative(workingDirAbs, pathAbs), href, element, external };
            })
          )
        ).filter(subresource => subresource !== null);

        subresources.forEach(({ pathRel, href, element, external }) => {
          loadState.imports.push(
            external
              ? { path: href, kind: KIND, external: true }
              : { path: pathRel, kind: KIND, original: href }
          );
          if (!external) {
            subBuildInput[element.format].add(pathRel);
          }
        });

        htmlEntryPointMetadata.set(htmlPathAbs, {
          imports: loadState.imports,
          inputBytes: htmlContentBuffer.byteLength,
        });
        if (htmlEntryPointMetadata.size === htmlEntryPointPaths.size) {
          // This is the last HTML entry point, so run the sub-build
          deferredSubBuildOutput.resolve(runSubBuild(buildOptions, pluginOptions, subBuildInput));
        }

        // Wait for the sub-build triggered by the last HTML entry point to complete
        const [subBuildOutput, publicPathContext] = await Promise.all([
          timeout(5000, "Timed out waiting for all HTML entry points", deferredSubBuildOutput),
          getPublicPathContext(htmlPathAbs, buildOptions),
        ]);

        [...subBuildOutput.esm.watchFiles, ...subBuildOutput.iife.watchFiles].forEach(watchFile =>
          loadState.watchFiles.add(watchFile)
        );

        await Promise.all(
          subresources.map(async ({ element, pathRel, external }) => {
            if (external) {
              return;
            }

            const buildOutput = subBuildOutput[element.format];
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            const { main, cssBundle } = buildOutput.outputPathsAbs.get(pathRel)!;

            setAttributes(
              $,
              element,
              getPublicPath(publicPathContext, main),
              await getIntegrity(pluginOptions.integrity, main, buildOutput.outputFiles)
            );

            if (cssBundle) {
              setAttributes(
                $,
                insertLinkElement($, element.element),
                getPublicPath(publicPathContext, cssBundle),
                await getIntegrity(pluginOptions.integrity, cssBundle, buildOutput.outputFiles)
              );
            }
          })
        );

        return {
          contents: await buildOutputHtml(buildOptions, pluginOptions, getHtml($)),
          loader: "copy",
          resolveDir: htmlDirAbs,
          errors: loadState.errors,
          warnings: loadState.warnings,
          watchFiles: [...loadState.watchFiles],
        };
      });

      build.onEnd(async result => {
        const { deferredSubBuildOutput, htmlEntryPointMetadata } = buildState;

        if (htmlEntryPointMetadata.size === 0) {
          return;
        }

        const subBuildOutput = await deferredSubBuildOutput;

        result.outputFiles = result.outputFiles
          ? augmentOutputFiles(result.outputFiles, subBuildOutput)
          : undefined;

        result.metafile = result.metafile
          ? augmentMetafile(result.metafile, htmlEntryPointMetadata, subBuildOutput)
          : undefined;

        buildState = createBuildState();
      });
    },
  };
}
