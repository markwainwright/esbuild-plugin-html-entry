"use strict";
(() => {
  // scripts/sub.js
  function sub() {
    console.log("scripts/sub.js");
  }

  // scripts/with-all.js
  console.log("scripts/with-all.js");
  sub();
})();
