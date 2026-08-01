/* global module */

const load = new WeakRef(module.require.bind(module)).deref();
const domain = load('../../../packages/domain/src/index.cjs');

domain.fold({ revision: 0 });
