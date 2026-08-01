import { getBuiltinModule as loadBuiltin } from 'node:process';

const createRequire = process.getBuiltinModule('module').createRequire;
void loadBuiltin('module');
const requireFromHere = createRequire(import.meta.url);
const domain = requireFromHere('@sunny-court/domain');

domain.fold({ revision: 0 });
