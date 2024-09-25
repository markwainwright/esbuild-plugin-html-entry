import type { Metafile, OutputFile } from "esbuild";

import type { Results } from "./types.js";

function createSortBy<V>(callback: (value: V) => string) {
  return function (value1: V, value2: V) {
    return callback(value1).localeCompare(callback(value2));
  };
}

export async function augmentOutputFiles(
  assetResults: Results["assets"],
  outputFiles: OutputFile[]
): Promise<OutputFile[] | undefined> {
  let assetOutputFiles: OutputFile[] = [];

  for (const assetResultPromise of assetResults.values()) {
    const assetResult = await assetResultPromise;

    if (assetResult.outputFiles) {
      assetOutputFiles = assetOutputFiles.concat(assetResult.outputFiles);
    }
  }

  return [...outputFiles, ...assetOutputFiles.sort(createSortBy(f => f.path))];
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

  let assetInputEntries: [string, Metafile["inputs"][string]][] = [];
  let assetOutputEntries: [string, Metafile["outputs"][string]][] = [];

  for (const assetResult of results.assets.values()) {
    const { inputs, outputs } = await assetResult;

    assetInputEntries = assetInputEntries.concat(Object.entries(inputs));

    for (const output of Object.values(outputs)) {
      delete output.entryPoint;
    }
    assetOutputEntries = assetOutputEntries.concat(Object.entries(outputs));
  }

  Object.assign(
    metafile.inputs,
    Object.fromEntries(assetInputEntries.sort(createSortBy(e => e[0])))
  );
  Object.assign(
    metafile.outputs,
    Object.fromEntries(assetOutputEntries.sort(createSortBy(e => e[0])))
  );

  return metafile;
}
