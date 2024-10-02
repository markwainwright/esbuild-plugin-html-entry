import * as assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { cwd } from "node:process";
import { test, type TestContext } from "node:test";

import { compare } from "dir-compare";
import esbuild, { type BuildOptions, type BuildResult } from "esbuild";
import { rimraf } from "rimraf";

import { esbuildPluginHtmlEntry, type EsbuildPluginHtmlEntryOptions } from "../../src/index.js";
import { NAMESPACE } from "../../src/namespace.js";

function getTestNameDir(testName: string) {
  return testName.replaceAll(" > ", "/").replaceAll(" - ", "-").toLowerCase().replace(/\s/g, "-");
}

export async function testBuild(
  testName: string,
  buildOptions: BuildOptions,
  pluginOptions: EsbuildPluginHtmlEntryOptions = {},
  testOptions: { only?: true; skip?: true } = {}
): Promise<void> {
  await test(testName, testOptions, async t => {
    await buildAndAssert(t, buildOptions, pluginOptions);
  });
}

export async function build(
  testContext: TestContext,
  buildOptions: BuildOptions,
  pluginOptions: EsbuildPluginHtmlEntryOptions = {}
): Promise<BuildResult> {
  const actualOutputDir = resolve("test/output/actual", getTestNameDir(testContext.name));

  await rimraf(actualOutputDir);

  return await esbuild.build({
    loader: { ".gif": "file" },
    platform: "browser",
    bundle: true,
    outbase: "test/input",
    metafile: true,
    entryNames: "[name]",
    assetNames: "[name]",
    outdir: actualOutputDir,
    ...buildOptions,
    plugins: [esbuildPluginHtmlEntry({ integrity: "sha256", ...pluginOptions })],
  });
}

function mapKeys<V>(object: Record<string, V>, callback: (key: string) => string) {
  return Object.fromEntries(Object.entries(object).map(([key, value]) => [callback(key), value]));
}

function createMakeAbsolute(workingDirAbs: string) {
  return function makeAbsolute(path: string) {
    return path.startsWith(NAMESPACE)
      ? `${NAMESPACE}:${relative(workingDirAbs, path.substring(NAMESPACE.length + 1))}`
      : path;
  };
}

/** Remove all absolute paths from result so it can be diffed across systems */
function sanitizeResult(workingDirAbs: string, result: BuildResult) {
  if (result.metafile) {
    const makeAbsolute = createMakeAbsolute(workingDirAbs);

    result.metafile.inputs = mapKeys(result.metafile.inputs, makeAbsolute);

    for (const output of Object.values(result.metafile.outputs)) {
      output.inputs = mapKeys(output.inputs, makeAbsolute);

      if (output.entryPoint) {
        output.entryPoint = makeAbsolute(output.entryPoint);
      }
    }
  }

  return {
    ...result,
    outputFiles: result.outputFiles?.map(({ path, hash, text }) => ({
      path: relative(workingDirAbs, path),
      hash,
      text,
    })),
  };
}

export async function buildAndAssert(
  testContext: TestContext,
  buildOptions: BuildOptions,
  pluginOptions: EsbuildPluginHtmlEntryOptions = {}
): Promise<void> {
  const testNameDir = getTestNameDir(testContext.name);
  const actualOutputDir = resolve("test/output/actual", testNameDir);
  const expectedOutputDir = resolve("test/output/expected", testNameDir);

  const result = await build(testContext, buildOptions, pluginOptions);
  const workingDirAbs = buildOptions.absWorkingDir ?? cwd();

  await mkdir(actualOutputDir, { recursive: true });
  await writeFile(
    resolve(actualOutputDir, "result.json"),
    JSON.stringify(sanitizeResult(workingDirAbs, result), null, 2)
  );

  const compareResult = await compare(expectedOutputDir, actualOutputDir, {
    compareContent: true,
  });

  if (compareResult.diffSet) {
    for (const file of compareResult.diffSet) {
      const relativePath =
        file.path1 && file.name1
          ? relative(expectedOutputDir, resolve(file.path1, file.name1))
          : // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            relative(actualOutputDir, resolve(file.path2!, file.name2!));

      await testContext.test(relativePath, async () => {
        switch (file.state) {
          case "right":
            throw new Error("Unexpected output file");

          case "left":
            throw new Error("Missing output file");

          case "distinct":
            assert.equal(
              // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
              await readFile(resolve(file.path2!, file.name2!), "utf-8"),
              // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
              await readFile(resolve(file.path1!, file.name1!), "utf-8")
            );
        }
      });
    }
  }
}
