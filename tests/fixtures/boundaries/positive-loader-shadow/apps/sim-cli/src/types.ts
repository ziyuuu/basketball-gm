import type { createRequire } from 'node:module';

export type LoaderFactory = typeof createRequire;
