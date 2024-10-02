import { build as _build, type BuildOptions, type Metafile, type OutputFile } from "esbuild";
import { resolve } from "path";
import { getWorkingDirAbs } from "./working-dir.js";

export type BuildResult = Map<
  string,
  {
    mainOutputPathAbs: string;
    cssOutputPathAbs: string | undefined;
    watchFiles: string[];
    outputFiles: OutputFile[] | undefined;
    inputs: Metafile["inputs"];
    outputs: Metafile["outputs"];
  }
>;

export async function build(
  buildOptions: BuildOptions,
  assetNames: string | undefined,
  entryPoints: string[]
): Promise<BuildResult> {
  if (entryPoints.length === 0) {
    return new Map();
  }

  const workingDirAbs = getWorkingDirAbs(buildOptions);
  const { metafile, outputFiles } = await _build({
    ...buildOptions,
    entryNames: assetNames,
    entryPoints,
    metafile: true,
  });

  return new Map(
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
          mainOutputPathAbs: resolve(workingDirAbs, mainOutputPathRel),
          cssOutputPathAbs: outputMeta.cssBundle
            ? resolve(workingDirAbs, outputMeta.cssBundle)
            : undefined,
          inputs: metafile.inputs,
          outputs: metafile.outputs,

          // These will include all files related to the build, not just ones related to this
          // entryPoint. I'm not aware of a downside of this that would justify the complexity of
          // figuring it out from metafile, however
          watchFiles: Object.keys(metafile.inputs),
          outputFiles,
        },
      ];
    })
  );
}
