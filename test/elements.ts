import { suite } from "node:test";

import { testBuild, testBuildError } from "./helpers/test-build.js";

suite("elements", () => {
  testBuild("body", { entryPoints: ["test/input/pages/elements-body.html"] });
  testBuild("body, minified", { entryPoints: ["test/input/pages/elements-body-minified.html"] });
  testBuild("duplicated", { entryPoints: ["test/input/pages/elements-duplicated.html"] });

  suite("href", () => {
    testBuild("absolute", { entryPoints: ["test/input/pages/elements-href-absolute.html"] }, {}, 0);
    testBuild("data", { entryPoints: ["test/input/pages/elements-href-data.html"] }, {}, 0);
    testBuild("URL", { entryPoints: ["test/input/pages/elements-href-url.html"] }, {}, 0);

    testBuildError("invalid", /Build failed with 2 errors:/, {
      entryPoints: ["test/input/pages/elements-href-invalid.html"],
    });
  });

  suite("link", () => {
    testBuild(
      "rel other",
      { entryPoints: ["test/input/pages/elements-link-rel-other.html"] },
      {},
      0
    );
  });

  suite("script", () => {
    testBuild("nomodule", { entryPoints: ["test/input/pages/elements-script-nomodule.html"] });
    testBuild("type module", {
      entryPoints: ["test/input/pages/elements-script-type-module.html"],
    });
  });

  suite("type", () => {
    testBuild("explicit", { entryPoints: ["test/input/pages/elements-type-explicit.html"] });
    testBuild("empty", { entryPoints: ["test/input/pages/elements-type-empty.html"] });
    testBuild("other", { entryPoints: ["test/input/pages/elements-type-other.html"] });
  });
});
