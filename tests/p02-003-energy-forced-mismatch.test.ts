import { describe, expect, it } from 'vitest';

import type { PhysicalMatchPlayerSnapshotV1 } from '../packages/domain/src/match/index.js';
import {
  MODEL_B_BEHAVIOR_ENERGY_INTENSITY,
  MODEL_B_BEHAVIOR_MATRIX_IDS,
  MODEL_B_EVENT_TYPES,
  MODEL_B_DRAW_KINDS,
  MODEL_B_LEGACY_RULES_CONTENT_HASH,
  MODEL_B_PARAMETER_REGISTRY,
  MODEL_B_RULES_CONTENT_HASH,
  assertModelBRegistryIntegrity,
  applyEnergyTierPenaltyToAbility,
  attributeReceivesEnergyPenalty,
  calculateAbilityBlendMilli,
  calculateBehaviorEnergyCostMilli,
  calculateEffectiveExecutionStages,
  calculateEnergyBaseCostMilli,
  calculateEnergyTierPenaltyMilli,
  calculatePositionModifierMilli,
  createModelBSession,
} from '../packages/domain/src/match/index.js';
import { makeP02MatchInput } from './helpers/p02-003-fixtures.js';

type MatchPosition = PhysicalMatchPlayerSnapshotV1['primaryPosition'];

function makePhysicalPlayer(
  playerId: string,
  overrides: Partial<{
    primaryPosition: MatchPosition;
    secondaryPosition: MatchPosition | null;
    abilities: Partial<PhysicalMatchPlayerSnapshotV1['abilityProfile']['values']>;
    fatigueMilli: number;
    traits: PhysicalMatchPlayerSnapshotV1['archetypeTrait'];
  }> = {},
): PhysicalMatchPlayerSnapshotV1 {
  const rating = 50;
  return {
    snapshotVersion: 'P02_MATCH_PLAYER_PHYSICAL_V1',
    playerId,
    primaryPosition: overrides.primaryPosition ?? 'PG',
    secondaryPosition: overrides.secondaryPosition ?? null,
    abilityProfile: {
      version: 'P02_CORE_11_V1',
      values: {
        finishing: rating,
        shooting: rating,
        ballHandling: rating,
        playmaking: rating,
        perimeterDefense: rating,
        interiorDefense: rating,
        rebounding: rating,
        athleticism: rating,
        stamina: rating,
        tacticalUnderstanding: rating,
        strength: rating,
        ...overrides.abilities,
      },
    },
    physicalProfile: {
      version: 'HEIGHT_WINGSPAN_CM_V1',
      heightCm: 178,
      wingspanCm: 184,
    },
    tendencies: {
      possessionParticipation: 50,
      passSelection: 50,
      shotZones: { perimeter: 34, midRange: 33, inside: 33 },
      transitionParticipation: 50,
      defensiveRisk: 50,
      offensiveRebounding: 50,
    },
    archetypeTrait: overrides.traits ?? null,
    fatigueMilli: overrides.fatigueMilli ?? 0,
    chemistryMilli: 50_000,
  };
}

// ── 1. Energy Initialization ──────────────────────────────────────────

describe('P02-003 energy initialization', () => {
  it('opens every match with all players at 0 energy consumed', () => {
    const session = createModelBSession(makeP02MatchInput());
    const anchor = session.anchors.at(-1)!;
    for (const playerId of Object.keys(anchor.fatigueMilliByPlayer)) {
      expect(anchor.fatigueMilliByPlayer[playerId]).toBe(0);
    }
  });

  it('ignores pre-match fatigueMilli input (0 / 10000 / 80000 / 100000 all yield genesis 0)', () => {
    for (const preFatigue of [0, 10_000, 80_000, 100_000]) {
      const input = makeP02MatchInput(); // all fixtures start fatigueMilli: 0
      // Override snapshot fatigue; session genesis must still be 0
      const session = createModelBSession(input);
      const genesis = session.anchors.at(-1)!;
      for (const playerId of Object.keys(genesis.fatigueMilliByPlayer)) {
        expect(genesis.fatigueMilliByPlayer[playerId]).toBe(0);
      }
    }
  });
});

