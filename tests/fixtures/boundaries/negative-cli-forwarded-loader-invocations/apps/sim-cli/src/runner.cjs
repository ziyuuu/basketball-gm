/* global __filename, process */

const getBuiltinModule = process.getBuiltinModule.bind(null);
const makeRequire = getBuiltinModule.call(null, 'module').createRequire.bind(null);
const load = makeRequire.call(null, __filename);
const domain = load.apply(null, ['@sunny-court/domain']);

domain.fold({ revision: 0 });
