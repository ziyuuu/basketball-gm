const holder = {
  method() {},
};
let key = 'method';
const Build = Reflect.get(holder, key).constructor;

Build('return 1')();
