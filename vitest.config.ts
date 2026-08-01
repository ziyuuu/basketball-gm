import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  resolve: {
    alias: [
      {
        find: '@sunny-court/application/legacy-p01',
        replacement: fileURLToPath(
          new URL('./packages/application/src/legacy-p01/index.ts', import.meta.url),
        ),
      },
      {
        find: '@sunny-court/application',
        replacement: fileURLToPath(new URL('./packages/application/src/index.ts', import.meta.url)),
      },
      {
        find: '@sunny-court/domain/legacy-p01',
        replacement: fileURLToPath(
          new URL('./packages/domain/src/legacy-p01/index.ts', import.meta.url),
        ),
      },
      {
        find: '@sunny-court/domain',
        replacement: fileURLToPath(new URL('./packages/domain/src/index.ts', import.meta.url)),
      },
      {
        find: '@sunny-court/persistence/legacy-p01',
        replacement: fileURLToPath(
          new URL('./packages/persistence/src/legacy-p01/index.ts', import.meta.url),
        ),
      },
      {
        find: '@sunny-court/persistence',
        replacement: fileURLToPath(new URL('./packages/persistence/src/index.ts', import.meta.url)),
      },
      {
        find: '@sunny-court/persistence-indexeddb/legacy-p01',
        replacement: fileURLToPath(
          new URL('./packages/persistence-indexeddb/src/legacy-p01/index.ts', import.meta.url),
        ),
      },
      {
        find: '@sunny-court/persistence-indexeddb',
        replacement: fileURLToPath(
          new URL('./packages/persistence-indexeddb/src/index.ts', import.meta.url),
        ),
      },
      {
        find: '@sunny-court/persistence-node/legacy-p01',
        replacement: fileURLToPath(
          new URL('./packages/persistence-node/src/legacy-p01/index.ts', import.meta.url),
        ),
      },
      {
        find: '@sunny-court/persistence-node',
        replacement: fileURLToPath(
          new URL('./packages/persistence-node/src/index.ts', import.meta.url),
        ),
      },
    ],
  },
  test: {
    coverage: {
      enabled: false,
    },
    environment: 'node',
    fileParallelism: false,
    include: ['apps/**/*.test.ts', 'packages/**/*.test.ts', 'tests/**/*.test.ts'],
    maxWorkers: 1,
    testTimeout: 30_000,
  },
});
