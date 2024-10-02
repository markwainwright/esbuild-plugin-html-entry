import { build, type BuildOptions, type Format } from "esbuild";

import type { AssetResult } from "./results.js";

export async function buildAsset(
  buildOptions: BuildOptions,
  assetNames: string | undefined,
  entryPoint: string,
  format: Format
): Promise<AssetResult> {
  const { metafile, outputFiles } = await build({
    ...buildOptions,
    entryNames: assetNames,
    entryPoints: [entryPoint],
    metafile: true,
    format,
  });

  const output = Object.entries(metafile.outputs).find(
    ([, output]) => output.entryPoint === entryPoint
  );

  if (!output) {
    throw new Error(`Output not present for entry point "${entryPoint}"`);
  }

  const [mainOutputPathRel, outputMeta] = output;

  return {
    mainOutputPathRel,
    cssOutputPathRel: outputMeta.cssBundle,
    watchFiles: Object.keys(metafile.inputs),
    outputFiles,
    inputs: metafile.inputs,
    outputs: metafile.outputs,
  };
}
