import { suite } from "node:test";

import { testBuild } from "./helpers/test-build.js";

suite("import language", () => {
  testBuild("typescript", { entryPoints: ["test/input/pages/lang-typescript.html"] });

  testBuild("HTML", {
    entryPoints: ["test/input/pages/lang-html.html"],
    loader: { ".html": "text" },
  });
});
