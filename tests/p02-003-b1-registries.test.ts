import { describe, expect, it } from 'vitest';

import {
  MatchDrawKindSchema,
  MatchEventTypeSchema,
  MODEL_B_BEHAVIOR_MATRIX_IDS,
  MODEL_B_BEHAVIOR_REGISTRY,
  MODEL_B_DRAW_KINDS,
  MODEL_B_EVENT_TYPES,
  MODEL_B_PARAMETER_REGISTRY,
  MODEL_B_RNG_SEMANTIC_REGISTRY,
  MODEL_B_RULES_CONTENT_HASH,
  MODEL_B_SCENARIO_REGISTRY,
  assertModelBRegistryIntegrity,
  calculateAbilityBlendMilli,
  calculateAttributionProbabilityMilli,
  calculateBehaviorExecutionProbabilityMilli,
  calculateChemistryExecutionModifierMilli,
  calculateCommittedFatigueIncrementMilli,
  calculateCreationProbabilityMilli,
  calculateEffectiveExecutionStages,
  calculateFatiguePenaltyMilli,
  calculateFreeThrowProbabilityMilli,
  calculateLineupChemistryMilli,
  calculateOffensiveAttemptFactorMilli,
  calculateOffensiveReboundProbabilityMilli,
  calculateOpportunityQualityMilli,
  calculateShotProbabilityMilli,
  calculateTurnoverProbabilityMilli,
  calculateTacticalExecutionModifierMilli,
  calculateTeamCoordinationIndexMilli,
  stableSortPlayersById,
  type MatchPlayerSnapshot,
} from '../packages/domain/src/match/index.js';

function player(
  playerId: string,
  overrides: Partial<MatchPlayerSnapshot> = {},
): MatchPlayerSnapshot {
  return {
    playerId,
    primaryPosition: 'PG',
    secondaryPosition: 'SG',
    abilities: {
      finishing: 50,
      shooting: 50,
      ballHandling: 50,
      playmaking: 50,
      perimeterDefense: 50,
      interiorDefense: 50,
      rebounding: 50,
      athleticism: 50,
      stamina: 50,
      tacticalUnderstanding: 50,
    },
    bodyImpact: 50,
    tendencies: {
      possessionParticipation: 50,
      passSelection: 50,
      shotZones: { perimeter: 34, midRange: 33, inside: 33 },
      transitionParticipation: 50,
      defensiveRisk: 50,
      offensiveRebounding: 50,
    },
    archetypeTrait: null,
    fatigueMilli: 30_000,
    chemistryMilli: 50_000,
    ...overrides,
  };
}

describe('P02-003 B1 frozen registries', () => {
  it('machine-checks the unique 44 = 34 selectable + 10 non-selectable registry', () => {
    expect(assertModelBRegistryIntegrity).not.toThrow();
    expect(MODEL_B_BEHAVIOR_REGISTRY).toHaveLength(44);
    expect(new Set(MODEL_B_BEHAVIOR_REGISTRY.map(({ behaviorId }) => behaviorId)).size).toBe(44);
    expect(MODEL_B_BEHAVIOR_REGISTRY.filter(({ selectable }) => selectable)).toHaveLength(34);
    expect(MODEL_B_BEHAVIOR_REGISTRY.filter(({ selectable }) => !selectable)).toHaveLength(10);
    expect(MODEL_B_BEHAVIOR_REGISTRY.map(({ behaviorId }) => behaviorId)).toEqual(
      MODEL_B_BEHAVIOR_MATRIX_IDS,
    );
  });

  it('keeps PASS on its single turnover draw and BOXOUT free of selection/actor draws', () => {
    for (const behaviorId of ['PASS', 'HPASS', 'CREATIVE_PASS', 'ASTOPP', 'HELDKICK']) {
      expect(
        MODEL_B_BEHAVIOR_REGISTRY.find((entry) => entry.behaviorId === behaviorId),
      ).toMatchObject({
        classification: 'SELECTABLE_ONE_DRAW',
        resultDrawKind: 'TURNOVER_OCCURRENCE',
      });
    }
    expect(
      MODEL_B_BEHAVIOR_REGISTRY.find(({ behaviorId }) => behaviorId === 'BOXOUT'),
    ).toMatchObject({
      classification: 'RULE_RESULT',
      selectable: false,
      resultDrawKind: null,
    });
    expect(MODEL_B_PARAMETER_REGISTRY.offensiveRebound.boxoutExecutionBonusMilli).toBe(4_000);
  });

  it('transcribes only existing event and drawKind enums', () => {
    expect(MODEL_B_EVENT_TYPES.map((value) => MatchEventTypeSchema.parse(value))).toEqual(
      MODEL_B_EVENT_TYPES,
    );
    expect(MODEL_B_DRAW_KINDS.map((value) => MatchDrawKindSchema.parse(value))).toEqual(
      MODEL_B_DRAW_KINDS,
    );
    for (const entry of MODEL_B_RNG_SEMANTIC_REGISTRY) {
      expect(MatchDrawKindSchema.parse(entry.drawKind)).toBe(entry.drawKind);
      expect(entry.maximum).toBeGreaterThanOrEqual(entry.minimum);
    }
  });

  it('pre-registers 64 paired seeds for every B8 scenario and hashes all authority values', () => {
    expect(MODEL_B_SCENARIO_REGISTRY.scenarios.map(({ scenarioId }) => scenarioId)).toEqual([
      'S1',
      'S2',
      'S3',
      'S4',
      'S6',
      'S7',
      'S8',
    ]);
    for (const scenario of MODEL_B_SCENARIO_REGISTRY.scenarios) {
      expect(scenario.seeds).toHaveLength(64);
      expect(new Set(scenario.seeds).size).toBe(64);
    }
    expect(MODEL_B_RULES_CONTENT_HASH).toMatch(/^sha256:[a-f0-9]{64}$/);
  });
});

