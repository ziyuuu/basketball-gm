const runtime = globalThis;
const load = runtime.require;
const { fold: execute } = load('@sunny-court/domain');

execute({ revision: 0 });
