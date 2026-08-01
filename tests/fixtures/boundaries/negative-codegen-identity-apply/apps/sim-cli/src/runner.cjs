const identity = (value) => value;
const Build = identity.apply(null, [function () {}]).constructor;

Build('return 1')();
