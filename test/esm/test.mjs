import * as assert from "node:assert/strict";
import { exec } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { before, test } from "node:test";
import { promisify } from "node:util";

import esbuild from "esbuild";
import { rimraf } from "rimraf";

before(() => promisify(exec)("npm ci --install-links", { cwd: import.meta.dirname }));

async function assertFilesMatch(filename) {
  const [actual, expected] = await Promise.all(
    ["actual", "expected"].map(dir =>
      readFile(resolve(import.meta.dirname, "../output", dir, "esm", filename), "utf-8")
    )
  );
  assert.equal(actual, expected);
}

test("import and run in ES module", async () => {
  const { esbuildPluginHtmlEntry } = await import("esbuild-plugin-html-entry");

  const actualOutputDir = resolve(import.meta.dirname, "../output/actual/esm");
  await rimraf(actualOutputDir);

  const results = await esbuild.build({
    entryPoints: ["input/pages/page.html"],
    absWorkingDir: resolve(import.meta.dirname, ".."),
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
