import type { Metafile, OutputFile } from "esbuild";

export interface HtmlResult {
  /** Map of resolved entry point path to original import href */
  imports: Metafile["inputs"][string]["imports"];
  inputBytes: number;
}

export interface Results {
  /** Map of absolute entry point path to result metadata */
  htmlEntryPoints: Map<string, HtmlResult>;
  inputs: Metafile["inputs"];
  outputs: Metafile["outputs"];
  outputFiles: Map<string, Omit<OutputFile, "path">>;
}

function createSortBy<V>(callback: (value: V) => string) {
  return function (value1: V, value2: V) {
    return callback(value1).localeCompare(callback(value2));
  };
}

function sortByKey(object: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(object).sort(createSortBy(([key]) => key)));
}

export function augmentOutputFiles(
  htmlOutputFiles: OutputFile[],
  assetOutputFiles: Results["outputFiles"]
): OutputFile[] | undefined {
  return [
    ...htmlOutputFiles,
    ...[...assetOutputFiles.entries()]
      .map(([path, outputFile]) => ({ path, ...outputFile }))
      .sort(createSortBy(f => f.path)),
  ];
}

export function augmentMetafile(metafile: Metafile, results: Results): Metafile | undefined {
  // Note: this will also be run in the onEnd hook for the sub-builds created by this plugin

  /*
    inputs[].imports
  */

  for (const [path, htmlResult] of results.htmlEntryPoints) {
    const input = metafile.inputs[`html-entry:${path}`];

    if (input) {
      // Because we're using the `copy` loader, ESBuild sets this to the size of the file *after*
      // the path substitutions have been made (i.e. the result of the onLoad callback). This
      // restores it to the input file's size
      input.bytes = htmlResult.inputBytes;

      input.imports = htmlResult.imports;
    }
  }

  /*
    outputs[].entryPoint (for HTML)
  */

  for (const [outputPath, output] of Object.entries(metafile.outputs)) {
    if (outputPath.endsWith(".html") || outputPath.endsWith(".htm")) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const inputPathRel = Object.keys(output.inputs)[0]!;

      // This isn't set by esbuild because we're using the "copy" loader
      output.entryPoint = inputPathRel;

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      output.imports = metafile.inputs[inputPathRel]!.imports.filter(i => i.external);
    }
  }

  /*
    inputs  (for assets)
    outputs (for assets)
  */

  for (const output of Object.values(results.outputs)) {
    delete output.entryPoint;
  }

  Object.assign(metafile.inputs, sortByKey(results.inputs));

  Object.assign(metafile.outputs, sortByKey(results.outputs));

  return metafile;
}
