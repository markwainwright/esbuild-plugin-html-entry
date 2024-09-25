import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { test, type TestContext } from "node:test";

import { compare } from "dir-compare";
import esbuild, { type BuildOptions, type BuildResult } from "esbuild";
import { rimraf } from "rimraf";

import esbuildPluginHtmlEntry, { PluginOptions } from "../../src/index.js";

const dirname = import.meta.dirname;

function getTestNameDir(testName: string) {
  return testName.replaceAll(" > ", "/").toLowerCase().replace(/\s/g, "-");
}

export async function testBuild(
  testName: string,
  buildOptions: BuildOptions,
  pluginOptions: PluginOptions = {},
  testOptions: { only?: true; skip?: true } = {}
): Promise<void> {
  await test(testName, testOptions, async t => {
    await buildAndAssert(t, buildOptions, pluginOptions);
  });
}

export async function build(
  testContext: TestContext,
  buildOptions: BuildOptions,
  pluginOptions: PluginOptions = {}
): Promise<BuildResult> {
  const actualOutputDir = resolve(
    dirname,
    "../output/actual",
    getTestNameDir(testContext.fullName)
  );

  await rimraf(actualOutputDir);

  return await esbuild.build({
    absWorkingDir: resolve(dirname, ".."),
    loader: { ".gif": "file" },
    platform: "browser",
    bundle: true,
    outbase: "input",
    metafile: true,
    entryNames: "[name]",
    assetNames: "[name]",
    chunkNames: "[name]",
    outdir: actualOutputDir,
    ...buildOptions,
    plugins: [esbuildPluginHtmlEntry({ integrity: "sha256", ...pluginOptions })],
  });
}

export async function buildAndAssert(
  testContext: TestContext,
  buildOptions: BuildOptions,
  pluginOptions: PluginOptions = {}
): Promise<void> {
  const testNameDir = getTestNameDir(testContext.fullName);
  const actualOutputDir = resolve(dirname, "../output/actual", testNameDir);
  const expectedOutputDir = resolve(dirname, "../output/expected", testNameDir);

  const result = await build(testContext, buildOptions, pluginOptions);

  await mkdir(actualOutputDir, { recursive: true });
  await writeFile(
    resolve(actualOutputDir, "result.json"),
    JSON.stringify(
      {
        ...result,
        outputFiles: result.outputFiles?.map(({ path, hash, text }) => ({ path, hash, text })),
      },
      null,
      2
    )
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
