const identity = (value) => value;
const argumentsList = [function () {}];
const Build = identity.apply(null, argumentsList).constructor;

Build('return 1')();
