import { defineConfig } from 'tsup';

export default defineConfig({
  clean: true,
  entry: ['src/cli.ts'],
  format: ['esm'],
  noExternal: [/^@sunny-court\//],
  platform: 'node',
  target: 'node24',
});
