import type { Metafile, OutputFile } from "esbuild";

import type { BuildResult } from "./build.js";

type BuildResults = Record<"esm" | "iife", BuildResult>;

/** Map of absolute HTML entry point path to result metadata */
export type HtmlEntryPointMetadata = Map<
  string,
  {
    /** Map of resolved subresource entry point path to original import href */
    readonly imports: Metafile["inputs"][string]["imports"];
    readonly inputBytes: number;
  }
>;

function createSortBy<T>(callback: (value: T) => string) {
  return function (value1: T, value2: T) {
    return callback(value1).localeCompare(callback(value2));
  };
}

function sortByKey<T>(object: Record<string, T>): Record<string, T> {
  return Object.fromEntries(Object.entries(object).sort(createSortBy(([key]) => key)));
}

function uniqueBy<T>(values: T[], callback: (value: T) => unknown): T[] {
  return Array.from(new Map(values.map(value => [callback(value), value])).values());
}

export function augmentOutputFiles(
  htmlOutputFiles: OutputFile[],
  buildResults: BuildResults
): OutputFile[] {
  const subresourceAssetFiles = [
    ...(buildResults.esm.outputFiles ?? []),
    ...(buildResults.iife.outputFiles ?? []),
  ];

  return [
    ...htmlOutputFiles,
    ...uniqueBy(subresourceAssetFiles, f => f.path).sort(createSortBy(f => f.path)),
  ];
}

export function augmentMetafile(
  metafile: Metafile,
  htmlEntryPointMetadata: HtmlEntryPointMetadata,
  buildResults: BuildResults
): Metafile | undefined {
  // Note: this will also be run in the onEnd hook for the sub-builds created by this plugin

  /*
    inputs[].imports
  */

  for (const [path, { inputBytes, imports }] of htmlEntryPointMetadata) {
    const input = metafile.inputs[`html-entry:${path}`];

    if (input) {
      // Because we're using the `copy` loader, ESBuild sets this to the size of the file *after*
      // the path substitutions have been made (i.e. the result of the onLoad callback). This
      // restores it to the input file's size
      input.bytes = inputBytes;

      input.imports = imports;
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
    inputs  (for subresources)
    outputs (for subresources)
  */

  const inputs = sortByKey({ ...buildResults.esm.inputs, ...buildResults.iife.inputs });
  const outputs = sortByKey({ ...buildResults.esm.outputs, ...buildResults.iife.outputs });

  Object.values(outputs).forEach(output => {
    delete output.entryPoint;
  });

  Object.assign(metafile.inputs, inputs);
  Object.assign(metafile.outputs, outputs);

  return metafile;
}
