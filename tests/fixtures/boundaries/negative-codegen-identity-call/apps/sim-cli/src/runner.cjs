const identity = (value) => value;
const Build = identity.call(null, function () {}).constructor;

Build('return 1')();
