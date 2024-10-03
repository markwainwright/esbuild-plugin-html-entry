import { suite } from "node:test";

import { testBuild } from "./helpers/test-build.js";

suite("minify", () => {
  suite("enabled", () => {
    testBuild(
      "no lineLimit",
      { entryPoints: ["test/input/pages/simple.html"], minify: true },
      { minifyOptions: { collapseWhitespace: true } }
    );

    testBuild(
      "lineLimit",
      { entryPoints: ["test/input/pages/simple.html"], minify: true, lineLimit: 30 },
      { minifyOptions: { collapseWhitespace: true } }
    );
  });

  suite("disabled", () => {
    testBuild("no lineLimit", { entryPoints: ["test/input/pages/simple.html"], minify: false });

    testBuild("lineLimit", {
      entryPoints: ["test/input/pages/simple.html"],
      minify: false,
      lineLimit: 30,
    });
  });

  testBuild("already", { entryPoints: ["test/input/pages/minified.html"] });
});
