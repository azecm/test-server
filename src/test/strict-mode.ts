
// node /usr/local/www/app.back/test/strict-mode.js
// node --use_strict /usr/local/www/app.back/test/strict-mode.js

(function () {
  "use strict";
  console.log('use strict');

  function test(myArg: number) {
    console.log(`${myArg} -- ${arguments[0]}`);
    arguments[0] = 20;
    console.log(`${myArg} -- ${arguments[0]}`);
  }
  test(10);

  //use strict
  //10 -- 10
  //10 -- 20
})();

(function () {
  console.log('NOT use strict');
  function test(myArg: number) {
    console.log(`${myArg} -- ${arguments[0]}`);
    arguments[0] = 20;
    console.log(`${myArg} -- ${arguments[0]}`);
  }
  test(10);

  //NOT use strict
  //10 -- 10
  //20 -- 20
})();
