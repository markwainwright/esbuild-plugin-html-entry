import type { Metafile, OutputFile } from "esbuild";

import type { Results } from "./types.js";

function createSortBy<P extends string, V extends { [p in P]: string }>(propertyName: P) {
  return function (value1: V, value2: V) {
    return value1[propertyName].localeCompare(value2[propertyName]);
  };
}

export async function augmentOutputFiles(
  assetResults: Results["assets"],
  outputFiles: OutputFile[]
): Promise<OutputFile[] | undefined> {
  const assetOutputFiles = [];

  for (const assetResultPromise of assetResults.values()) {
    const assetResult = await assetResultPromise;

    if (assetResult.outputFiles) {
      assetOutputFiles.push(...assetResult.outputFiles);
    }
  }

  return [...outputFiles, ...assetOutputFiles.sort(createSortBy("path"))];
}

export async function augmentMetafile(
  results: Results,
  metafile: Metafile
): Promise<Metafile | undefined> {
  // Note: this will also be run in the onEnd hook for the sub-builds created by this plugin

  /*
    inputs[].imports
  */

  for (const [path, htmlResult] of results.htmls) {
    const input = metafile.inputs[path];

    if (input) {
      for (const [path, original] of htmlResult.imports) {
        input.imports.push({ path, kind: "import-statement", original });
      }
    }
  }

  /*
    outputs[].entryPoint (for HTML)
  */

  for (const [outputPath, output] of Object.entries(metafile.outputs)) {
    if (outputPath.endsWith(".html")) {
      // This isn't set by esbuild because we're using the "copy" loader
      output.entryPoint = Object.keys(output.inputs)[0];
    }
  }

  /*
    inputs  (for assets)
    outputs (for assets)
  */

  for (const assetResult of results.assets.values()) {
    const { inputs, outputs } = await assetResult;

    for (const output of Object.values(outputs)) {
      delete output.entryPoint;
    }

    Object.assign(metafile.inputs, inputs);
    Object.assign(metafile.outputs, outputs);
  }

  return metafile;
}
