import type { createRequire } from 'node:module';

export type LoaderFactory = typeof createRequire;

// The checker must leave type-only global references outside its runtime capability graph.
// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
export type Callback = Function;
export type FunctionConstructorType = typeof Function;
