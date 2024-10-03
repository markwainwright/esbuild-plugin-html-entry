import { suite } from "node:test";

import { testBuild } from "./helpers/test-build.js";

suite("extensions", () => {
  testBuild("htm", { entryPoints: ["test/input/pages/simple.htm"] });
});
