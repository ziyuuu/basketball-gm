const holder = {
  method: function () {},
};
const Build = holder.method.constructor;

Build('return 1')();
