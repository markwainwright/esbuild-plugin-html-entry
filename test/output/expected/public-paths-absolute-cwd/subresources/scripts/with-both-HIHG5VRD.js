"use strict";
(() => {
  // scripts/sub.js
  function sub() {
    console.log("scripts/sub.js");
  }

  // scripts/with-both.js
  console.log("scripts/with-both.js");
  sub();
})();
