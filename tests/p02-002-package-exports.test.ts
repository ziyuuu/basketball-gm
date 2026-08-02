import * as core from '@sunny-court/domain/core';
import * as domainRoot from '@sunny-court/domain';
import * as legacyP01 from '@sunny-court/domain/legacy-p01';
import * as match from '@sunny-court/domain/match';
import { describe, expect, it } from 'vitest';

describe('P02-002 package exports', () => {
  it('adds explicit core and match subpaths without changing the Legacy P01 root entrypoint', () => {
    expect(core.canonicalizeV2).toBeTypeOf('function');
    expect(core.nextUint32).toBeTypeOf('function');
    expect(match.MatchInputSchema.safeParse).toBeTypeOf('function');
    expect(match.keyedDrawUint32).toBeTypeOf('function');

    expect(Object.keys(domainRoot).sort()).toEqual(Object.keys(legacyP01).sort());
    expect('MatchInputSchema' in domainRoot).toBe(false);
    expect('keyedDrawUint32' in domainRoot).toBe(false);
  });

  it('declares the exact package export paths consumed by the protocol-only layer', () => {
    const manifest = JSON.parse(
      readFileSync(new URL('../packages/domain/package.json', import.meta.url), 'utf8'),
    ) as { exports: Record<string, string> };

    expect(manifest.exports).toMatchObject({
      '.': './src/index.ts',
      './legacy-p01': './src/legacy-p01/index.ts',
      './core': './src/core/index.ts',
      './match': './src/match/index.ts',
    });
  });
});
import { readFileSync } from 'node:fs';
