import { readFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";

import type { BuildOptions, Message, Metafile, Plugin } from "esbuild";
import { minify, type Options as MinifyOptions } from "html-minifier-terser";

import { createDeferred, type Deferred } from "./deferred.js";
import { findElements, getHref, getHtml, insertLinkElement, setAttributes } from "./dom.js";
import { getIntegrity } from "./integrity.js";
import { NAMESPACE } from "./namespace.js";
import { getPublicPath, getPublicPathContext } from "./public-paths.js";
import { augmentMetafile, augmentOutputFiles, type HtmlEntryPointMetadata } from "./results.js";
import { runSubBuild, type BuildFn, type SubBuildInput, type SubBuildResult } from "./sub-build.js";
import { timeout } from "./timeout.js";
import { getWorkingDirAbs } from "./working-dir.js";

const KIND = "import-statement";
const FILTER = /\.html?$/;

export interface EsbuildPluginHtmlEntryOptions {
  readonly subresourceNames?: string;
  readonly integrity?: string;
  readonly minifyOptions?: MinifyOptions;
  readonly banner?: string;
  readonly footer?: string;
  readonly __buildFn?: BuildFn;
}

/**
 * Creates state object for the lifecycle of a single build (multiple HTML files). A new object
 * should be created at the end of the onEnd callback
 */
function createBuildState(): {
  readonly htmlEntryPointPaths: Set<string>;
  readonly subBuildInput: SubBuildInput;
  readonly deferredSubBuildResult: Deferred<SubBuildResult>;
  readonly htmlEntryPointMetadata: HtmlEntryPointMetadata;
} {
  return {
    htmlEntryPointPaths: new Set(),
    subBuildInput: { esm: new Set(), iife: new Set() },
    deferredSubBuildResult: createDeferred(),
    htmlEntryPointMetadata: new Map(),
  };
}

/** Creates state object for the lifecycle of a single `onLoad` call (single HTML file) */
function createLoadState(): {
  readonly errors: Message[];
  readonly warnings: Message[];
  readonly imports: Metafile["inputs"][string]["imports"];
} {
  return {
    errors: [],
    warnings: [],
    imports: [],
  };
}

async function read(pathAbs: string): Promise<[string, number]> {
  const buffer = await readFile(pathAbs);
  return [buffer.toString("utf-8"), buffer.byteLength];
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
    name: NAMESPACE,

    setup(build) {
      const buildOptions = build.initialOptions;
      if (!buildOptions.outdir) {
        throw new Error("Must provide outdir");
      }
      const workingDirAbs = getWorkingDirAbs(buildOptions);
      const buildFn = pluginOptions.__buildFn ?? build.esbuild.build;

      let buildState = createBuildState();

      build.onResolve({ filter: FILTER }, async ({ path, ...args }) => {
        if (args.kind !== "entry-point" || args.namespace === NAMESPACE) {
          return;
        }

        const resolveResult = await build.resolve(path, { ...args, namespace: NAMESPACE });

        buildState.htmlEntryPointPaths.add(resolveResult.path);

        return {
          ...resolveResult,
          // If we return an absolute path then that will be visible in the metafile, so we return
          // a relative path and convert it back to absolute in onLoad
          path: relative(workingDirAbs, resolveResult.path),
          namespace: NAMESPACE,
        };
      });

      build.onLoad({ namespace: NAMESPACE, filter: FILTER }, async args => {
        const { errors, warnings, imports } = createLoadState();
        const {
          htmlEntryPointPaths,
          subBuildInput,
          deferredSubBuildResult,
          htmlEntryPointMetadata,
        } = buildState;

        const htmlPathRel = args.path;
        const htmlPathAbs = resolve(workingDirAbs, htmlPathRel);
        const htmlDirAbs = dirname(htmlPathAbs);
        const [htmlContentString, htmlContentBytes] = await read(htmlPathAbs);

        const [$, elements] = findElements(htmlContentString, buildOptions.charset);

        const resolveOptions = {
          kind: KIND,
          importer: htmlPathAbs,
          resolveDir: htmlDirAbs,
        } as const;

        const resolvedElements = (
          await Promise.all(
            elements.map(async element => {
              const href = getHref($, element);
              const resolveResult = await build.resolve(href, resolveOptions);

              if (errors.length) {
                errors.push(...resolveResult.errors);
                return null;
              }

              if (warnings.length) {
                warnings.push(...resolveResult.warnings);
              }

              return {
                element,
                href,
                hrefPathRel: relative(workingDirAbs, resolveResult.path),
                isExternal: resolveResult.external,
              };
            })
          )
        ).filter(subresource => subresource !== null);

        resolvedElements.forEach(({ element, href, hrefPathRel, isExternal }) => {
          imports.push(
            isExternal
              ? { path: href, kind: KIND, external: true }
              : { path: hrefPathRel, kind: KIND, original: href }
          );

          if (!isExternal) {
            subBuildInput[element.format].add(hrefPathRel);
          }
        });

        htmlEntryPointMetadata.set(htmlPathRel, { imports, inputBytes: htmlContentBytes });

        if (htmlEntryPointMetadata.size === htmlEntryPointPaths.size) {
          // This is the last HTML entry point, so trigger the sub-build
          const subresourceNames = pluginOptions.subresourceNames ?? buildOptions.assetNames;
          deferredSubBuildResult.resolve(
            runSubBuild(buildFn, buildOptions, subresourceNames, subBuildInput)
          );
        }

        // Wait for the sub-build triggered by the last HTML entry point to complete
        const [subBuildResult, publicPathContext] = await Promise.all([
          timeout(5000, "Timed out waiting for all HTML entry points", deferredSubBuildResult),
          getPublicPathContext(htmlPathAbs, buildOptions),
        ]);

        resolvedElements.forEach(({ element, hrefPathRel, isExternal }) => {
          if (isExternal) {
            return;
          }

          const { main, cssBundle } =
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            subBuildResult.outputPathsAbs[element.format].get(hrefPathRel)!;

          setAttributes(
            $,
            element,
            getPublicPath(publicPathContext, main),
            getIntegrity(pluginOptions.integrity, main, subBuildResult.outputFiles)
          );

          if (cssBundle) {
            setAttributes(
              $,
              insertLinkElement($, element.element),
              getPublicPath(publicPathContext, cssBundle),
              getIntegrity(pluginOptions.integrity, cssBundle, subBuildResult.outputFiles)
            );
          }
        });

        return {
          contents: await buildOutputHtml(buildOptions, pluginOptions, getHtml($)),
          loader: "copy",
          resolveDir: htmlDirAbs,
          errors,
          warnings,
          watchFiles: Object.keys(subBuildResult.inputs),
        };
      });

      build.onEnd(async result => {
        const { deferredSubBuildResult, htmlEntryPointMetadata } = buildState;

        if (htmlEntryPointMetadata.size === 0) {
          return;
        }

        const subBuildResult = await deferredSubBuildResult;

        result.outputFiles = result.outputFiles
          ? augmentOutputFiles(result.outputFiles, subBuildResult)
          : undefined;

        result.metafile = result.metafile
          ? augmentMetafile(result.metafile, htmlEntryPointMetadata, subBuildResult)
          : undefined;

        buildState = createBuildState();
      });
    },
  };
}