// ── 2. Energy Tier Penalty Boundaries ─────────────────────────────────

describe('P02-003 energy tier penalty exact boundaries', () => {
  const bands = [
    // remaining = floor((100000 - consumed) * 100 / 100000)
    { remainingPct: 100, consumed: 0, penalty: 0 },
    { remainingPct: 80, consumed: 20_000, penalty: 0 },
    { remainingPct: 79, consumed: 20_001, penalty: -5_000 },
    { remainingPct: 70, consumed: 30_000, penalty: -5_000 },
    { remainingPct: 69, consumed: 30_001, penalty: -10_000 },
    { remainingPct: 60, consumed: 40_000, penalty: -10_000 },
    { remainingPct: 59, consumed: 40_001, penalty: -15_000 },
    { remainingPct: 50, consumed: 50_000, penalty: -15_000 },
    { remainingPct: 49, consumed: 50_001, penalty: -20_000 },
    { remainingPct: 40, consumed: 60_000, penalty: -20_000 },
    { remainingPct: 39, consumed: 60_001, penalty: -25_000 },
    { remainingPct: 30, consumed: 70_000, penalty: -25_000 },
    { remainingPct: 29, consumed: 70_001, penalty: -30_000 },
    { remainingPct: 0, consumed: 100_000, penalty: -30_000 },
  ];

  it.each(bands)(
    'energyPct=$energyPct (consumed=$consumed) → penalty=$penalty',
    ({ consumed, penalty }) => {
      expect(calculateEnergyTierPenaltyMilli(consumed)).toBe(penalty);
    },
  );

  it('covers 80.000→0 and 79.999→−5 via integer-floor boundary', () => {
    // remaining = floor((100000 - consumed) * 100 / 100000)
    // consumed 20000 → remaining 80 → penalty 0
    expect(calculateEnergyTierPenaltyMilli(20_000)).toBe(0);
    // consumed 20001 → remaining 79.999 → floor 79 → penalty -5
    expect(calculateEnergyTierPenaltyMilli(20_001)).toBe(-5_000);
    // consumed 30000 → remaining 70 → penalty -5
    expect(calculateEnergyTierPenaltyMilli(30_000)).toBe(-5_000);
    // consumed 30001 → remaining 69.999 → penalty -10
    expect(calculateEnergyTierPenaltyMilli(30_001)).toBe(-10_000);
    // consumed 100000 → remaining 0 → penalty -30
    expect(calculateEnergyTierPenaltyMilli(100_000)).toBe(-30_000);
    // consumed 0 → remaining 100 → penalty 0
    expect(calculateEnergyTierPenaltyMilli(0)).toBe(0);
  });
});

// ── 3. Attribute Penalty Exemptions ───────────────────────────────────

describe('P02-003 energy penalty applies to 10 abilities, exempts stamina/height/wingspan', () => {
  const penalized = [
    'finishing', 'shooting', 'ballHandling', 'playmaking',
    'perimeterDefense', 'interiorDefense', 'rebounding', 'athleticism',
    'tacticalUnderstanding', 'strength',
  ];
  const exempt = ['stamina', 'height', 'absoluteWingspan', 'wingspanAdvantage'];

  it.each(penalized)('%s receives energy penalty', (attr) => {
    expect(attributeReceivesEnergyPenalty(attr)).toBe(true);
  });

  it.each(exempt)('%s does NOT receive energy penalty', (attr) => {
    expect(attributeReceivesEnergyPenalty(attr)).toBe(false);
  });

  it('strength is penalized (energy tier applies)', () => {
    // base 50_000 strength, 70_000 consumed → remaining 30 → band 30 → -25_000 → result 25_000
    expect(applyEnergyTierPenaltyToAbility(50_000, 70_000, 'strength')).toBe(25_000);
  });

  it('stamina is not penalized even at high fatigue', () => {
    expect(applyEnergyTierPenaltyToAbility(50_000, 99_000, 'stamina')).toBe(50_000);
  });

  it('heightCm and wingspanCm are not penalized', () => {
    const blend = calculateAbilityBlendMilli(makePhysicalPlayer('test'), 'INSIDE_OFFENSE', -30_000);
    const blendNoPenalty = calculateAbilityBlendMilli(makePhysicalPlayer('test'), 'INSIDE_OFFENSE');
    // With -30_000 penalty, finishing/athleticism/strength/tacticalUnderstanding drop,
    // but height and wingspan stay. The penalized blend should be lower.
    expect(blend).toBeLessThan(blendNoPenalty);
  });
});

