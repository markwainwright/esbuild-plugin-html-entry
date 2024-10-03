import { suite } from "node:test";

import { testBuild } from "./helpers/test-build.js";

suite("options", () => {
  suite("integrity", () => {
    suite("sha256", () => {
      testBuild(
        "write",
        { entryPoints: ["test/input/pages/simple.html"] },
        { integrity: "sha256" }
      );

      testBuild(
        "no-write",
        { entryPoints: ["test/input/pages/simple.html"], write: false },
        { integrity: "sha256" }
      );
    });

    suite("sha384", () => {
      testBuild(
        "write",
        { entryPoints: ["test/input/pages/simple.html"] },
        { integrity: "sha384" }
      );

      testBuild(
        "no write",
        { entryPoints: ["test/input/pages/simple.html"], write: false },
        { integrity: "sha384" }
      );
    });

    suite("sha512", () => {
      testBuild(
        "write",
        { entryPoints: ["test/input/pages/simple.html"] },
        { integrity: "sha512" }
      );

      testBuild(
        "no write",
        { entryPoints: ["test/input/pages/simple.html"], write: false },
        { integrity: "sha512" }
      );
    });
  });

  suite("banner and footer", () => {
    testBuild(
      "no minify",
      {
        entryPoints: ["test/input/pages/simple.html"],
        banner: { js: "// banner", css: "/* banner */" },
        footer: { js: "// footer", css: "/* footer */" },
      },
      { banner: "<!-- banner -->", footer: "<!-- footer -->" }
    );

    testBuild(
      "minify",
      {
        entryPoints: ["test/input/pages/simple.html"],
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
  });
});
