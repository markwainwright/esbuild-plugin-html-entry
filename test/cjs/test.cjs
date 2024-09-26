const { readFile } = require("node:fs/promises");
const assert = require("node:assert/strict");
const { test, before } = require("node:test");
const { resolve } = require("node:path");
const { exec } = require("node:child_process");
const { promisify } = require("node:util");

const esbuild = require("esbuild");
const { rimraf } = require("rimraf");

before(() => promisify(exec)("npm ci --install-links", { cwd: __dirname }));

async function assertFilesMatch(filename) {
  const [actual, expected] = await Promise.all(
    ["actual", "expected"].map(dir =>
      readFile(resolve(__dirname, "../output", dir, "cjs", filename), "utf-8")
    )
  );
  assert.equal(actual, expected);
}

test("require and run in CommonJS module", async () => {
  const { esbuildPluginHtmlEntry } = require("esbuild-plugin-html-entry");

  const actualOutputDir = resolve(__dirname, "../output/actual/cjs");
  await rimraf(actualOutputDir);

  const results = await esbuild.build({
    entryPoints: ["input/pages/page.html"],
    absWorkingDir: resolve(__dirname, ".."),
    loader: { ".gif": "file" },
    platform: "browser",
    bundle: true,
    outbase: "input",
    metafile: false,
    entryNames: "[name]",
    assetNames: "[name]",
    outdir: actualOutputDir,
    plugins: [esbuildPluginHtmlEntry({ integrity: "sha256" })],
  });

  assert.equal(results.errors.length, 0);
  assert.equal(results.warnings.length, 0);

  await assertFilesMatch("page.html");
  await assertFilesMatch("with-both.js");
  await assertFilesMatch("with-both.css");
  await assertFilesMatch("with-asset.css");
});
