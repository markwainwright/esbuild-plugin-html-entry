"use strict";
(() => {
  // test/input/pages/simple.html
  var simple_default = '<!doctype html>\n<html>\n  <head>\n    <link href="../stylesheets/from-html-without-asset.css" rel="stylesheet" />\n    <script src="../scripts/with-none.js"><\/script>\n  </head>\n  <body>\n    simple.html\n  </body>\n</html>\n';

  // test/input/scripts/with-html.js
  console.log("scripts/with-html.js", simple_default);
})();
