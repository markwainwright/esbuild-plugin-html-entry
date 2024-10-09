import { mkdir, readFile, writeFile } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { cwd } from "node:process";
import { mock, test, type TestContext } from "node:test";

import { compare } from "dir-compare";
import * as esbuild from "esbuild";
import { type BuildOptions, type BuildResult } from "esbuild";
import { rimraf } from "rimraf";

import { esbuildPluginHtmlEntry, type EsbuildPluginHtmlEntryOptions } from "../../src/index.js";

function getTestNameDir(testName: string) {
  return testName
    .replaceAll(" > ", "/")
    .toLowerCase()
    .replaceAll(/[^a-z0-9/]+/g, "-");
}

export function testBuild(
  testName: string,
  buildOptions: BuildOptions,
  pluginOptions: EsbuildPluginHtmlEntryOptions = {},
  expectedSubBuildCount = 1,
  testOptions: { only?: true; skip?: true; todo?: true } = {}
): void {
  test(testName, testOptions, async testContext => {
    await buildAndAssert(testContext, buildOptions, pluginOptions, expectedSubBuildCount);
  });
}

export function testBuildError(
  testName: string,
  errorMessageRegexp: RegExp,
  buildOptions: BuildOptions,
  pluginOptions: EsbuildPluginHtmlEntryOptions = {},
  testOptions: { only?: true; skip?: true; todo?: true } = {}
): void {
  test(testName, testOptions, async (testContext: TestContext) => {
    let error;
    try {
      await build(testContext, { ...buildOptions, logLevel: "silent" }, pluginOptions);
    } catch (err) {
      error = err;
    }

    testContext.assert.strictEqual(error instanceof Error, true);
    testContext.assert.match((error as Error).message, errorMessageRegexp);
  });
}

async function build(
  testContext: TestContext,
  buildOptions: BuildOptions,
  pluginOptions: EsbuildPluginHtmlEntryOptions = {}
): Promise<BuildResult> {
  const actualOutputDir = resolve("test/output/actual", getTestNameDir(testContext.fullName));

  await rimraf(actualOutputDir);
  await mkdir(actualOutputDir, { recursive: true });

  return await esbuild.build({
    loader: { ".gif": "file" },
    platform: "node", // should be overridden to "browser" for subresources
    bundle: true,
    outbase: "test/input",
    metafile: true,
    entryNames: "[name]",
    assetNames: "[name]",
    chunkNames: "[name]-[hash]",
    outdir: actualOutputDir,
    ...buildOptions,
    plugins: [esbuildPluginHtmlEntry(pluginOptions)],
  });
}

/** Remove all absolute paths from result so it can be diffed across systems */
function sanitizeResult(workingDirAbs: string, result: BuildResult) {
  return {
    ...result,
    outputFiles: result.outputFiles?.map(({ path, hash, text }) => ({
      path: relative(workingDirAbs, path),
      hash,
      text,
    })),
  };
}

async function buildAndAssert(
  testContext: TestContext,
  buildOptions: BuildOptions,
  pluginOptions: EsbuildPluginHtmlEntryOptions = {},
  expectedSubBuildCount: number
): Promise<void> {
  const testNameDir = getTestNameDir(testContext.fullName);
  const actualOutputDir = resolve("test/output/actual", testNameDir);
  const expectedOutputDir = resolve("test/output/expected", testNameDir);
  const mockBuildFn = mock.fn(esbuild.build);

  const result = await build(testContext, buildOptions, {
    ...pluginOptions,
    __buildFn: mockBuildFn,
  });

  const workingDirAbs = buildOptions.absWorkingDir ?? cwd();

  await mkdir(actualOutputDir, { recursive: true });
  await writeFile(
    resolve(actualOutputDir, "result.json"),
    JSON.stringify(sanitizeResult(workingDirAbs, result), null, 2)
  );

  const { diffSet } = await compare(expectedOutputDir, actualOutputDir, { compareContent: true });

  if (!diffSet) {
    return;
  }

  for (const file of diffSet) {
    switch (file.state) {
      case "right":
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        throw new Error(`Unexpected output file: ${file.name2!}`);

      case "left":
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        throw new Error(`Missing output file: ${file.name1!}`);

      case "distinct": {
        const [actualContents, expectedContents] = await Promise.all([
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          readFile(resolve(file.path2!, file.name2!), "utf-8"),
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          readFile(resolve(file.path1!, file.name1!), "utf-8"),
        ]);
        testContext.assert.strictEqual(
          actualContents,
          expectedContents,
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          `Expected ${file.name1!} to match`
        );
      }
    }
  }

  const actualSubBuildCallCount = mockBuildFn.mock.callCount();
  testContext.assert.strictEqual(
    actualSubBuildCallCount,
    expectedSubBuildCount,
    `Expected ${expectedSubBuildCount} sub-build${expectedSubBuildCount > 1 ? "s" : ""}, ` +
      `but saw ${actualSubBuildCallCount}`
  );

  for (const call of mockBuildFn.mock.calls) {
    testContext.assert.strictEqual(call.arguments[0].platform, "browser");
  }
}
