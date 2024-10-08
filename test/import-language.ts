import { suite } from "node:test";

import { testBuild } from "./helpers/test-build.js";

suite("import language", () => {
  testBuild("typescript", { entryPoints: ["test/input/pages/lang-typescript.html"] });

  suite("HTML", () => {
    suite("via subresource", () => {
      testBuild("file loader", {
        entryPoints: ["test/input/pages/lang-html.html"],
        loader: { ".html": "file" },
      });

      testBuild("text loader", {
        entryPoints: ["test/input/pages/lang-html.html"],
        loader: { ".html": "text" },
      });
    });

    suite("via entrypoint", () => {
      testBuild("file loader", {
        entryPoints: ["test/input/pages/simple.html", "test/input/scripts/with-html.js"],
        loader: { ".html": "file" },
      });

      testBuild("text loader", {
        entryPoints: ["test/input/pages/simple.html", "test/input/scripts/with-html.js"],
        loader: { ".html": "text" },
      });
    });
  });
});
