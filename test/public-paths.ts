import { suite } from "node:test";

import { resolve } from "node:path";
import { testBuild } from "./helpers/test-build.js";

suite("public paths", () => {
  suite("relative", () => {
    testBuild(
      "nested",
      {
        entryPoints: ["test/input/pages/all.html", "test/input/pages/nested/nested-all.html"],
        entryNames: "entries/[dir]/[name]",
        assetNames: "assets/[dir]/[name]-[hash]",
      },
      { subresourceNames: "subresources/[dir]/[name]-[hash]" }
    );

    testBuild("flat", {
      entryPoints: ["test/input/pages/all.html", "test/input/pages/nested/nested-all.html"],
    });

    testBuild(
      "absWorkingDir",
      {
        entryPoints: ["pages/all.html", "pages/nested/nested-all.html"],
        entryNames: "entries/[dir]/[name]",
        assetNames: "assets/[dir]/[name]-[hash]",
        absWorkingDir: resolve("test/input"),
        outbase: ".",
      },
      { subresourceNames: "subresources/[dir]/[name]-[hash]" }
    );

    testBuild(
      "outbase",
      {
        entryPoints: ["test/input/pages/all.html", "test/input/pages/nested/nested-all.html"],
        entryNames: "entries/[dir]/[name]",
        assetNames: "assets/[dir]/[name]-[hash]",
        outbase: "test",
      },
      { subresourceNames: "subresources/[dir]/[name]-[hash]" }
    );

    testBuild(
      "no write",
      {
        entryPoints: ["test/input/pages/all.html", "test/input/pages/nested/nested-all.html"],
        entryNames: "entries/[dir]/[name]",
        assetNames: "assets/[dir]/[name]-[hash]",
        write: false,
      },
      { subresourceNames: "subresources/[dir]/[name]-[hash]" }
    );
  });

  suite("absolute", () => {
    testBuild(
      "nested",
      {
        entryPoints: ["test/input/pages/all.html", "test/input/pages/nested/nested-all.html"],
        publicPath: "/public-paths/absolute/nested",
        entryNames: "entries/[dir]/[name]",
        assetNames: "assets/[dir]/[name]-[hash]",
      },
      { subresourceNames: "subresources/[dir]/[name]-[hash]" }
    );

    testBuild(
      "flat",
      {
        entryPoints: ["test/input/pages/all.html", "test/input/pages/nested/nested-all.html"],
        publicPath: "/public-paths/absolute/flat",
      },
      { subresourceNames: "[name]" }
    );

    testBuild(
      "absWorkingDir",
      {
        entryPoints: ["pages/all.html", "pages/nested/nested-all.html"],
        publicPath: "/public-paths/absolute/absworkingdir",
        entryNames: "entries/[dir]/[name]",
        assetNames: "assets/[dir]/[name]-[hash]",
        absWorkingDir: resolve("test/input"),
        outbase: ".",
      },
      { subresourceNames: "subresources/[dir]/[name]-[hash]" }
    );

    testBuild(
      "outbase",
      {
        entryPoints: ["test/input/pages/all.html", "test/input/pages/nested/nested-all.html"],
        publicPath: "/public-paths/absolute/outbase",
        entryNames: "entries/[dir]/[name]",
        assetNames: "assets/[dir]/[name]-[hash]",
        outbase: "test",
      },
      { subresourceNames: "subresources/[dir]/[name]-[hash]" }
    );

    testBuild(
      "no write",
      {
        entryPoints: ["test/input/pages/all.html", "test/input/pages/nested/nested-all.html"],
        publicPath: "/public-paths/absolute/no-write",
        entryNames: "entries/[dir]/[name]",
        assetNames: "assets/[dir]/[name]-[hash]",
        write: false,
      },
      { subresourceNames: "subresources/[dir]/[name]-[hash]" }
    );
  });
});
