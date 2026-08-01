/* eslint-disable @typescript-eslint/no-array-constructor */
/* global module */

const boundRequire = module.require.bind(module);
const constructorArguments = new Array(boundRequire, {});
const load = Reflect.construct(Proxy, constructorArguments);
const domain = load('../../../packages/domain/src/index.cjs');

domain.fold({ revision: 0 });
