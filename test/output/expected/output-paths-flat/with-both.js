"use strict";
(() => {
  // test/input/scripts/sub.js
  function sub() {
    console.log("scripts/sub.js");
  }

  // test/input/scripts/with-both.js
  console.log("scripts/with-both.js");
  sub();
})();
