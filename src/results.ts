import type { Metafile, OutputFile } from "esbuild";

import { NAMESPACE } from "./namespace.js";
import type { SubBuildResult } from "./sub-build.js";

/** Map of relative HTML entry point path to result metadata */
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
  subBuildResult: SubBuildResult
): OutputFile[] {
  return [
    ...htmlOutputFiles,
    ...uniqueBy(subBuildResult.outputFiles, f => f.path).sort(createSortBy(f => f.path)),
  ];
}

export function augmentMetafile(
  metafile: Metafile,
  htmlEntryPointMetadata: HtmlEntryPointMetadata,
  subBuildResult: SubBuildResult
): Metafile | undefined {
  for (const [path, { inputBytes, imports }] of htmlEntryPointMetadata) {
    const namespacedPath = `${NAMESPACE}:${path}`;

    const input = metafile.inputs[namespacedPath];
    if (input) {
      // Because we're using the `copy` loader, ESBuild sets this to the size of the file *after*
      // the path substitutions have been made (i.e. the result of the onLoad callback). This
      // restores it to the input file's size
      input.bytes = inputBytes;
      input.imports = imports;
    } else {
      throw new Error(`metafile input "${namespacedPath}" is missing`);
    }

    const output = Object.values(metafile.outputs).find(output => namespacedPath in output.inputs);
    if (output) {
      // This isn't set by esbuild because we're using the "copy" loader
      output.entryPoint = namespacedPath;
      output.imports = input.imports.filter(i => i.external);
    } else {
      throw new Error(`metafile output with input "${namespacedPath}" is missing`);
    }
  }

  const inputs = sortByKey(subBuildResult.inputs);
  Object.assign(metafile.inputs, inputs);

  const outputs = sortByKey(subBuildResult.outputs);
  Object.values(outputs).forEach(output => {
    delete output.entryPoint;
  });
  Object.assign(metafile.outputs, outputs);

  return metafile;
}