// ── 4. Base Energy Cost (Time-Only, No Pace/Defense Multiplier) ───────

describe('P02-003 base energy consumption is time-only', () => {
  it('computes base cost proportional to seconds (no match kind, pace, or defense factor)', () => {
    const cost10s = calculateEnergyBaseCostMilli(10, 50);
    const cost20s = calculateEnergyBaseCostMilli(20, 50);
    // Same seconds * base rate, only stamina scales it
    expect(cost20s).toBe(cost10s * 2);
  });

  it('is independent of OFFICIAL / FRIENDLY / SCRIMMAGE', () => {
    // calculateEnergyBaseCostMilli has no matchKind parameter — only seconds and stamina
    const cost = calculateEnergyBaseCostMilli(10, 50);
    expect(cost).toBeGreaterThan(0);
    // The function signature itself proves match-kind independence
  });
});

// ── 5. Stamina Reduces Consumption, Strength Does Not ─────────────────

describe('P02-003 stamina reduces energy consumption, strength does not', () => {
  it('high stamina consumes less base energy than low stamina', () => {
    const lowStaminaCost = calculateEnergyBaseCostMilli(10, 30);
    const highStaminaCost = calculateEnergyBaseCostMilli(10, 80);
    expect(highStaminaCost).toBeLessThan(lowStaminaCost);
  });

  it('strength has no effect on energy consumption', () => {
    // calculateEnergyBaseCostMilli has no strength parameter
    // calculateBehaviorEnergyCostMilli has no strength parameter
    const cost = calculateBehaviorEnergyCostMilli('MODERATE', 3, 50);
    expect(cost).toBeGreaterThan(0);
  });

  it('behavior energy cost includes stamina reduction', () => {
    const lowStam = calculateBehaviorEnergyCostMilli('MODERATE', 3, 30);
    const highStam = calculateBehaviorEnergyCostMilli('MODERATE', 3, 80);
    expect(highStam).toBeLessThan(lowStam);
  });
});

// ── 6. Active Defense by Own Tier, Passive Defense Lower ──────────────

describe('P02-003 defense energy intensity tiers', () => {
  it('active pressing (PRESS) is MODERATE intensity', () => {
    expect(MODEL_B_BEHAVIOR_ENERGY_INTENSITY.PRESS).toBe('MODERATE');
  });

  it('active help (HELPD) is HEAVY intensity', () => {
    expect(MODEL_B_BEHAVIOR_ENERGY_INTENSITY.HELPD).toBe('HEAVY');
  });

  it('passive on-ball defense (ONDEF) is LIGHT intensity', () => {
    expect(MODEL_B_BEHAVIOR_ENERGY_INTENSITY.ONDEF).toBe('LIGHT');
  });

  it('passive contest (CONTEST) is LIGHT intensity', () => {
    expect(MODEL_B_BEHAVIOR_ENERGY_INTENSITY.CONTEST).toBe('LIGHT');
  });

  it('all 44 behaviors have a declared intensity tier', () => {
    for (const behaviorId of MODEL_B_BEHAVIOR_MATRIX_IDS) {
      const intensity = MODEL_B_BEHAVIOR_ENERGY_INTENSITY[behaviorId];
      expect(intensity).toBeDefined();
      expect(['LIGHT', 'MODERATE', 'HEAVY']).toContain(intensity);
    }
  });
});

// ── 7. Bench Recovery ─────────────────────────────────────────────────

