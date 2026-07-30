import { describe, expect, it } from 'vitest';

import { DeterministicRng } from './rng.js';

describe('deterministic RNG streams', () => {
  it('replays the same stream from the same root seed', () => {
    const left = new DeterministicRng('same-seed');
    const right = new DeterministicRng('same-seed');

    const leftValues = Array.from({ length: 20 }, () => left.nextInt('match', 0, 10_000));
    const rightValues = Array.from({ length: 20 }, () => right.nextInt('match', 0, 10_000));

    expect(leftValues).toEqual(rightValues);
    expect(left.snapshot()).toEqual(right.snapshot());
  });

  it('keeps cosmetic calls isolated from match results', () => {
    const control = new DeterministicRng('stream-isolation');
    const cosmeticHeavy = new DeterministicRng('stream-isolation');

    Array.from({ length: 100 }, () => cosmeticHeavy.nextFloat('cosmetic'));

    const controlMatches = Array.from({ length: 12 }, () => control.nextInt('match', 0, 100));
    const cosmeticHeavyMatches = Array.from({ length: 12 }, () =>
      cosmeticHeavy.nextInt('match', 0, 100),
    );

    expect(cosmeticHeavyMatches).toEqual(controlMatches);
    expect(cosmeticHeavy.calls('cosmetic')).toBe(100);
    expect(control.calls('cosmetic')).toBe(0);
  });

  it('restores call counters and future values from a snapshot', () => {
    const source = new DeterministicRng('snapshot-seed');
    Array.from({ length: 7 }, () => source.nextFloat('training-growth'));
    const restored = DeterministicRng.fromSnapshot(source.snapshot());

    expect(restored.calls('training-growth')).toBe(7);
    expect(restored.nextFloat('training-growth')).toBe(source.nextFloat('training-growth'));
  });
});
