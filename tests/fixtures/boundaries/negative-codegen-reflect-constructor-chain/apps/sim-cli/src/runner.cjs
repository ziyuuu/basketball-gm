const RuntimeFunction = Reflect.constructor;
const Build = RuntimeFunction.constructor;
const load = Build(
  'return process.getBuiltinModule("module").createRequire(process.cwd() + "/apps/sim-cli/src/runner.cjs")',
)();
const { fold: execute } = load('../../../packages/domain/src/index.cjs');

execute({ revision: 0 });
