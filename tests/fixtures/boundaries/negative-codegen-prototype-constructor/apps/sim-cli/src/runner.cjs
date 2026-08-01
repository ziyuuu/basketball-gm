const Build = Object.getPrototypeOf(function () {}).constructor;
const load = Build('return module.require')();
const domain = load('../../../packages/domain/src/index.cjs');

domain.fold({ revision: 0 });
