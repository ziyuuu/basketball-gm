const holder = {
  method() {},
};
const Build = holder.method.constructor;

Build('return 1')();
