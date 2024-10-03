"use strict";
(() => {
  // test/input/scripts/sub-ts.ts
  function sub() {
    console.log("scripts/sub-ts.ts");
  }

  // test/input/scripts/with-both-ts.ts
  console.log("scripts/with-both-ts.ts");
  sub();
})();
