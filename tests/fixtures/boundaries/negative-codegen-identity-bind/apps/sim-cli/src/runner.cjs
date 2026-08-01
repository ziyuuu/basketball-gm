const identity = (value) => value;
const boundIdentity = identity.bind(null, function () {});
const Build = boundIdentity().constructor;

Build('return 1')();
