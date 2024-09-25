"use strict";
(() => {
  // input/scripts/sub.js
  function sub() {
    console.log("scripts/sub.js");
  }

  // input/scripts/with-both.js
  console.log("scripts/with-both.js");
  sub();
})();
