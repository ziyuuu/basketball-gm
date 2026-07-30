import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      '@sunny-court/application': fileURLToPath(
        new URL('./packages/application/src/index.ts', import.meta.url),
      ),
      '@sunny-court/domain': fileURLToPath(
        new URL('./packages/domain/src/index.ts', import.meta.url),
      ),
      '@sunny-court/persistence': fileURLToPath(
        new URL('./packages/persistence/src/index.ts', import.meta.url),
      ),
      '@sunny-court/persistence-indexeddb': fileURLToPath(
        new URL('./packages/persistence-indexeddb/src/index.ts', import.meta.url),
      ),
      '@sunny-court/persistence-node': fileURLToPath(
        new URL('./packages/persistence-node/src/index.ts', import.meta.url),
      ),
    },
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
