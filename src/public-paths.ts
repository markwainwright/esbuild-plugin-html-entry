import { dirname, extname, join, relative, resolve } from "node:path";

import { build, type BuildOptions } from "esbuild";

import { getWorkingDirAbs } from "./working-dir.js";

type PublicPathContext =
  | {
      readonly type: "absolute";
      readonly publicPath: string;
      readonly outDirAbs: string;
    }
  | {
      readonly type: "relative";
      readonly htmlOutputDirAbs: string;
    };

/**
 * Returns a context object for a single HTML entry point file that can be passed to `getPublicPath`
 * to generate public paths for all subresources appearing in that HTML file. This is expensive so
 * should only be called once per HTML file.
 */
export async function getPublicPathContext(
  htmlPathAbs: string,
  buildOptions: BuildOptions
): Promise<PublicPathContext> {
  const { publicPath, outdir } = buildOptions;
  const workingDirAbs = getWorkingDirAbs(buildOptions);

  if (publicPath) {
    return {
      type: "absolute",
      publicPath,
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- asserted in plugin setup()
      outDirAbs: resolve(workingDirAbs, outdir!),
    };
  }

  // HACK: Run esbuild (without writing to disk) to determine what the output path will be
  // (a function of entryPoints, entryNames, outbase, outdir etc) instead of re-implementing that
  // logic
  const { entryPoints, outbase, entryNames } = buildOptions;
  const { metafile } = await build({
    absWorkingDir: workingDirAbs,
    entryPoints,
    loader: { [extname(htmlPathAbs)]: "copy" },
    bundle: false,
    write: false,
    metafile: true,
    outdir,
    outbase,
    entryNames,
  });

  const htmlPathRel = relative(workingDirAbs, htmlPathAbs);
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- reliable esbuild behaviour
  const outputPathRel = Object.entries(metafile.outputs).find(
    ([, output]) => output.inputs[htmlPathRel]
  )![0];

  return {
    type: "relative",
    htmlOutputDirAbs: dirname(resolve(workingDirAbs, outputPathRel)),
  };
}

export function getPublicPath(context: PublicPathContext, outputPathAbs: string): string {
  if (context.type === "absolute") {
    return join(context.publicPath, relative(context.outDirAbs, outputPathAbs));
  }

  return relative(context.htmlOutputDirAbs, outputPathAbs);
}
