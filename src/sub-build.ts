import { mkdir, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";

import type { BuildOptions, Metafile, OutputFile, build } from "esbuild";

import { getWorkingDirAbs } from "./working-dir.js";

type Format = "esm" | "iife" | "any";

export type BuildFn = typeof build;

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

function getOutputPaths(
  workingDirAbs: string,
  outputs: Metafile["outputs"],
  entryPoints: Set<string>
) {
  const outputEntries = Object.entries(outputs);
  const entryPointsArray = Array.from(entryPoints);

  return new Map(
    entryPointsArray.map(entryPoint => {
      const outputEntry = outputEntries.find(([, output]) => output.entryPoint === entryPoint);

      if (!outputEntry) {
        throw new Error(`Output not present for entry point "${entryPoint}"`);
      }

      const [mainOutputPathRel, { cssBundle: cssBundleOutputPathRel }] = outputEntry;

      return [
        entryPoint,
        {
          main: resolve(workingDirAbs, mainOutputPathRel),
          cssBundle: cssBundleOutputPathRel
            ? resolve(workingDirAbs, cssBundleOutputPathRel)
            : undefined,
        },
      ];
    })
  );
}

async function runBuild(buildFn: BuildFn, buildOptions: BuildOptions & { entryPoints: string[] }) {
  if (buildOptions.entryPoints.length === 0) {
    return EMPTY_BUILD_RESULT;
  }

  const {
    metafile: { inputs, outputs },
    outputFiles,
  } = await buildFn({
    ...buildOptions,
    metafile: true,
    // Build without writing so we can, without re-reading from disk:
    // 1. Check for output file collisions (in `runSubBuild`)
    // 2. Generate integrity hashes (in integrity.ts -> `getIntegrity`)
    write: false,
    platform: "browser",
  });

  return { outputFiles, inputs, outputs };
}

export async function runSubBuild(
  buildFn: BuildFn,
  buildOptions: BuildOptions,
  subresourceNames: string | undefined,
  input: SubBuildInput
): Promise<SubBuildResult> {
  const buildAnyWithEsm = input.esm.size > 0;

  const [esmBuildResult, iifeBuildResult] = await Promise.all([
    runBuild(buildFn, {
      ...buildOptions,
      entryPoints: [...input.esm, ...(buildAnyWithEsm ? input.any : [])],
      entryNames: subresourceNames,
      format: "esm",
    }),
    runBuild(buildFn, {
      ...buildOptions,
      entryPoints: [...input.iife, ...(buildAnyWithEsm ? [] : input.any)],
      entryNames: subresourceNames,
      format: "iife",
      splitting: false,
    }),
  ]);

  if (iifeBuildResult.outputFiles.length !== 0) {
    // If we ran two builds it's possible that the second would overwrite an output file of the
    // first with different contents. This replicates the check that esbuild does for a single build
    // across the two builds
    esmBuildResult.outputFiles.forEach(esmOutputFile => {
      if (
        iifeBuildResult.outputFiles.some(
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

  const workingDirAbs = getWorkingDirAbs(buildOptions);
  const outputFiles = [...esmBuildResult.outputFiles, ...iifeBuildResult.outputFiles];

  if (buildOptions.write !== false) {
    // Since we ran the build without writing (see comment in `build`), we need to manually write
    // the files to disk now
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

  const anyBuildResult = buildAnyWithEsm ? esmBuildResult : iifeBuildResult;

  return {
    outputPathsAbs: {
      esm: getOutputPaths(workingDirAbs, esmBuildResult.outputs, input.esm),
      iife: getOutputPaths(workingDirAbs, iifeBuildResult.outputs, input.iife),
      any: getOutputPaths(workingDirAbs, anyBuildResult.outputs, input.any),
    },
    outputFiles,
    inputs: { ...esmBuildResult.inputs, ...iifeBuildResult.inputs },
    outputs: { ...esmBuildResult.outputs, ...iifeBuildResult.outputs },
  };
}
