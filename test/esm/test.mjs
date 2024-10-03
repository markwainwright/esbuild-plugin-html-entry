import { exec } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { suite, test } from "node:test";
import { promisify } from "node:util";

import esbuild from "esbuild";
import { rimraf } from "rimraf";

async function assertFilesMatch(testContext, filename) {
  const [actual, expected] = await Promise.all(
    ["actual", "expected"].map(dir =>
      readFile(resolve("test/output", dir, "module/esm", filename), "utf-8")
    )
  );
  testContext.assert.strictEqual(actual, expected);
}

suite("module ESM", () => {
  test("run", async testContext => {
    await promisify(exec)("npm ci --install-links --omit=peer", { cwd: resolve("test/esm") });
    const { esbuildPluginHtmlEntry } = await import("esbuild-plugin-html-entry");

    const actualOutputDir = resolve("test/output/actual/module/esm");
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
