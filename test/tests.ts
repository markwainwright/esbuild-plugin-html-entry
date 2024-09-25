import assert from "node:assert/strict";
import { test } from "node:test";

import { build, testBuild } from "./helpers/test-build.js";

await testBuild("no transitive dependencies", {
  entryPoints: ["input/pages/dead-end.html"],
});

await testBuild(
  "relative public paths",
  {
    entryPoints: ["input/pages/page.html", "input/pages/nested/nested-page.html"],
    entryNames: "entries/[dir]/[name]",
    assetNames: "assets/[dir]/[name]-[hash]",
    chunkNames: "chunks/[dir]/[name]-[hash]",
  },
  {
    subresourceNames: "subresources/[dir]/[name]-[hash]",
  }
);

await testBuild(
  "absolute public paths",
  {
    entryPoints: ["input/pages/page.html", "input/pages/nested/nested-page.html"],
    publicPath: "/absolute-public-paths",
    entryNames: "entries/[dir]/[name]",
    assetNames: "assets/[dir]/[name]-[hash]",
    chunkNames: "chunks/[dir]/[name]-[hash]",
  },
  {
    subresourceNames: "subresources/[dir]/[name]-[hash]",
  }
);

await test("absolute public paths with missing outdir", async t => {
  await assert.rejects(
    () =>
      build(t, {
        entryPoints: ["input/pages/dead-end.html"],
        publicPath: "/foo",
        loader: undefined,
        outdir: undefined,
      }),
    new Error(`Build failed with 1 error:
../src/public-paths.ts:18:12: ERROR: [plugin: html-entry] must provide outdir if publicPath is set`)
  );
});

await testBuild(
  "flat output paths",
  {
    entryPoints: ["input/pages/page.html", "input/pages/nested/nested-page.html"],
    entryNames: "[name]",
    assetNames: "[name]",
    chunkNames: "[name]",
  },
  {
    subresourceNames: "[name]",
  }
);

await testBuild(
  "minify",
  {
    entryPoints: ["input/pages/dead-end.html"],
    minify: true,
  },
  {
    minifyOptions: {
      collapseWhitespace: true,
    },
  }
);

await testBuild(
  "no integrity",
  {
    entryPoints: ["input/pages/dead-end.html"],
  },
  {
    integrity: undefined,
  }
);

await testBuild(
  "mixed entrypoints",
  {
    entryPoints: [
      "input/pages/dead-end.html",
      "input/scripts/with-both.js",
      "input/stylesheets/with-asset.css",
    ],
    entryNames: "entries/[name]",
  },
  {
    integrity: undefined,
  }
);

await testBuild(
  "no write",
  {
    entryPoints: ["input/pages/page.html", "input/pages/nested/nested-page.html"],
    entryNames: "entries/[dir]/[name]",
    assetNames: "assets/[dir]/[name]-[hash]",
    chunkNames: "chunks/[dir]/[name]-[hash]",
    write: false,
  },
  {
    subresourceNames: "subresources/[dir]/[name]-[hash]",
  }
);

await testBuild("duplicate elements", { entryPoints: ["input/pages/duplicate-elements.html"] });

await testBuild("type JS", { entryPoints: ["input/pages/type-js.html"] });

await testBuild("type empty", { entryPoints: ["input/pages/type-empty.html"] });

await testBuild("type other", { entryPoints: ["input/pages/type-other.html"] });

await testBuild("href absolute", { entryPoints: ["input/pages/href-absolute.html"] });

await testBuild("href URL", { entryPoints: ["input/pages/href-url.html"] });

await testBuild("href data", { entryPoints: ["input/pages/href-data.html"] });

await test("href invalid", async t => {
  await assert.rejects(
    () => build(t, { entryPoints: ["input/pages/href-invalid.html"] }),
    new Error(
      `Build failed with 2 errors:
error: Could not resolve "../scripts/whoops.js"
error: Could not resolve "../stylesheets/whoops.css"`
    )
  );
});
