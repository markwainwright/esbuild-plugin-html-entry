"use strict";
(() => {
  // test/input/pages/dead-end.html
  var dead_end_default = '<!doctype html>\n<html>\n  <head>\n    <link rel="stylesheet" href="../stylesheets/with-none.css" />\n    <script src="../scripts/with-none.js"><\/script>\n  </head>\n  <body>\n    Hello world\n  </body>\n</html>\n';

  // test/input/scripts/js-import-html.js
  console.log("html:", dead_end_default);
})();
