import { suite } from "node:test";

import { testBuildError } from "./helpers/test-build.js";

suite("validation", () => {
  testBuildError("no outDir", /\[plugin: html-entry\] Must provide outdir/, {
    entryPoints: ["test/input/pages/simple.html"],
    loader: undefined,
    outdir: undefined,
  });
});