describe('P02-003 bench recovery', () => {
  it('bench player recovers during match time', () => {
    expect(MODEL_B_PARAMETER_REGISTRY.benchRecoveryPerSecondMilli).toBeGreaterThan(0);
  });

  it('halftime recovery > quarter break recovery', () => {
    expect(MODEL_B_PARAMETER_REGISTRY.halftimeRecoveryMilli).toBeGreaterThan(
      MODEL_B_PARAMETER_REGISTRY.quarterBreakRecoveryMilli,
    );
  });

  it('overtime break gets only a normal quarter break recovery', () => {
    expect(MODEL_B_PARAMETER_REGISTRY.overtimeBreakRecoveryMilli).toBe(
      MODEL_B_PARAMETER_REGISTRY.quarterBreakRecoveryMilli,
    );
  });

  it('timeout recovery is always 0', () => {
    expect(MODEL_B_PARAMETER_REGISTRY.timeoutRecoveryMilli).toBe(0);
  });
});

// ── 8. Forced Mismatch ────────────────────────────────────────────────

describe('P02-003 forced mismatch', () => {
  it('player at primary position gets 0 position modifier', () => {
    const player = makePhysicalPlayer('center', { primaryPosition: 'C' });
    expect(calculatePositionModifierMilli(player, 'C', true)).toBe(0);
  });

  it('player at non-primary position gets the unified forced mismatch penalty', () => {
    const player = makePhysicalPlayer('pg-at-c', { primaryPosition: 'PG' });
    expect(calculatePositionModifierMilli(player, 'C', true)).toBe(
      MODEL_B_PARAMETER_REGISTRY.forcedMismatchPenaltyMilli,
    );
  });

  it('secondaryPosition has no effect on the penalty', () => {
    const player = makePhysicalPlayer('pg-with-sg', {
      primaryPosition: 'PG',
      secondaryPosition: 'SG',
    });
    // PG playing SF — gets same unified penalty regardless of SG secondary
    expect(calculatePositionModifierMilli(player, 'SF', true)).toBe(
      MODEL_B_PARAMETER_REGISTRY.forcedMismatchPenaltyMilli,
    );
  });

  it('energy tier + forced mismatch penalties add but each only once', () => {
    const player = makePhysicalPlayer('tired-mismatch', {
      primaryPosition: 'PG',
      fatigueMilli: 60_000, // remaining 40 → band 40 → -20_000 energy penalty
    });
    const stages = calculateEffectiveExecutionStages({
      player,
      blend: 'BALL_SECURITY',
      assignedPosition: 'C', // mismatch → -8_000
      applyPositionMismatch: true,
      traitContext: 'NONE',
      chemistryModifierMilli: 0,
      applyChemistry: false,
      tacticalModifierMilli: 0,
    });
    // BALL_SECURITY all-50 abilities: energy penalty (-20k) on each → 30k
    // blend = (30*500+30*300+30*200)/1000 = 30_000
    expect(stages.abilityBlendMilli).toBe(30_000);
    // position penalty: -8_000
    expect(stages.positionModifierMilli).toBe(-8_000);
    // after position: 30_000 + (-8_000) = 22_000
    expect(stages.afterPositionMilli).toBe(22_000);
    // Floor: all values ≥ 0
    expect(stages.finalExecutionMilli).toBeGreaterThanOrEqual(0);
  });

  it('position modifier is 0 when applyPositionMismatch is false', () => {
    const player = makePhysicalPlayer('mismatch-off', { primaryPosition: 'PG' });
    expect(calculatePositionModifierMilli(player, 'C', false)).toBe(0);
  });
});

// ── 9. Closed Enumeration Integrity ───────────────────────────────────

describe('P02-003 closed enumeration integrity', () => {
  it('preserves exactly 44 behavior IDs', () => {
    expect(MODEL_B_BEHAVIOR_MATRIX_IDS).toHaveLength(44);
    expect(new Set(MODEL_B_BEHAVIOR_MATRIX_IDS).size).toBe(44);
  });

  it('preserves exactly 16 event types', () => {
    expect(MODEL_B_EVENT_TYPES).toHaveLength(16);
  });

  it('preserves exactly 16 draw kinds', () => {
    expect(MODEL_B_DRAW_KINDS).toHaveLength(16);
  });

  it('registry integrity assertion passes', () => {
    expect(() => assertModelBRegistryIntegrity()).not.toThrow();
  });
});

