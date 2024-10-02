"use strict";
(() => {
  // test/input/scripts/sub.js
  function sub() {
    console.log("scripts/sub.js");
  }

  // test/input/scripts/nested/nested-with-both.js
  console.log("scripts/nested/nested-with-both.js");
  sub();
})();
