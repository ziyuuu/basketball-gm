const identity = (value) => value;
const Build = Reflect.apply(identity, null, [function () {}]).constructor;

Build('return 1')();
