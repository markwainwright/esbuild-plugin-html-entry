import * as assert from "node:assert/strict";
import { test } from "node:test";

import { resolve } from "node:path";
import { build, testBuild } from "./helpers/test-build.js";

await testBuild("no transitive dependencies", {
  entryPoints: ["test/input/pages/dead-end.html"],
});

await testBuild(
  "public paths - relative",
  {
    entryPoints: ["test/input/pages/page.html", "test/input/pages/nested/nested-page.html"],
    entryNames: "entries/[dir]/[name]",
    assetNames: "assets/[dir]/[name]-[hash]",
    chunkNames: "chunks/[dir]/[name]-[hash]",
  },
  {
    subresourceNames: "subresources/[dir]/[name]-[hash]",
  }
);

await testBuild(
  "public paths - relative - cwd",
  {
    entryPoints: ["pages/page.html", "pages/nested/nested-page.html"],
    entryNames: "entries/[dir]/[name]",
    assetNames: "assets/[dir]/[name]-[hash]",
    chunkNames: "chunks/[dir]/[name]-[hash]",
    absWorkingDir: resolve("test/input"),
    outbase: ".",
  },
  {
    subresourceNames: "subresources/[dir]/[name]-[hash]",
  }
);

await testBuild(
  "public paths - relative - outbase",
  {
    entryPoints: ["test/input/pages/page.html", "test/input/pages/nested/nested-page.html"],
    entryNames: "entries/[dir]/[name]",
    assetNames: "assets/[dir]/[name]-[hash]",
    chunkNames: "chunks/[dir]/[name]-[hash]",
    outbase: "test",
  },
  {
    subresourceNames: "subresources/[dir]/[name]-[hash]",
  }
);

await testBuild(
  "public paths - absolute",
  {
    entryPoints: ["test/input/pages/page.html", "test/input/pages/nested/nested-page.html"],
    publicPath: "/public-paths-absolute",
    entryNames: "entries/[dir]/[name]",
    assetNames: "assets/[dir]/[name]-[hash]",
    chunkNames: "chunks/[dir]/[name]-[hash]",
  },
  {
    subresourceNames: "subresources/[dir]/[name]-[hash]",
  }
);

await testBuild(
  "public paths - absolute - cwd",
  {
    entryPoints: ["pages/page.html", "pages/nested/nested-page.html"],
    publicPath: "/public-paths-absolute-cwd",
    entryNames: "entries/[dir]/[name]",
    assetNames: "assets/[dir]/[name]-[hash]",
    chunkNames: "chunks/[dir]/[name]-[hash]",
    absWorkingDir: resolve("test/input"),
    outbase: ".",
  },
  {
    subresourceNames: "subresources/[dir]/[name]-[hash]",
  }
);

await testBuild(
  "public paths - absolute - outbase",
  {
    entryPoints: ["test/input/pages/page.html", "test/input/pages/nested/nested-page.html"],
    publicPath: "/public-paths-absolute-outbase",
    entryNames: "entries/[dir]/[name]",
    assetNames: "assets/[dir]/[name]-[hash]",
    chunkNames: "chunks/[dir]/[name]-[hash]",
    outbase: "test",
  },
  {
    subresourceNames: "subresources/[dir]/[name]-[hash]",
  }
);

await test("public paths - absolute - missing outdir", async t => {
  await assert.rejects(() =>
    build(t, {
      entryPoints: ["test/input/pages/dead-end.html"],
      publicPath: "/foo",
      loader: undefined,
      outdir: undefined,
    })
  );
});

await testBuild(
  "output paths - flat",
  {
    entryPoints: ["test/input/pages/page.html", "test/input/pages/nested/nested-page.html"],
  },
  {
    subresourceNames: "[name]",
  }
);

await testBuild(
  "minified output",
  {
    entryPoints: ["test/input/pages/dead-end.html"],
    minify: true,
  },
  {
    minifyOptions: {
      collapseWhitespace: true,
    },
  }
);

await testBuild(
  "minified output - line limit",
  {
    entryPoints: ["test/input/pages/dead-end.html"],
    minify: true,
    lineLimit: 30,
  },
  {
    minifyOptions: {
      collapseWhitespace: true,
    },
  }
);