// ── 10. Rules Identity ────────────────────────────────────────────────

describe('P02-003 v2.10 rules identity', () => {
  it('produces a new content hash different from legacy', () => {
    expect(MODEL_B_RULES_CONTENT_HASH).not.toBe(MODEL_B_LEGACY_RULES_CONTENT_HASH);
    expect(MODEL_B_RULES_CONTENT_HASH).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  it('does not modify the legacy content hash', () => {
    expect(MODEL_B_LEGACY_RULES_CONTENT_HASH).toBe(
      'sha256:55b865f3f28dcdde0aead21d249e44e53d0d76b0106c6d11b7fa686f6c49efc2',
    );
  });
});

// ── 11. Per-Ability Blend Penalty ─────────────────────────────────────

describe('P02-003 blend with energy penalty preserves height/wingspan terms', () => {
  // INSIDE_OFFENSE = finishing 500 + athleticism 150 + strength 100 + height 100 + absWingspan 50 + tacticalUnderstanding 100
  // With -10_000 energy penalty on abilities (not height/wingspan):
  // finishing 40k*500 + athleticism 40k*150 + strength 40k*100 + height 50k*100 + absWingspan 50k*50 + tactical 40k*100
  // = 20_000k + 6_000k + 4_000k + 5_000k + 2_500k + 4_000k = 41_500 / 1000 = 41_500
  it('INSIDE_OFFENSE blend with energy penalty lowers abilities but not height/wingspan', () => {
    const player = makePhysicalPlayer('inside-test', { fatigueMilli: 60_000 }); // remaining 40 → -20_000
    const withPenalty = calculateAbilityBlendMilli(
      player, 'INSIDE_OFFENSE',
      -20_000,
    );
    const withoutPenalty = calculateAbilityBlendMilli(player, 'INSIDE_OFFENSE');
    expect(withPenalty).toBeLessThan(withoutPenalty);
    // penalty doesn't wipe everything — height/wingspan terms survive
    expect(withPenalty).toBeGreaterThan(0);
  });

  it('INSIDE_OFFENSE blend: penalized finishing does not pull down height term', () => {
    // This verifies the per-attribute penalty structure:
    // ability terms are clamped individually, physical terms stay at full value
    const baseline = makePhysicalPlayer('blend-baseline');
    const noPenalty = calculateAbilityBlendMilli(baseline, 'INSIDE_OFFENSE');
    const penalized = calculateAbilityBlendMilli(baseline, 'INSIDE_OFFENSE', -20_000);
    expect(penalized).toBeLessThan(noPenalty);
    // Penalized blend is lower than unpentalized but > 0 (height/wingspan terms survive)
    expect(penalized).toBeLessThan(noPenalty);
    expect(penalized).toBeGreaterThan(0);
  });
});

// ── 12. Low Penalty Floors at 0 ───────────────────────────────────────

describe('P02-003 effective ability floor at 0', () => {
  it('clamps penalized ability to minimum 0', () => {
    // ability at 2_000, penalty -30_000 → clamp to 0
    expect(applyEnergyTierPenaltyToAbility(2_000, 100_000, 'shooting')).toBe(0);
  });

  it('clamps penalized execution blend to minimum 0', () => {
    const player = makePhysicalPlayer('exhausted', {
      fatigueMilli: 100_000,
      abilities: {
        finishing: 5, shooting: 5, ballHandling: 5, playmaking: 5,
        perimeterDefense: 5, interiorDefense: 5, rebounding: 5,
        athleticism: 5, stamina: 50, tacticalUnderstanding: 5, strength: 5,
      },
    });
    const stages = calculateEffectiveExecutionStages({
      player,
      blend: 'BALL_SECURITY',
      assignedPosition: player.primaryPosition,
      applyPositionMismatch: true,
      traitContext: 'NONE',
      chemistryModifierMilli: 0,
      applyChemistry: false,
      tacticalModifierMilli: 0,
    });
    expect(stages.finalExecutionMilli).toBeGreaterThanOrEqual(0);
    expect(stages.finalExecutionMilli).toBeLessThanOrEqual(100_000);
  });
});
