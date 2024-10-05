import { suite } from "node:test";

import { testBuild } from "./helpers/test-build.js";

suite("minify", () => {
  suite("enabled", () => {
    suite("default options", () => {
      testBuild("no lineLimit", { entryPoints: ["test/input/pages/simple.html"], minify: true });

      testBuild("lineLimit", {
        entryPoints: ["test/input/pages/simple.html"],
        minify: true,
        lineLimit: 30,
      });
    });

    suite("custom options", () => {
      testBuild(
        "no lineLimit",
        { entryPoints: ["test/input/pages/simple.html"], minify: true },
        { minifyOptions: { collapseWhitespace: true, removeAttributeQuotes: true } }
      );

      testBuild(
        "lineLimit",
        { entryPoints: ["test/input/pages/simple.html"], minify: true, lineLimit: 30 },
        { minifyOptions: { collapseWhitespace: true, removeAttributeQuotes: true } }
      );
    });
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
