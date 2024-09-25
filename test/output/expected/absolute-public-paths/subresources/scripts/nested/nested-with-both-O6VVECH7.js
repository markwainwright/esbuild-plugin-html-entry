"use strict";
(() => {
  // input/scripts/sub.js
  function sub() {
    console.log("scripts/sub.js");
  }

  // input/scripts/nested/nested-with-both.js
  console.log("scripts/nested/nested-with-both.js");
  sub();
})();
