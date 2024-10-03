import { resolve } from "node:path";

import { build as _build, type BuildOptions, type Metafile, type OutputFile } from "esbuild";

import { getWorkingDirAbs } from "./working-dir.js";

export interface BuildResult {
  /**
   * Map of subresource entry point relative path to absolute output paths for main (JS or CSS) and
   * CSS bundle
   */
  readonly outputPathsAbs: Map<
    string,
    {
      readonly main: string;
      readonly cssBundle?: string;
    }
  >;
  readonly outputFiles: OutputFile[] | undefined;
  readonly watchFiles: string[];
  readonly inputs: Metafile["inputs"];
  readonly outputs: Metafile["outputs"];
}

export async function build(
  buildOptions: BuildOptions,
  entryPoints: string[]
): Promise<BuildResult> {
  if (entryPoints.length === 0) {
    return {
      outputPathsAbs: new Map(),
      outputFiles: [],
      watchFiles: [],
      inputs: {},
      outputs: {},
    };
  }

  const workingDirAbs = getWorkingDirAbs(buildOptions);
  const { metafile, outputFiles } = await _build({
    ...buildOptions,
    entryPoints,
    metafile: true,
    platform: "browser",
    // plugins: [],
  });

  return {
    outputPathsAbs: new Map(
      entryPoints.map(entryPoint => {
        const output = Object.entries(metafile.outputs).find(
          ([, output]) => output.entryPoint === entryPoint
        );

        if (!output) {
          throw new Error(`Output not present for entry point "${entryPoint}"`);
        }

        const [mainOutputPathRel, outputMeta] = output;

        return [
          entryPoint,
          {
            main: resolve(workingDirAbs, mainOutputPathRel),
            cssBundle: outputMeta.cssBundle
              ? resolve(workingDirAbs, outputMeta.cssBundle)
              : undefined,
          },
        ];
      })
    ),
    outputFiles,
    // These will include all files related to the build, not just ones related to this
    // entryPoint. I'm not aware of a downside of this that would justify the complexity of
    // figuring it out from metafile, however
    watchFiles: Object.keys(metafile.inputs),
    inputs: metafile.inputs,
    outputs: metafile.outputs,
  };
}
