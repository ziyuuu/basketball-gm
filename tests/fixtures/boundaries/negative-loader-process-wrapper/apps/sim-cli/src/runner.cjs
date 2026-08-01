/* global __filename, process */

const identity = (value) => value;
const getBuiltinModule = identity(process).getBuiltinModule;
const makeRequire = getBuiltinModule('module').createRequire;
const load = makeRequire(__filename);

load('@sunny-court/domain');
