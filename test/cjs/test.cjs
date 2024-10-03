const { readFile } = require("node:fs/promises");
const { suite, test } = require("node:test");
const { resolve } = require("node:path");
const { exec } = require("node:child_process");
const { promisify } = require("node:util");

const esbuild = require("esbuild");
const { rimraf } = require("rimraf");

async function assertFilesMatch(testContext, filename) {
  const [actual, expected] = await Promise.all(
    ["actual", "expected"].map(dir =>
      readFile(resolve("test/output", dir, "module/cjs", filename), "utf-8")
    )
  );
  testContext.assert.strictEqual(actual, expected);
}

suite("module CommonJS", () => {
  test("run", async testContext => {
    await promisify(exec)("npm ci --install-links --omit=peer", { cwd: resolve("test/cjs") });
    const { esbuildPluginHtmlEntry } = require("esbuild-plugin-html-entry");

    const actualOutputDir = resolve("test/output/actual/module/cjs");
    await rimraf(actualOutputDir);

    const results = await esbuild.build({
      entryPoints: ["input/pages/all.html"],
      absWorkingDir: resolve("test"),
      loader: { ".gif": "file" },
      platform: "browser",
      bundle: true,
      outbase: "input",
      metafile: false,
      entryNames: "[name]",
      assetNames: "[name]",
      outdir: actualOutputDir,
      plugins: [esbuildPluginHtmlEntry()],
    });

    testContext.assert.strictEqual(results.errors.length, 0);
    testContext.assert.strictEqual(results.warnings.length, 0);

    await assertFilesMatch(testContext, "all.html");
    await assertFilesMatch(testContext, "with-all.js");
    await assertFilesMatch(testContext, "with-all.css");
    await assertFilesMatch(testContext, "from-html-with-asset.css");
  });
});
