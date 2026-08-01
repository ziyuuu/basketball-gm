const identity = (value) => value;
const Build = identity(function () {}).constructor;

Build('return 1')();