describe('P02-003 B1 fixed calculation pipeline', () => {
  it('applies blend, fatigue, position, trait, chemistry and capped tactics once in order', () => {
    const subject = player('pipeline', {
      primaryPosition: 'PG',
      secondaryPosition: 'SG',
      archetypeTrait: 'STEADY_HANDLER',
      fatigueMilli: 80_000,
    });
    const stages = calculateEffectiveExecutionStages({
      player: subject,
      blend: 'BALL_SECURITY',
      fatigueSensitivity: 'FULL',
      assignedPosition: 'SG',
      applyPositionMismatch: true,
      traitContext: 'BALL_SECURITY',
      chemistryModifierMilli: 2_000,
      applyChemistry: true,
      tacticalModifierMilli: 20_000,
    });
    expect(stages).toEqual({
      abilityBlendMilli: 50_000,
      fatiguePenaltyMilli: 10_000,
      afterFatigueMilli: 40_000,
      positionModifierMilli: -3_000,
      afterPositionMilli: 37_000,
      traitModifierMilli: 6_000,
      afterTraitMilli: 43_000,
      chemistryModifierMilli: 2_000,
      afterChemistryMilli: 45_000,
      tacticalModifierMilli: 6_000,
      finalExecutionMilli: 51_000,
    });
  });

  it('uses exact half-up weighted execution without floating-point authority values', () => {
    const subject = player('blend', {
      abilities: {
        ...player('base').abilities,
        ballHandling: 51,
        playmaking: 50,
        tacticalUnderstanding: 50,
      },
    });
    expect(calculateAbilityBlendMilli(subject, 'BALL_SECURITY')).toBe(50_500);
    expect(calculateFatiguePenaltyMilli(100_000, 'FULL')).toBe(14_000);
    expect(calculateFatiguePenaltyMilli(80_000, 'HALF')).toBe(5_000);
  });

  it('keeps fatigue accumulation and tactical benefits/costs explicit', () => {
    const tactics = {
      pace: 'FAST' as const,
      offensiveFocus: 'PERIMETER' as const,
      defensiveFocus: 'PRESSURE' as const,
    };
    expect(
      calculateCommittedFatigueIncrementMilli({
        matchKind: 'OFFICIAL',
        seconds: 600,
        stamina: 50,
        tactics,
      }),
    ).toBe(3_060);
    expect(calculateOffensiveAttemptFactorMilli(tactics, 'PERIMETER')).toBe(1_250);
    expect(calculateOffensiveAttemptFactorMilli(tactics, 'INTERIOR')).toBe(850);
    expect(calculateTacticalExecutionModifierMilli(tactics, 'DEFENSIVE_PRESSURE')).toBe(4_000);
    expect(calculateTacticalExecutionModifierMilli(tactics, 'OPPONENT_INSIDE_OPPORTUNITY')).toBe(
      3_000,
    );
  });

  it('weights chemistry roles by the highest role only and supports actual 2-player lineups', () => {
    const organizer = player('organizer', { chemistryMilli: 80_000 });
    const teammate = player('teammate', { chemistryMilli: 40_000 });
    const chemistry = calculateLineupChemistryMilli([organizer, teammate], {
      primaryOrganizer: organizer.playerId,
      offensiveHub: organizer.playerId,
      defensiveCaptain: teammate.playerId,
    });
    expect(chemistry).toBe(61_277);
    expect(calculateChemistryExecutionModifierMilli(chemistry)).toBe(1_353);
    expect(calculateChemistryExecutionModifierMilli(0)).toBe(-6_000);
    expect(calculateChemistryExecutionModifierMilli(100_000)).toBe(6_000);
  });

  it('sorts candidate IDs by UTF-16 code-unit order independent of input order', () => {
    const values = [player('😀'), player('z'), player('中'), player('a')];
    expect(stableSortPlayersById(values).map(({ playerId }) => playerId)).toEqual([
      'a',
      'z',
      '中',
      '😀',
    ]);
    expect(stableSortPlayersById([...values].reverse()).map(({ playerId }) => playerId)).toEqual([
      'a',
      'z',
      '中',
      '😀',
    ]);
  });

  it('builds team coordination and opportunity quality with per-event and net caps', () => {
    expect(calculateTeamCoordinationIndexMilli(6_000)).toBe(80_000);
    expect(calculateTeamCoordinationIndexMilli(-6_000)).toBe(20_000);
    expect(
      calculateOpportunityQualityMilli({
        creationExecutionMilli: 60_000,
        teamCoordinationMilli: 50_000,
        spacingMilli: 50_000,
        helpEnvironmentMilli: 50_000,
        tacticalOpportunityModifierMilli: 10_000,
        possessionDeltasMilli: [10_000, 10_000],
      }),
    ).toBe(65_500);
  });
});

