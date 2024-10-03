"use strict";
(() => {
  // input/scripts/sub.js
  function sub() {
    console.log("scripts/sub.js");
  }

  // input/scripts/with-all.js
  console.log("scripts/with-all.js");
  sub();
})();