await testBuild("minified input", { entryPoints: ["test/input/pages/minified.html"] });

await testBuild("typescript", { entryPoints: ["test/input/pages/typescript.html"] });

await testBuild("elements - body", { entryPoints: ["test/input/pages/elements-body.html"] });

await testBuild("elements - body - minified", {
  entryPoints: ["test/input/pages/elements-body-minified.html"],
});

await testBuild("elements - duplicated", {
  entryPoints: ["test/input/pages/elements-duplicated.html"],
});

await testBuild(
  "no integrity",
  {
    entryPoints: ["test/input/pages/dead-end.html"],
  },
  {
    integrity: undefined,
  }
);

await testBuild(
  "mixed entrypoints",
  {
    entryPoints: [
      "test/input/pages/dead-end.html",
      "test/input/scripts/with-both.js",
      "test/input/stylesheets/with-asset.css",
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
    entryPoints: ["test/input/pages/page.html", "test/input/pages/nested/nested-page.html"],
    entryNames: "entries/[dir]/[name]",
    assetNames: "assets/[dir]/[name]-[hash]",
    chunkNames: "chunks/[dir]/[name]-[hash]",
    write: false,
  },
  {
    subresourceNames: "subresources/[dir]/[name]-[hash]",
  }
);

await testBuild(
  "banner and footer",
  {
    entryPoints: ["test/input/pages/dead-end.html"],
    banner: { js: "// banner", css: "/* banner */" },
    footer: { js: "// footer", css: "/* footer */" },
  },
  { banner: "<!-- banner -->", footer: "<!-- footer -->" }
);

await testBuild(
  "banner and footer - minify",
  {
    entryPoints: ["test/input/pages/dead-end.html"],
    minify: true,
    banner: { js: "// banner", css: "/* banner */" },
    footer: { js: "// footer", css: "/* footer */" },
  },
  {
    banner: "<!-- banner -->",
    footer: "<!-- footer -->",
    minifyOptions: { collapseWhitespace: true },
  }
);

await testBuild(
  "splitting",
  {
    entryPoints: [
      "test/input/pages/splitting.html",
      "test/input/pages/splitting2.html",
      "test/input/pages/splitting3.html",
    ],
    format: "esm",
    splitting: true,
    entryNames: "entries/[dir]/[name]",
    assetNames: "assets/[dir]/[name]-[hash]",
    chunkNames: "chunks/[dir]/[name]-[hash]",
  },
  {
    subresourceNames: "subresources/[dir]/[name]-[hash]",
  },
  { only: true }
);

await testBuild("external - absolute - CSS", {
  entryPoints: ["test/input/pages/page.html"],
  external: [resolve("test/input/stylesheets/with-asset.css")],
});

await testBuild("external - relative - CSS", {
  entryPoints: ["test/input/pages/page.html"],
  external: ["../stylesheets/with-asset.css"],
});

await testBuild("external - absolute - JS", {
  entryPoints: ["test/input/pages/page.html"],
  external: [resolve("test/input/scripts/with-both.js")],
});

await testBuild("external - relative - JS", {
  entryPoints: ["test/input/pages/page.html"],
  external: ["../scripts/with-both.js"],
});

await testBuild("type - JS", { entryPoints: ["test/input/pages/type-js.html"] });

await testBuild("type - empty", { entryPoints: ["test/input/pages/type-empty.html"] });

await testBuild("type - module", { entryPoints: ["test/input/pages/type-module.html"] });

await testBuild("type - other", { entryPoints: ["test/input/pages/type-other.html"] });

await testBuild("href - absolute", { entryPoints: ["test/input/pages/href-absolute.html"] });

await testBuild("href - URL", { entryPoints: ["test/input/pages/href-url.html"] });

await testBuild("href - data", { entryPoints: ["test/input/pages/href-data.html"] });

await test("href - invalid", async t => {
  await assert.rejects(() => build(t, { entryPoints: ["test/input/pages/href-invalid.html"] }));
});
