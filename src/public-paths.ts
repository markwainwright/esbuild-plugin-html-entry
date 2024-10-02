import { dirname, extname, join, relative, resolve } from "node:path";

import { build, type BuildOptions } from "esbuild";

import { getWorkingDirAbs } from "./working-dir.js";

type PublicPathContext =
  | { type: "absolute"; publicPath: string; outDirAbs: string }
  | { type: "relative"; htmlOutputDirAbs: string };

export async function getPublicPathContext(
  inputPathAbs: string,
  buildOptions: BuildOptions
): Promise<PublicPathContext> {
  const { publicPath, outdir: outDirRel } = buildOptions;
  const workingDirAbs = getWorkingDirAbs(buildOptions);

  if (publicPath) {
    return {
      type: "absolute",
      publicPath,
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- asserted in plugin setup()
      outDirAbs: resolve(workingDirAbs, outDirRel!),
    };
  }

  // HACK: Run esbuild (without writing to disk) to determine what the output path will be
  // (a function of entryNames, outbase, outdir etc) instead of re-implementing that logic
  const { outputFiles } = await build({
    absWorkingDir: workingDirAbs,
    entryPoints: [inputPathAbs],
    loader: { [extname(inputPathAbs)]: "copy" },
    bundle: false,
    write: false,
    metafile: false,
    outdir: buildOptions.outdir,
    outbase: buildOptions.outbase,
    entryNames: buildOptions.entryNames,
  });

  return {
    type: "relative",
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- reliable esbuild behaviour
    htmlOutputDirAbs: dirname(outputFiles[0]!.path),
  };
}

export function getPublicPath(context: PublicPathContext, outputPathAbs: string): string {
  if (context.type === "absolute") {
    return join(context.publicPath, relative(context.outDirAbs, outputPathAbs));
  }

  return relative(context.htmlOutputDirAbs, outputPathAbs);
}
