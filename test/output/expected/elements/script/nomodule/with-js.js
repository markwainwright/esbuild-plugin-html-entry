"use strict";
(() => {
  // test/input/scripts/sub.js
  function sub() {
    console.log("scripts/sub.js");
  }

  // test/input/scripts/with-js.js
  console.log("scripts/with-js.js");
  sub();
})();
