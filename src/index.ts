import { readFile } from "node:fs/promises";
import { dirname, relative } from "node:path";

import type { BuildOptions, Message, Plugin } from "esbuild";
import { minify, type Options as MinifyOptions } from "html-minifier-terser";

import { build, type BuildResult } from "./build.js";
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

type BuildResultsCache = Map<string, Promise<BuildResult>>;

function createResults(): Results {
  return {
    htmls: new Map(),
    inputs: {},
    outputs: {},
    outputFiles: new Map(),
  };
}

function createBuildResultsCache(): BuildResultsCache {
  return new Map();
}

function uniqueBy<T>(values: T[], callback: (t: T) => string): T[] {
  const map = new Map<string, T>();
  values.forEach(value => map.set(callback(value), value));
  return [...map.values()];
}

function getAssetPathRel(asset: { assetPathRel: string }) {
  return asset.assetPathRel;
}

function getCacheKey(asset: { cacheKey: string }) {
  return asset.cacheKey;
}

function buildAssets<E extends { format: "iife" | "esm" }>(
  buildOptions: BuildOptions,
  pluginOptions: EsbuildPluginHtmlEntryOptions,
  buildResultsCache: BuildResultsCache,
  assets: { assetPathRel: string; element: E }[]
): Promise<{ element: E; buildResult: BuildResult }[]> {
  const assetNames = pluginOptions.subresourceNames ?? buildOptions.assetNames;

  const esmAssets = assets.filter(asset => asset.element.format === "esm");
  const uniqueEsmAssetPathsRel = uniqueBy(esmAssets, getAssetPathRel).map(getAssetPathRel);
  const esmAssetsWithCacheKey = esmAssets.map(asset => ({
    ...asset,
    cacheKey:
      buildOptions.splitting === true
        ? `${asset.assetPathRel}:esm:${uniqueEsmAssetPathsRel.sort().join(",")}`
        : `${asset.assetPathRel}:esm`,
  }));
  const esmAssetsToBuild = uniqueBy(esmAssetsWithCacheKey, getCacheKey).filter(
    asset => !buildResultsCache.has(asset.cacheKey)
  );

  if (esmAssetsToBuild.length !== 0) {
    const buildPromise = build(
      { ...buildOptions, format: "esm" },
      assetNames,
      esmAssetsToBuild.map(getAssetPathRel)
    );

    esmAssetsToBuild.forEach(({ cacheKey }, index) =>
      buildResultsCache.set(
        cacheKey,
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        buildPromise.then(buildResults => buildResults[index]!)
      )
    );
  }

  const iifeAssets = assets.filter(asset => asset.element.format === "iife");
  const iifeAssetsWithCacheKey = iifeAssets.map(asset => ({
    ...asset,
    cacheKey: `${asset.assetPathRel}:iife`,
  }));
  const iifeAssetsToBuild = uniqueBy(iifeAssetsWithCacheKey, getCacheKey).filter(
    asset => !buildResultsCache.has(asset.cacheKey)
  );

  if (iifeAssetsToBuild.length !== 0) {
    const buildPromise = build(
      { ...buildOptions, format: "iife", splitting: false },
      assetNames,
      iifeAssetsToBuild.map(getAssetPathRel)
    );

    iifeAssetsToBuild.forEach(({ cacheKey }, index) =>
      buildResultsCache.set(
        cacheKey,
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        buildPromise.then(buildResults => buildResults[index]!)
      )
    );
  }

  return Promise.all(
    [...esmAssetsWithCacheKey, ...iifeAssetsWithCacheKey].map(async ({ element, cacheKey }) => ({
      element,
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      buildResult: await buildResultsCache.get(cacheKey)!,
    }))
  );
}

export function esbuildPluginHtmlEntry(pluginOptions: EsbuildPluginHtmlEntryOptions = {}): Plugin {
  return {
    name: "html-entry",

    setup(build) {
      const buildOptions = build.initialOptions;
      const workingDirAbs = getWorkingDirAbs(buildOptions);

      let results = createResults();
      let buildResultsCache = createBuildResultsCache();

      const metafileOriginallyEnabled = !!buildOptions.metafile;
      buildOptions.metafile = true;

      build.onLoad({ filter: /\.html?$/ }, async args => {
        const htmlPathAbs = args.path;
        const htmlPathRel = relative(workingDirAbs, htmlPathAbs);
        const htmlDirAbs = dirname(htmlPathAbs);

        const htmlContents = await readFile(htmlPathAbs);
        const htmlContentsString = htmlContents.toString("utf-8");

        const [$, elements] = findElements(htmlContentsString);

        const htmlResult: HtmlResult = {
          imports: new Map(),
          watchFiles: new Set(),
          inputBytes: htmlContents.byteLength,
        };
        results.htmls.set(htmlPathRel, htmlResult);

        const errors: Message[] = [];
        const warnings: Message[] = [];

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

        assets.forEach(({ assetPathRel, assetHref }) =>
          htmlResult.imports.set(assetPathRel, assetHref)
        );

        const [buildResults, publicPathContext] = await Promise.all([
          buildAssets(buildOptions, pluginOptions, buildResultsCache, assets),
          getPublicPathContext(htmlPathAbs, buildOptions),
        ]);

        await Promise.all(
          buildResults.map(async ({ element, buildResult }) => {
            const {
              mainOutputPathAbs,
              cssOutputPathAbs,
              watchFiles,
              outputFiles,
              outputs,
              inputs,
            } = buildResult;

            watchFiles.forEach(watchFile => htmlResult.watchFiles.add(watchFile));

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
          watchFiles: [...htmlResult.watchFiles],
        };
      });

      build.onEnd(result => {
        result.outputFiles = result.outputFiles
          ? augmentOutputFiles(result.outputFiles, results.outputFiles)
          : undefined;

        result.metafile =
          metafileOriginallyEnabled && result.metafile
            ? augmentMetafile(result.metafile, results)
            : undefined;

        results = createResults();
        buildResultsCache = createBuildResultsCache();
      });
    },
  };
}