describe('P02-003 B1 probability clamps and monotonicity', () => {
  it('keeps stronger offense monotonic and stronger defense monotonic in the opposite direction', () => {
    expect(
      calculateShotProbabilityMilli({
        zone: 'THREE_POINT',
        offensiveExecutionMilli: 70_000,
        defensiveExecutionMilli: 40_000,
        opportunityQualityMilli: 50_000,
      }),
    ).toBeGreaterThan(
      calculateShotProbabilityMilli({
        zone: 'THREE_POINT',
        offensiveExecutionMilli: 40_000,
        defensiveExecutionMilli: 40_000,
        opportunityQualityMilli: 50_000,
      }),
    );
    expect(calculateCreationProbabilityMilli('HIGH_POST_CREATION', 60_000, 80_000)).toBeLessThan(
      calculateCreationProbabilityMilli('HIGH_POST_CREATION', 60_000, 20_000),
    );
    expect(calculateOffensiveReboundProbabilityMilli(80_000, 20_000)).toBeGreaterThan(
      calculateOffensiveReboundProbabilityMilli(20_000, 80_000),
    );
  });

  it('applies explicit probability clamps and exact half-up boundaries', () => {
    expect(
      calculateShotProbabilityMilli({
        zone: 'INSIDE',
        offensiveExecutionMilli: 100_000,
        defensiveExecutionMilli: -100_000,
        opportunityQualityMilli: 100_000,
      }),
    ).toBe(800);
    expect(calculateFreeThrowProbabilityMilli(100_000, 0)).toBe(900);
    expect(calculateFreeThrowProbabilityMilli(0, 14_000)).toBe(572);
    expect(calculateAttributionProbabilityMilli('ASSIST', 50_500, 50_000)).toBe(551);
  });

  it('separates tendency-free execution from bounded turnover risk', () => {
    const lowRisk = calculateTurnoverProbabilityMilli({
      defensivePressureMilli: 40_000,
      ballSecurityMilli: 70_000,
      actionPressureMilli: -3_000,
      pace: 'SLOW',
      teamExecutionModifierMilli: 6_000,
    });
    const highRisk = calculateTurnoverProbabilityMilli({
      defensivePressureMilli: 70_000,
      ballSecurityMilli: 40_000,
      actionPressureMilli: 4_000,
      pace: 'FAST',
      teamExecutionModifierMilli: -6_000,
    });
    expect(lowRisk).toBe(60);
    expect(highRisk).toBeGreaterThan(lowRisk);
    expect(highRisk).toBeLessThanOrEqual(250);
  });

  it('uses the frozen one-draw behavior execution formulas', () => {
    expect(calculateBehaviorExecutionProbabilityMilli('SCREEN', 60_000, 50_000)).toBe(520);
    expect(calculateBehaviorExecutionProbabilityMilli('DOUBLET', 0, 100_000)).toBe(150);
    expect(calculateBehaviorExecutionProbabilityMilli('HELPD', 100_000, 0)).toBe(700);
  });
});
