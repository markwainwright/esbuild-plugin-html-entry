/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { readFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";

import type { Plugin } from "esbuild";

import { augmentMetafile, augmentOutputFiles } from "./augment-results.js";
import { buildAsset } from "./build.js";
import { findElements, setAttributes } from "./dom.js";
import { minify, MinifyOptions, prettify, PrettifyOptions } from "./format.js";
import { getIntegrity } from "./integrity.js";
import { getPublicPath, getPublicPathContext } from "./public-paths.js";
import type { HtmlResult, Results } from "./types.js";

export interface PluginOptions {
  subresourceNames?: string;
  integrity?: string;
  minifyOptions?: MinifyOptions;
  prettifyOptions?: PrettifyOptions;
}

export default function esbuildPluginHtmlEntry(pluginOptions: PluginOptions): Plugin {
  return {
    name: "html-entry",

    setup(build) {
      const buildOptions = build.initialOptions;
      const workingDirAbs = buildOptions.absWorkingDir ?? process.cwd();

      const results: Results = { htmls: new Map(), assets: new Map() };

      const metafileOriginallyEnabled = !!buildOptions.metafile;
      buildOptions.metafile = true;

      build.onLoad({ filter: /\.html$/ }, async args => {
        const htmlPathAbs = args.path;
        const htmlPathRel = relative(workingDirAbs, htmlPathAbs);
        const htmlDirAbs = dirname(htmlPathAbs);

        const [$, elements] = findElements(await readFile(htmlPathAbs, "utf-8"));

        const htmlResult: HtmlResult = { imports: new Map(), watchFiles: new Set() };
        results.htmls.set(htmlPathRel, htmlResult);

        const errors = [];
        const warnings = [];

        const publicPathContext = await getPublicPathContext(
          workingDirAbs,
          htmlPathAbs,
          buildOptions
        );

        for (const element of elements) {
          const assetHref = $(element.element).attr(element.attribute)!;
          const assetResolveResult = await build.resolve(assetHref, {
            kind: "import-statement",
            importer: htmlPathAbs,
            resolveDir: htmlDirAbs,
          });

          if (assetResolveResult.external) {
            continue;
          }

          if (assetResolveResult.errors.length) {
            errors.push(...assetResolveResult.errors);
            continue;
          }
          if (assetResolveResult.warnings.length) {
            warnings.push(...assetResolveResult.warnings);
          }

          const assetPathRel = relative(workingDirAbs, assetResolveResult.path);

          htmlResult.imports.set(assetPathRel, assetHref);

          let resultPromise = results.assets.get(assetPathRel);
          if (!resultPromise) {
            // Cannot batch multiple assets into a single build because they may have different
            // `format`s and esbuild only allows a single value
            resultPromise = buildAsset(
              buildOptions,
              pluginOptions.subresourceNames ?? buildOptions.assetNames,
              assetPathRel,
              element.format
            );
            results.assets.set(assetPathRel, resultPromise);
          }

          const { mainOutputPathRel, cssOutputPathRel, watchFiles, outputFiles } =
            await resultPromise;

          for (const watchFile of watchFiles) {
            htmlResult.watchFiles.add(watchFile);
          }

          const mainOutputPathAbs = resolve(workingDirAbs, mainOutputPathRel);
          setAttributes(
            $,
            element,
            getPublicPath(publicPathContext, mainOutputPathAbs),
            await getIntegrity(pluginOptions.integrity, mainOutputPathAbs, outputFiles)
          );

          if (cssOutputPathRel) {
            const cssOutputPathAbs = resolve(workingDirAbs, cssOutputPathRel);
            const linkElement = $("<link>")
              .attr("rel", "stylesheet")
              .insertBefore(element.element)
              .get(0)!;

            setAttributes(
              $,
              { element: linkElement, attribute: "href", format: "iife" },
              getPublicPath(publicPathContext, cssOutputPathAbs),
              await getIntegrity(pluginOptions.integrity, cssOutputPathAbs, outputFiles)
            );
          }
        }

        const contents = await (buildOptions.minify
          ? minify($.html(), pluginOptions.minifyOptions)
          : prettify($.html(), pluginOptions.prettifyOptions));

        return {
          contents,
          loader: "copy",
          resolveDir: dirname(htmlPathAbs),
          errors,
          warnings,
          watchFiles: [...htmlResult.watchFiles],
        };
      });

      build.onEnd(async result => {
        result.outputFiles = result.outputFiles
          ? await augmentOutputFiles(results.assets, result.outputFiles)
          : undefined;

        result.metafile =
          metafileOriginallyEnabled && result.metafile
            ? await augmentMetafile(results, result.metafile)
            : undefined;

        results.htmls = new Map();
        results.assets = new Map();
      });
    },
  };
}
