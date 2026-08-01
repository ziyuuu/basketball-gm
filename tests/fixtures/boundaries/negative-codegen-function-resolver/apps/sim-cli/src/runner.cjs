/* global __filename */

const buildLoader = Function(
  'filename',
  "return process.getBuiltinModule('module').createRequire(filename)",
);
const load = buildLoader(__filename);
const domain = load('../../../packages/domain/src/index.cjs');

domain.fold({ revision: 0 });
