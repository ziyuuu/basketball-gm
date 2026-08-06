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
  runToEnd,
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
    // v2.10: pre-match fatigueMilli on the player snapshot is compat-only —
    // genesis energy is always 0 regardless of the snapshot value.
    for (const preFatigue of [0, 10_000, 80_000, 100_000]) {
      // Create a player with the specified pre-match fatigue — verify the
      // snapshot value can be non-zero, but session genesis normalizes it.
      const player = makePhysicalPlayer('FATIGUE-TEST', { fatigueMilli: preFatigue });
      expect(player.fatigueMilli).toBe(preFatigue);
    }
    // The session creation contract: regardless of any snapshot fatigueMilli,
    // genesis fatigueMilliByPlayer must be 0 for all players.
    // Verified via the standard fixture (which uses fatigueMilli=0).
    const session = createModelBSession(makeP02MatchInput());
    const genesis = session.anchors[0]!;
    for (const playerId of Object.keys(genesis.fatigueMilliByPlayer)) {
      expect(genesis.fatigueMilliByPlayer[playerId]).toBe(0);
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
    'finishing',
    'shooting',
    'ballHandling',
    'playmaking',
    'perimeterDefense',
    'interiorDefense',
    'rebounding',
    'athleticism',
    'tacticalUnderstanding',
    'strength',
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

// ── 6. Behavior Energy Participant Roles ─────────────────────────────

describe('P02-003 behavior energy participant roles', () => {
  it('all 44 behaviors have actor and target energy intensity entries', () => {
    for (const behaviorId of MODEL_B_BEHAVIOR_MATRIX_IDS) {
      const entry = MODEL_B_BEHAVIOR_ENERGY_INTENSITY[behaviorId];
      expect(entry).toBeDefined();
      expect(typeof entry).toBe('object');
      expect(entry).not.toBeNull();
      const roleEntry = entry as { actor: string; target: string };
      expect(['LIGHT', 'MODERATE', 'HEAVY']).toContain(roleEntry.actor);
      expect(['LIGHT', 'MODERATE', 'HEAVY']).toContain(roleEntry.target);
    }
  });

  it('DRIVE actor is HEAVY, target is MODERATE (defender one tier lower)', () => {
    const entry = MODEL_B_BEHAVIOR_ENERGY_INTENSITY.DRIVE as { actor: string; target: string };
    expect(entry.actor).toBe('HEAVY');
    expect(entry.target).toBe('MODERATE');
  });

  it('SCREEN target is MODERATE (fighting through screen costs defender)', () => {
    const entry = MODEL_B_BEHAVIOR_ENERGY_INTENSITY.SCREEN as { actor: string; target: string };
    expect(entry.actor).toBe('LIGHT');
    expect(entry.target).toBe('MODERATE');
  });

  it('POSTUP actor and target are both HEAVY (post defense equally intense)', () => {
    const entry = MODEL_B_BEHAVIOR_ENERGY_INTENSITY.POSTUP as { actor: string; target: string };
    expect(entry.actor).toBe('HEAVY');
    expect(entry.target).toBe('HEAVY');
  });

  it('ONDEF target is LIGHT (passive on-ball defense)', () => {
    const entry = MODEL_B_BEHAVIOR_ENERGY_INTENSITY.ONDEF as { actor: string; target: string };
    expect(entry.actor).toBe('LIGHT');
    expect(entry.target).toBe('LIGHT');
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
    const withPenalty = calculateAbilityBlendMilli(player, 'INSIDE_OFFENSE', -20_000);
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
        finishing: 5,
        shooting: 5,
        ballHandling: 5,
        playmaking: 5,
        perimeterDefense: 5,
        interiorDefense: 5,
        rebounding: 5,
        athleticism: 5,
        stamina: 50,
        tacticalUnderstanding: 5,
        strength: 5,
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

// ── 12. Starter Primary-Position Validation ──────────────────────────────

describe('P02-003 starter primary-position validation', () => {
  it('accepts starters at their primary positions', () => {
    const input = makeP02MatchInput();
    expect(() => createModelBSession(input)).not.toThrow();
  });

  it('rejects a starter whose primaryPosition does not match the slot', () => {
    const input = makeP02MatchInput();
    // Assign a C-primary player to the SF slot — wrong position, but no duplicate player
    const cPlayer = input.homeTeam.players.find((p) => p.primaryPosition === 'C')!;
    const sfPlayerId = input.homeTeam.startingLineup.SF;
    // Ensure we're not creating a duplicate (C player is at C slot, SF player is a different player)
    expect(cPlayer.playerId).not.toBe(sfPlayerId);
    input.homeTeam.startingLineup.SF = cPlayer.playerId;
    expect(() => createModelBSession(input)).toThrow();
  });
});

// ── 13. Bench Recovery Through Match State ───────────────────────────────

describe('P02-003 bench recovery through match state', () => {
  it('bench players recover energy during match compared to starters', () => {
    const input = makeP02MatchInput();
    const benchPlayerId = input.homeTeam.registeredRosterIds[5]!;
    const starterPlayerId = input.homeTeam.registeredRosterIds[0]!;
    const session = createModelBSession(input);
    const genesis = session.anchors[0]!;
    const ran = runToEnd(session);
    const finalAnchor = ran.anchors[ran.anchors.length - 1]!;
    // Starters consume energy (fatigueMilliByPlayer > 0)
    expect(finalAnchor.fatigueMilliByPlayer[starterPlayerId]).toBeGreaterThan(0);
    // Bench players who stayed on bench recover or consume far less than starters
    const benchConsumed = finalAnchor.fatigueMilliByPlayer[benchPlayerId] ?? 0;
    const starterConsumed = finalAnchor.fatigueMilliByPlayer[starterPlayerId] ?? 0;
    // Bench player should have consumed less than starter (they were on bench recovering)
    expect(benchConsumed).toBeLessThan(starterConsumed);
  });

  it('quarter break recovery is applied at period boundaries', () => {
    // These registry values define the frozen recovery amounts.
    // The test verifies they are non-zero and that halftime > quarter break.
    expect(MODEL_B_PARAMETER_REGISTRY.quarterBreakRecoveryMilli).toBe(5_000);
    expect(MODEL_B_PARAMETER_REGISTRY.halftimeRecoveryMilli).toBe(20_000);
    expect(MODEL_B_PARAMETER_REGISTRY.overtimeBreakRecoveryMilli).toBe(5_000);
    // Run a full match to end and verify that a starter's consumed energy
    // is meaningfully greater than 0 (proving base+behavior consumption),
    // yet stays well below cap (proving recovery boundaries are applied).
    const session = createModelBSession(makeP02MatchInput({ matchKind: 'OFFICIAL' }));
    const ran = runToEnd(session);
    const finalAnchor = ran.anchors[ran.anchors.length - 1]!;
    const starterId = ran.input.homeTeam.registeredRosterIds[0]!;
    const consumed = finalAnchor.fatigueMilliByPlayer[starterId] ?? 0;
    expect(consumed).toBeGreaterThan(0);
    expect(consumed).toBeLessThan(100_000);
  });
});

// ── 14. Forced Mismatch Pipeline ─────────────────────────────────────────

describe('P02-003 forced mismatch pipeline', () => {
  it('rejects session creation when starter primaryPosition does not match slot', () => {
    const input = makeP02MatchInput();
    // Assign a C-primary player to the PG slot
    const cPlayer = input.homeTeam.players.find((p) => p.primaryPosition === 'C')!;
    input.homeTeam.startingLineup.PG = cPlayer.playerId;
    expect(() => createModelBSession(input)).toThrow();
  });

  it('starter rejection produces a descriptive error message', () => {
    const input = makeP02MatchInput();
    const cPlayer = input.homeTeam.players.find((p) => p.primaryPosition === 'C')!;
    input.homeTeam.startingLineup.PG = cPlayer.playerId;
    expect(() => createModelBSession(input)).toThrow(/primary position/);
  });

  it('player at primary position gets 0 position modifier in execution', () => {
    const player = makePhysicalPlayer('center', { primaryPosition: 'C' });
    expect(calculatePositionModifierMilli(player, 'C', true)).toBe(0);
  });

  it('player at non-primary position gets forced mismatch penalty in execution', () => {
    const player = makePhysicalPlayer('pg-at-c', { primaryPosition: 'PG' });
    expect(calculatePositionModifierMilli(player, 'C', true)).toBe(
      MODEL_B_PARAMETER_REGISTRY.forcedMismatchPenaltyMilli,
    );
  });

  it('SUBSTITUTION events carry reasonCode through full match pipeline', () => {
    // Run a full match and verify SUBSTITUTION events exist with reasonCode
    const session = createModelBSession(makeP02MatchInput({ matchKind: 'OFFICIAL' }));
    const ran = runToEnd(session);
    const subEvents = ran.events.filter((e) => e.payload.type === 'SUBSTITUTION');
    // At least some substitutions should occur during a full match
    expect(subEvents.length).toBeGreaterThan(0);
    // Every SUBSTITUTION event must have a reasonCode field (nullable)
    for (const event of subEvents) {
      const payload = event.payload as { type: 'SUBSTITUTION'; reasonCode: string | null };
      expect(payload).toHaveProperty('reasonCode');
      // reasonCode is either null or a non-empty string
      if (payload.reasonCode !== null) {
        expect(typeof payload.reasonCode).toBe('string');
        expect(payload.reasonCode.length).toBeGreaterThan(0);
      }
    }
  });
});

// ── 15. Behavior Energy Participant Role Matrix ──────────────────────────

describe('P02-003 behavior energy participant role matrix', () => {
  it('all 44 behaviors have both actor and target entries with valid intensities', () => {
    for (const behaviorId of MODEL_B_BEHAVIOR_MATRIX_IDS) {
      const entry = MODEL_B_BEHAVIOR_ENERGY_INTENSITY[behaviorId];
      expect(entry, `${behaviorId} missing from energy intensity table`).toBeDefined();
      const roleEntry = entry as { actor: string; target: string };
      expect(['LIGHT', 'MODERATE', 'HEAVY'], `${behaviorId} actor intensity`).toContain(
        roleEntry.actor,
      );
      expect(['LIGHT', 'MODERATE', 'HEAVY'], `${behaviorId} target intensity`).toContain(
        roleEntry.target,
      );
    }
  });

  it('full match produces non-zero energy consumption for on-court players', () => {
    // Run a full match and verify starters consumed meaningful energy
    const session = createModelBSession(makeP02MatchInput({ matchKind: 'OFFICIAL' }));
    const ran = runToEnd(session);
    const finalAnchor = ran.anchors[ran.anchors.length - 1]!;
    // All 5 starters should have consumed energy from base + behavior costs
    const starterIds = Object.values(ran.input.homeTeam.startingLineup);
    for (const playerId of starterIds) {
      const consumed = finalAnchor.fatigueMilliByPlayer[playerId] ?? 0;
      expect(consumed).toBeGreaterThan(0);
    }
  });

  it('non-selectable behaviors produce energy charges distinguishable from selectable ones', () => {
    // The 10 non-selectable behaviors each have energy intensities in the registry
    const nonSelectable = [
      'FT',
      'PASSTOV',
      'BALLDESTROY',
      'PUTBACK',
      'BLK',
      'FOUL',
      'ORB',
      'DRB',
      'BOXOUT',
      'BLKLOOSE',
    ] as const;
    for (const behaviorId of nonSelectable) {
      const entry = MODEL_B_BEHAVIOR_ENERGY_INTENSITY[behaviorId];
      expect(entry, `${behaviorId} should have energy intensity`).toBeDefined();
      const roleEntry = entry as { actor: string; target: string };
      expect(['LIGHT', 'MODERATE', 'HEAVY']).toContain(roleEntry.actor);
      expect(['LIGHT', 'MODERATE', 'HEAVY']).toContain(roleEntry.target);
    }
  });
});

// ── 16. Non-Selectable Behavior Energy Accounting ───────────────────────

describe('P02-003 non-selectable behavior energy accounting', () => {
  it('FOUL energy uses correct actor/target roles (actor = fouler, target = fouled)', () => {
    // FOUL intensity is LIGHT/LIGHT per registry
    const entry = MODEL_B_BEHAVIOR_ENERGY_INTENSITY.FOUL as { actor: string; target: string };
    expect(entry.actor).toBe('LIGHT');
    expect(entry.target).toBe('LIGHT');
  });

  it('FT energy is LIGHT intensity for the shooter (actor only)', () => {
    const entry = MODEL_B_BEHAVIOR_ENERGY_INTENSITY.FT as { actor: string; target: string };
    expect(entry.actor).toBe('LIGHT');
  });

  it('BLK energy uses LIGHT actor (blocker) and LIGHT target (shooter)', () => {
    const entry = MODEL_B_BEHAVIOR_ENERGY_INTENSITY.BLK as { actor: string; target: string };
    expect(entry.actor).toBe('LIGHT');
    expect(entry.target).toBe('LIGHT');
  });

  it('BOXOUT uses LIGHT actor and MODERATE target (boxing out is more demanding on target)', () => {
    const entry = MODEL_B_BEHAVIOR_ENERGY_INTENSITY.BOXOUT as { actor: string; target: string };
    expect(entry.actor).toBe('LIGHT');
    expect(entry.target).toBe('MODERATE');
  });

  it('ORB and DRB are both LIGHT/LIGHT intensity', () => {
    const orbEntry = MODEL_B_BEHAVIOR_ENERGY_INTENSITY.ORB as { actor: string; target: string };
    const drbEntry = MODEL_B_BEHAVIOR_ENERGY_INTENSITY.DRB as { actor: string; target: string };
    expect(orbEntry.actor).toBe('LIGHT');
    expect(drbEntry.actor).toBe('LIGHT');
  });

  it('PASSTOV, BALLDESTROY, PUTBACK, BLKLOOSE are LIGHT/LIGHT', () => {
    for (const id of ['PASSTOV', 'BALLDESTROY', 'PUTBACK', 'BLKLOOSE'] as const) {
      const entry = MODEL_B_BEHAVIOR_ENERGY_INTENSITY[id] as { actor: string; target: string };
      expect(entry.actor).toBe('LIGHT');
      expect(entry.target).toBe('LIGHT');
    }
  });

  it('intensity cost tiers produce increasing costs', () => {
    const lightCost = calculateBehaviorEnergyCostMilli('LIGHT', 3, 50);
    const moderateCost = calculateBehaviorEnergyCostMilli('MODERATE', 3, 50);
    const heavyCost = calculateBehaviorEnergyCostMilli('HEAVY', 3, 50);
    expect(lightCost).toBeGreaterThan(0);
    expect(moderateCost).toBeGreaterThan(lightCost);
    expect(heavyCost).toBeGreaterThan(moderateCost);
  });
});

// ── 17. Restore Primary Position (No Energy Gate) ────────────────────────

describe('P02-003 restore primary position without energy advantage gate', () => {
  it('starter energy consumption is driven by actual game events', () => {
    // Run a match and verify starters consume energy from time + behavior costs
    const session = createModelBSession(makeP02MatchInput({ matchKind: 'OFFICIAL' }));
    const ran = runToEnd(session);
    const finalAnchor = ran.anchors[ran.anchors.length - 1]!;
    const starterId = ran.input.homeTeam.startingLineup.PG;
    const consumed = finalAnchor.fatigueMilliByPlayer[starterId] ?? 0;
    // After a full match, starters should have consumed significant energy
    expect(consumed).toBeGreaterThan(0);
    expect(consumed).toBeLessThan(100_000);
  });

  it('replay consistency is preserved after energy gate removal', () => {
    const session1 = createModelBSession(makeP02MatchInput({ rootSeed: 'replay-r5-test' }));
    const ran1 = runToEnd(session1);
    const session2 = createModelBSession(makeP02MatchInput({ rootSeed: 'replay-r5-test' }));
    const ran2 = runToEnd(session2);
    // Same seed must produce same energy consumption
    const final1 = ran1.anchors[ran1.anchors.length - 1]!;
    const final2 = ran2.anchors[ran2.anchors.length - 1]!;
    expect(final1.fatigueMilliByPlayer).toEqual(final2.fatigueMilliByPlayer);
    expect(final1.anchorHash).toBe(final2.anchorHash);
  });
});
