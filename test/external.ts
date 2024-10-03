import { suite } from "node:test";

import { resolve } from "node:path";
import { testBuild } from "./helpers/test-build.js";

suite("external", () => {
  suite("absolute", () => {
    testBuild("JS", {
      entryPoints: ["test/input/pages/all.html"],
      external: [resolve("test/input/scripts/with-all.js")],
    });

    testBuild("CSS", {
      entryPoints: ["test/input/pages/all.html"],
      external: [resolve("test/input/stylesheets/from-html-with-asset.css")],
    });
  });

  suite("relative", () => {
    testBuild("JS", {
      entryPoints: ["test/input/pages/all.html"],
      external: ["../scripts/with-all.js"],
    });

    testBuild("CSS", {
      entryPoints: ["test/input/pages/all.html"],
      external: ["../stylesheets/from-html-with-asset.css"],
    });
  });
});
