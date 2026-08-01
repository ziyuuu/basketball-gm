/* global __dirname, module */

const { fold: execute } = module.constructor._load(
  __dirname + '/../../../packages/domain/src/index.cjs',
);

execute({ revision: 0 });
