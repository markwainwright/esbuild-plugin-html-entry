import { build, type BuildOptions } from "esbuild";

import type { AssetResult } from "./types.js";

export async function buildAsset(
  buildOptions: BuildOptions,
  assetNames: string | undefined,
  entryPoint: string
): Promise<AssetResult> {
  const { metafile, outputFiles } = await build({
    ...buildOptions,
    entryNames: assetNames,
    entryPoints: [entryPoint],
    metafile: true,
    format: "iife",
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
