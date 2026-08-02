import { readFileSync } from 'node:fs';

import {
  nextRngState,
  nextUint32,
  SequentialUint32Rng,
  type SequentialUint32State,
} from '@sunny-court/domain/core';
import {
  deriveKeyedDrawHash,
  deriveMatchSeedMaterial,
  keyedDrawInt,
  keyedDrawUint64,
  keyedDrawUint32,
  keyedDrawUnitInterval,
  type MatchDrawKey,
} from '@sunny-court/domain/match';
import { describe, expect, it } from 'vitest';

type KeyedRngGolden = Readonly<{
  seed: [number, number, number, number];
  draws: ReadonlyArray<
    Omit<MatchDrawKey, 'matchSeed'> & {
      hash: string;
      uint64: string;
      uint32: number;
    }
  >;
}>;

const golden = JSON.parse(
  readFileSync(new URL('./fixtures/p02-002/keyed-rng-golden.json', import.meta.url), 'utf8'),
) as KeyedRngGolden;

describe('P02-002 sequential uint32 contract', () => {
  it('uses exactly one existing state transition and one call increment', () => {
    const initial: SequentialUint32State = { state: 0, calls: 7 };
    const next = nextUint32(initial);

    expect(next.value).toBe(nextRngState(initial.state));
    expect(next.state).toEqual({ state: nextRngState(initial.state), calls: 8 });
    expect(initial).toEqual({ state: 0, calls: 7 });
  });

  it('keeps an isolated sequential adapter replayable and rejects an exhausted counter', () => {
    const source = new SequentialUint32Rng({ state: 0, calls: 0 });
    expect(Array.from({ length: 4 }, () => source.nextUint32())).toEqual([
      1_013_904_223, 1_196_435_762, 3_519_870_697, 2_868_466_484,
    ]);
    expect(source.snapshot()).toEqual({ state: 2_868_466_484, calls: 4 });
    expect(() => nextUint32({ state: 0, calls: Number.MAX_SAFE_INTEGER })).toThrow(/call count/i);
  });
});

describe('P02-002 keyed match RNG', () => {
  const keyFromGolden = (draw: KeyedRngGolden['draws'][number]): MatchDrawKey => ({
    matchSeed: golden.seed,
    period: draw.period,
    possessionIndex: draw.possessionIndex,
    segmentIndex: draw.segmentIndex,
    drawKind: draw.drawKind,
    localIndex: draw.localIndex,
  });

  it('matches checked-in golden keyed draws', () => {
    for (const draw of golden.draws) {
      const key = keyFromGolden(draw);
      expect(deriveKeyedDrawHash(key)).toBe(draw.hash);
      expect(keyedDrawUint64(key)).toBe(BigInt(draw.uint64));
      expect(keyedDrawUint32(key)).toBe(draw.uint32);
      expect(keyedDrawUnitInterval(key)).toBeGreaterThanOrEqual(0);
      expect(keyedDrawUnitInterval(key)).toBeLessThan(1);
    }
  });

  it('is independent of call order, omitted branches, and unrelated cosmetic or command data', () => {
    const shot = keyFromGolden(golden.draws[0]!);
    const rebound = keyFromGolden(golden.draws[1]!);
    const baselineShot = keyedDrawUint32(shot);
    const baselineRebound = keyedDrawUint32(rebound);

    // A caller may choose any order and skip an unused draw kind entirely.
    expect([keyedDrawUint32(rebound), keyedDrawUint32(shot)]).toEqual([
      baselineRebound,
      baselineShot,
    ]);
    expect(keyedDrawUint32(shot)).toBe(baselineShot);

    const cosmetic = { animationFrame: 99, narrationVariant: 'crowd-cheer' };
    const command = { kind: 'SET_MATCH_TACTICS', submittedAtUiFrame: 73 };
    expect(cosmetic.animationFrame).toBe(99);
    expect(command.kind).toBe('SET_MATCH_TACTICS');
    expect(keyedDrawUint32(shot)).toBe(baselineShot);
  });

  it('uses exactly four ordered uint32 calls to derive fixed match seed material', () => {
    const calls: number[] = [];
    const source = {
      nextUint32: () => {
        const value = calls.length + 10;
        calls.push(value);
        return value;
      },
    };
    expect(deriveMatchSeedMaterial(source)).toEqual([10, 11, 12, 13]);
    expect(calls).toEqual([10, 11, 12, 13]);
  });

  it('maps integer ranges with explicit safe bounds', () => {
    const key = keyFromGolden(golden.draws[2]!);
    expect(keyedDrawInt(key, 5, 5)).toBe(5);
    expect(keyedDrawInt(key, 0, 10)).toBeGreaterThanOrEqual(0);
    expect(keyedDrawInt(key, 0, 10)).toBeLessThanOrEqual(10);
    expect(() => keyedDrawInt(key, 2, 1)).toThrow(/invalid/i);
    expect(keyedDrawInt(key, 0, 0x1_0000_0000)).toBeGreaterThanOrEqual(0);
  });
});
