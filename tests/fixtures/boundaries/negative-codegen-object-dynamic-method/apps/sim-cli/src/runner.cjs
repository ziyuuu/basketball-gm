const holder = {
  method() {},
};
let key = 'method';
const Build = holder[key].constructor;

Build('return 1')();
