/* global __filename, module */

const getBuiltinModule = module.require('node:process').getBuiltinModule;
const makeRequire = getBuiltinModule('module').createRequire;
const load = makeRequire(__filename);
const domain = load('@sunny-court/domain');

domain.fold({ revision: 0 });
