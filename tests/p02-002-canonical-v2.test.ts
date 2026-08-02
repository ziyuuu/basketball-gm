import { readFileSync } from 'node:fs';

import {
  canonicalV2Hash,
  canonicalizeV2,
  compareUtf16CodeUnits,
  sha256Hex,
  sortUtf16CodeUnitKeys,
  type CanonicalV2Value,
} from '@sunny-court/domain/core';
import { describe, expect, it } from 'vitest';

type CanonicalGolden = Readonly<{
  cases: ReadonlyArray<{
    name: string;
    input: CanonicalV2Value;
    equivalentInput: CanonicalV2Value;
    canonical: string;
    hash: string;
  }>;
}>;

const golden = JSON.parse(
  readFileSync(new URL('./fixtures/p02-002/canonical-v2-golden.json', import.meta.url), 'utf8'),
) as CanonicalGolden;

describe('P02-002 Canonical V2', () => {
  it('matches the checked-in UTF-16 and object-order golden fixtures', () => {
    for (const fixture of golden.cases) {
      expect(canonicalizeV2(fixture.input), fixture.name).toBe(fixture.canonical);
      expect(canonicalizeV2(fixture.equivalentInput), fixture.name).toBe(fixture.canonical);
      expect(canonicalV2Hash(fixture.input), fixture.name).toBe(fixture.hash);
      expect(canonicalV2Hash(fixture.equivalentInput), fixture.name).toBe(fixture.hash);
    }
  });

  it('uses JavaScript UTF-16 code-unit ordering, including combining and surrogate-pair keys', () => {
    expect(sortUtf16CodeUnitKeys(['😀', '中', 'é', 'é', '𐀀', 'ascii'])).toEqual([
      'ascii',
      'é',
      'é',
      '中',
      '𐀀',
      '😀',
    ]);
    expect(compareUtf16CodeUnits('𐀀', '😀')).toBeLessThan(0);
  });

  it('uses a portable SHA-256 implementation with the standard abc vector', () => {
    expect(sha256Hex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  it('rejects values that cannot have a portable closed canonical representation', () => {
    expect(() =>
      canonicalizeV2({ undefinedValue: undefined } as unknown as CanonicalV2Value),
    ).toThrow(/undefined/i);
    expect(() => canonicalizeV2(Number.NaN)).toThrow(/non-finite/i);
    expect(() => canonicalizeV2('\ud800')).toThrow(/surrogate/i);
    expect(() => canonicalizeV2({ ['\ud800']: 'bad key' })).toThrow(/surrogate/i);

    const cyclic: { self?: unknown } = {};
    cyclic.self = cyclic;
    expect(() => canonicalizeV2(cyclic as CanonicalV2Value)).toThrow(/cyclic/i);
  });
});
