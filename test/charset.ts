import { suite } from "node:test";

import { testBuild } from "./helpers/test-build.js";

suite("charset", () => {
  testBuild("default", { entryPoints: ["test/input/pages/charset.html"] });
  testBuild("ascii", { entryPoints: ["test/input/pages/charset.html"], charset: "ascii" });
  testBuild("utf8", { entryPoints: ["test/input/pages/charset.html"], charset: "utf8" });
});
