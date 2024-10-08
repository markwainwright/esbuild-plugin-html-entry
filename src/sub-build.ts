import { mkdir, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";

import type { BuildOptions, Metafile, OutputFile } from "esbuild";
import * as esbuild from "esbuild";

import { getWorkingDirAbs } from "./working-dir.js";

type Format = "esm" | "iife";

/** For ESM and IIFE, relative paths of subresources to build */
export type SubBuildInput = Record<Format, Set<string>>;

export interface SubBuildResult {
  /**
   * For ESM and IIFE, a map of subresource entry point relative path to absolute output paths for
   * main (JS or CSS) and CSS bundle
   */
  readonly outputPathsAbs: Record<
    Format,
    Map<string, { readonly main: string; readonly cssBundle?: string }>
  >;
  readonly outputFiles: OutputFile[];
  readonly inputs: Metafile["inputs"];
  readonly outputs: Metafile["outputs"];
}

const EMPTY_BUILD_RESULT = {
  outputPathsAbs: new Map(),
  outputFiles: [],
  inputs: {},
  outputs: {},
};

function isEqual(a: Uint8Array, b: Uint8Array) {
  return a.byteLength === b.byteLength && a.every((value, index) => b[index] === value);
}

async function build(buildOptions: BuildOptions & { entryPoints: string[] }) {
  if (buildOptions.entryPoints.length === 0) {
    return EMPTY_BUILD_RESULT;
  }

  const {
    metafile: { inputs, outputs },
    outputFiles,
  } = await esbuild.build({
    ...buildOptions,
    metafile: true,
    // Build without writing so we can, without re-reading from disk:
    // 1. Check for output file collisions (in `runSubBuild`)
    // 2. Generate integrity hashes (in integrity.ts -> `getIntegrity`)
    write: false,
    platform: "browser",
  });

  const workingDirAbs = getWorkingDirAbs(buildOptions);

  return {
    outputPathsAbs: new Map(
      buildOptions.entryPoints.map(entryPoint => {
        const output = Object.entries(outputs).find(
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
    inputs,
    outputs,
  };
}

export async function runSubBuild(
  buildOptions: BuildOptions,
  subresourceNames: string | undefined,
  input: SubBuildInput
): Promise<SubBuildResult> {
  const [esm, iife] = await Promise.all([
    build({
      ...buildOptions,
      entryPoints: [...input.esm],
      entryNames: subresourceNames,
      format: "esm",
    }),
    build({
      ...buildOptions,
      entryPoints: [...input.iife],
      entryNames: subresourceNames,
      format: "iife",
      splitting: false,
    }),
  ]);

  if (iife.outputFiles.length !== 0) {
    // If we ran two builds it's possible that the second would overwrite an output file of the
    // first with different contents. This replicates the check that esbuild does for a single build
    // across the two builds
    esm.outputFiles.forEach(esmOutputFile => {
      if (
        iife.outputFiles.some(
          iifeOutputFile =>
            iifeOutputFile.path === esmOutputFile.path &&
            !isEqual(iifeOutputFile.contents, esmOutputFile.contents)
        )
      ) {
        const pathRel = relative(getWorkingDirAbs(buildOptions), esmOutputFile.path);
        throw new Error(
          `Two output files share the same path but have different contents: ${pathRel}`
        );
      }
    });
  }

  const outputFiles = [...esm.outputFiles, ...iife.outputFiles];

  if (buildOptions.write !== false) {
    // Since we ran the build without writing (see comment in `build`), we need to manually write
    // the files to disk now
    const workingDirAbs = getWorkingDirAbs(buildOptions);
    const outputDirsAbs = Array.from(
      new Set(outputFiles.map(outputFile => resolve(workingDirAbs, dirname(outputFile.path))))
    );

    await Promise.all(outputDirsAbs.map(outputDirAbs => mkdir(outputDirAbs, { recursive: true })));
    await Promise.all(
      outputFiles.map(outputFile =>
        writeFile(resolve(workingDirAbs, outputFile.path), outputFile.contents)
      )
    );
  }

  const inputs = { ...esm.inputs, ...iife.inputs };

  return {
    outputPathsAbs: { esm: esm.outputPathsAbs, iife: iife.outputPathsAbs },
    outputFiles,
    inputs,
    outputs: { ...esm.outputs, ...iife.outputs },
  };
}
