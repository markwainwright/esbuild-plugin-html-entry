import { suite } from "node:test";

import { testBuild } from "./helpers/test-build.js";

suite("entryPoints", () => {
  testBuild(
    "mixed",
    {
      entryPoints: [
        "test/input/pages/simple.html",
        "test/input/scripts/with-both.js",
        "test/input/stylesheets/from-html-with-asset.css",
      ],
      entryNames: "entries/[name]",
      platform: "browser",
    },
    { integrity: undefined }
  );

  testBuild(
    "objects",
    {
      entryPoints: [
        { in: "test/input/pages/simple.html", out: "custom-outname" },
        { in: "test/input/pages/simple-2.html", out: "nested/custom/outdir/custom-outname" },
      ],
      entryNames: "entries/[dir]/[name]",
    },
    { integrity: undefined }
  );
});
