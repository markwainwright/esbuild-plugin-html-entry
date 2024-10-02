import { build as _build, type BuildOptions, type Metafile, type OutputFile } from "esbuild";
import { resolve } from "path";
import { getWorkingDirAbs } from "./working-dir.js";

export interface BuildResult {
  mainOutputPathAbs: string;
  cssOutputPathAbs: string | undefined;
  watchFiles: string[];
  outputFiles: OutputFile[] | undefined;
  inputs: Metafile["inputs"];
  outputs: Metafile["outputs"];
}

export async function build(
  buildOptions: BuildOptions,
  assetNames: string | undefined,
  entryPoints: string[]
): Promise<BuildResult[]> {
  const workingDirAbs = getWorkingDirAbs(buildOptions);
  const { metafile, outputFiles } = await _build({
    ...buildOptions,
    entryNames: assetNames,
    entryPoints,
    metafile: true,
  });

  return entryPoints.map(entryPoint => {
    const output = Object.entries(metafile.outputs).find(
      ([, output]) => output.entryPoint === entryPoint
    );

    if (!output) {
      throw new Error(`Output not present for entry point "${entryPoint}"`);
    }

    const [mainOutputPathRel, outputMeta] = output;

    return {
      mainOutputPathAbs: resolve(workingDirAbs, mainOutputPathRel),
      cssOutputPathAbs: outputMeta.cssBundle
        ? resolve(workingDirAbs, outputMeta.cssBundle)
        : undefined,
      watchFiles: Object.keys(metafile.inputs), // TODO
      outputFiles, // TODO
      inputs: metafile.inputs,
      outputs: metafile.outputs,
    };
  });
}
