import { suite } from "node:test";

import { testBuild, testBuildError } from "./helpers/test-build.js";

function tests(write: boolean) {
  testBuild(
    "same file",
    {
      entryPoints: ["test/input/pages/splitting.html"],
      format: "esm",
      splitting: true,
      write,
      entryNames: "entries/[name]",
      chunkNames: "chunks/[name]-[hash]",
    },
    { subresourceNames: "subresources/[name]-[hash]" }
  );

  testBuild(
    "different files",
    {
      entryPoints: ["test/input/pages/splitting-1.html", "test/input/pages/splitting-2.html"],
      format: "esm",
      splitting: true,
      write,
      entryNames: "entries/[name]",
      chunkNames: "chunks/[name]-[hash]",
    },
    { subresourceNames: "subresources/[name]-[hash]" }
  );

  testBuild(
    "mixed",
    {
      entryPoints: ["test/input/pages/splitting-mixed.html"],
      format: "esm",
      splitting: true,
      write,
      entryNames: "entries/[name]",
      chunkNames: "chunks/[name]-[hash]",
    },
    { subresourceNames: "subresources/[name]-[hash]" }
  );

  testBuild(
    "mixed overlapping",
    {
      entryPoints: ["test/input/pages/splitting-mixed-overlapping.html"],
      format: "esm",
      splitting: true,
      write,
      entryNames: "entries/[name]",
      chunkNames: "chunks/[name]-[hash]",
      assetNames: "assets/[name]-[hash]",
    },
    { subresourceNames: "subresources/[name]-[hash]" }
  );

  testBuildError(
    "mixed overlapping collisions",
    /Two output files share the same path but have different contents: test\/output\/actual\/splitting\/.+\/mixed-overlapping-collisions\/subresources\/with-all\.js/,
    {
      entryPoints: ["test/input/pages/splitting-mixed-overlapping.html"],
      format: "esm",
      splitting: true,
      write,
      entryNames: "entries/[name]",
      chunkNames: "chunks/[name]-[hash]",
      assetNames: "assets/[name]",
    },
    { subresourceNames: "subresources/[name]" }
  );
}

suite("splitting", () => {
  suite("write enabled", () => tests(true));
  suite("write disabled", () => tests(false));
});
