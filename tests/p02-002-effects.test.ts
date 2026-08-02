import {
  decrementEffectsAfterCommittedPossession,
  deriveEffectKey,
  mergeMatchEffects,
  replaceMatchEffect,
  selectActiveMatchEffects,
  MatchEffectSchema,
  type MatchEffect,
} from '@sunny-court/domain/match';
import { describe, expect, it } from 'vitest';

function makeEffect(overrides: Partial<MatchEffect> = {}): MatchEffect {
  const source =
    overrides.source ??
    ({ kind: 'BASE_TACTIC', sourceId: 'home-base', reasonCode: 'HOME_TACTIC_BASELINE' } as const);
  const target =
    overrides.target ?? ({ side: 'HOME', scope: 'TEAM', playerId: null, behavior: null } as const);
  const parameter = overrides.parameter ?? 'PACE';
  return MatchEffectSchema.parse({
    source,
    target,
    parameter,
    effectKey: overrides.effectKey ?? deriveEffectKey({ source, target, parameter }),
    sourceRevision: overrides.sourceRevision ?? 1,
    controlBoundary:
      overrides.controlBoundary ??
      ({ kind: 'MATCH_START', period: 1, possessionIndex: 0, segmentIndex: 0 } as const),
    effectiveFromSegmentKey:
      overrides.effectiveFromSegmentKey ??
      ({ period: 1, possessionIndex: 0, segmentIndex: 0 } as const),
    modifier: overrides.modifier ?? { mode: 'ADD', valueMilli: 250 },
    duration: overrides.duration ?? { kind: 'UNTIL_REPLACED' },
  });
}

describe('P02-002 generic match effect contracts', () => {
  it('uses a stable key and replaces same-key revisions instead of stacking them', () => {
    const first = makeEffect({ modifier: { mode: 'ADD', valueMilli: 100 }, sourceRevision: 1 });
    const replacement = makeEffect({
      modifier: { mode: 'ADD', valueMilli: 700 },
      sourceRevision: 2,
    });

    expect(replacement.effectKey).toBe(first.effectKey);
    expect(replaceMatchEffect([first], replacement)).toEqual([replacement]);
    expect(selectActiveMatchEffects([replacement, first])).toEqual([replacement]);
  });

  it('binds a factual reason and exact activation boundary without making the reason a stack key', () => {
    const original = makeEffect({
      source: {
        kind: 'BASE_TACTIC',
        sourceId: 'home-base',
        reasonCode: 'INITIAL_TACTIC_SELECTION',
      },
    });
    const replacementReason = makeEffect({
      source: {
        kind: 'BASE_TACTIC',
        sourceId: 'home-base',
        reasonCode: 'DEAD_BALL_TACTIC_SELECTION',
      },
      sourceRevision: 2,
    });

    expect(replacementReason.effectKey).toBe(original.effectKey);
    expect(
      MatchEffectSchema.safeParse({
        ...original,
        effectiveFromSegmentKey: { period: 2, possessionIndex: 0, segmentIndex: 0 },
      }).success,
    ).toBe(false);
  });

  it('rejects conflicting definitions at a same key and source revision', () => {
    const first = makeEffect({ modifier: { mode: 'ADD', valueMilli: 100 } });
    const conflicting = makeEffect({ modifier: { mode: 'ADD', valueMilli: 200 } });

    expect(() => selectActiveMatchEffects([first, conflicting])).toThrow(/conflicting/i);
  });

  it('merges different sources in stable key order with explicit additive and multiplier caps', () => {
    const tactic = makeEffect({
      source: { kind: 'BASE_TACTIC', sourceId: 'z-tactic', reasonCode: 'TACTIC_AXIS' },
      modifier: { mode: 'ADD', valueMilli: 5_000 },
    });
    const policy = makeEffect({
      source: { kind: 'OPPONENT_POLICY', sourceId: 'a-policy', reasonCode: 'POLICY_RESPONSE' },
      modifier: { mode: 'ADD', valueMilli: 2_000 },
    });
    const firstMultiplier = makeEffect({
      source: { kind: 'OPPONENT_POLICY', sourceId: 'm-one', reasonCode: 'POLICY_MULTIPLIER' },
      modifier: { mode: 'MULTIPLY', multiplierMilli: 1_100 },
    });
    const secondMultiplier = makeEffect({
      source: { kind: 'OPPONENT_POLICY', sourceId: 'm-two', reasonCode: 'POLICY_MULTIPLIER' },
      modifier: { mode: 'MULTIPLY', multiplierMilli: 1_100 },
    });

    const mergedForward = mergeMatchEffects([tactic, policy, firstMultiplier, secondMultiplier]);
    const mergedReverse = mergeMatchEffects([secondMultiplier, firstMultiplier, policy, tactic]);

    expect(mergedForward).toEqual(mergedReverse);
    expect(mergedForward).toHaveLength(1);
    expect(mergedForward[0]).toMatchObject({ additiveMilli: 6_000, multiplierMilli: 1_210 });
    expect(mergedForward[0]?.effectKeys).toEqual(
      [...mergedForward[0]!.effectKeys].sort((left, right) =>
        left < right ? -1 : left > right ? 1 : 0,
      ),
    );
  });

  it('decrements possession durations only after a successfully committed possession', () => {
    const expiring = makeEffect({
      duration: { kind: 'POSSESSIONS', remainingPossessions: 2 },
    });
    const singleUse = makeEffect({
      source: {
        kind: 'OPPONENT_POLICY',
        sourceId: 'single-use',
        reasonCode: 'ONE_POSSESSION_WINDOW',
      },
      duration: { kind: 'POSSESSIONS', remainingPossessions: 1 },
    });

    expect(decrementEffectsAfterCommittedPossession([expiring, singleUse], false)).toEqual(
      selectActiveMatchEffects([expiring, singleUse]),
    );
    expect(decrementEffectsAfterCommittedPossession([expiring, singleUse], true)).toEqual([
      expect.objectContaining({
        effectKey: expiring.effectKey,
        duration: { kind: 'POSSESSIONS', remainingPossessions: 1 },
      }),
    ]);
  });

  it('accepts only base tactic/effect sources and never Card semantics', () => {
    const effect = makeEffect();
    expect(
      MatchEffectSchema.safeParse({ ...effect, source: { kind: 'CARD', sourceId: 'card-1' } })
        .success,
    ).toBe(false);
    expect(MatchEffectSchema.safeParse({ ...effect, cardId: 'not-a-contract-field' }).success).toBe(
      false,
    );
  });
});
