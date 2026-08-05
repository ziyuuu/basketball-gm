import { idHash } from '../../core/canonical-v2.js';
import type { CanonicalV2Value } from '../../core/canonical-v2.js';
import type { MatchDrawKind } from '../schemas.js';

export const MODEL_B_LEGACY_REGISTRY_VERSION = 'p02-003-model-b-v2.9-final-r1';
export const MODEL_B_LEGACY_RULES_CONTENT_HASH =
  'sha256:55b865f3f28dcdde0aead21d249e44e53d0d76b0106c6d11b7fa686f6c49efc2';
export const MODEL_B_REGISTRY_VERSION = 'p02-003-model-b-v2.9-r1-final';
export const MODEL_B_RULES_VERSION = 'p02-003-v2.9-r1-final';

export const MODEL_B_SNAPSHOT_PROFILE_REGISTRY = deepFreeze({
  legacySnapshot: {
    version: 'P02_MATCH_PLAYER_LEGACY',
    abilityProfileVersion: 'P02_CORE_10_LEGACY',
    modelBPlayable: false,
  },
  physicalSnapshotV1: {
    version: 'P02_MATCH_PLAYER_PHYSICAL_V1',
    abilityProfileVersion: 'P02_CORE_11_V1',
    physicalProfileVersion: 'HEIGHT_WINGSPAN_CM_V1',
    modelBPlayable: true,
    abilityKeys: [
      'finishing',
      'shooting',
      'ballHandling',
      'playmaking',
      'perimeterDefense',
      'interiorDefense',
      'rebounding',
      'athleticism',
      'stamina',
      'tacticalUnderstanding',
      'strength',
    ],
    physicalKeys: ['heightCm', 'wingspanCm'],
  },
});

export const MODEL_B_DEFENSIVE_DUTY_REGISTRY = deepFreeze({
  C: {
    duty: 'RIM_ANCHOR',
    availabilityMilli: { HELPD: 1_000, CONTEST: 1_000, PRESS: 300, STLTRY: 250 },
    helpSelectionWeight: 1_000,
    blockCandidateModifierMilli: 8_000,
    passInterceptionCandidateModifierMilli: 0,
  },
  PF: {
    duty: 'RIM_HELPER',
    availabilityMilli: { HELPD: 900, CONTEST: 950, PRESS: 500, STLTRY: 450 },
    helpSelectionWeight: 850,
    blockCandidateModifierMilli: 5_000,
    passInterceptionCandidateModifierMilli: 1_000,
  },
  SF: {
    duty: 'WING_HELPER',
    availabilityMilli: { HELPD: 700, CONTEST: 850, PRESS: 700, STLTRY: 700 },
    helpSelectionWeight: 650,
    blockCandidateModifierMilli: 2_500,
    passInterceptionCandidateModifierMilli: 2_500,
  },
  SG: {
    duty: 'PERIMETER_INTERCEPTOR',
    availabilityMilli: { HELPD: 400, CONTEST: 750, PRESS: 850, STLTRY: 900 },
    helpSelectionWeight: 350,
    blockCandidateModifierMilli: 500,
    passInterceptionCandidateModifierMilli: 5_000,
  },
  PG: {
    duty: 'POINT_OF_ATTACK',
    availabilityMilli: { HELPD: 300, CONTEST: 700, PRESS: 900, STLTRY: 1_000 },
    helpSelectionWeight: 250,
    blockCandidateModifierMilli: 0,
    passInterceptionCandidateModifierMilli: 6_000,
  },
});

export const MODEL_B_DEFENSIVE_ACTION_FACT_REGISTRY = deepFreeze({
  payloadType: 'DEFENSIVE_ACTION',
  behaviorIds: ['HELPD', 'PRESS', 'DOUBLET'],
  results: ['SUCCESS', 'NO_EFFECT', 'FAILED_BREAKDOWN', 'FOUL'],
  helpd: {
    sourceEventType: 'CLOCK_ADVANCED',
    successfulDeltaMilli: -6_000,
    noEffectDeltaMilli: 0,
    breakdownOpportunity: false,
    creationFactAllowed: false,
  },
});

export type BehaviorClassification =
  'SELECTABLE_DETERMINISTIC' | 'SELECTABLE_ONE_DRAW' | 'RULE_RESULT' | 'ATTRIBUTION_ONLY';

export type BehaviorFamily =
  'ADVANCE' | 'CREATION' | 'SHOT' | 'PASS' | 'OFF_BALL' | 'DEFENSE' | 'REBOUND' | 'RULE';

export type BehaviorRegistryEntry = Readonly<{
  behaviorId: string;
  classification: BehaviorClassification;
  selectable: boolean;
  family: BehaviorFamily;
  resultDrawKind: MatchDrawKind | null;
  baseWeight: number;
  minimumSeconds: number;
  maximumSeconds: number;
  tendencyKeys: readonly string[];
}>;

function deepFreeze<T>(value: T): Readonly<T> {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
    Object.freeze(value);
  }
  return value as Readonly<T>;
}

function behavior(
  behaviorId: string,
  classification: BehaviorClassification,
  family: BehaviorFamily,
  resultDrawKind: MatchDrawKind | null,
  baseWeight: number,
  minimumSeconds: number,
  maximumSeconds: number,
  tendencyKeys: readonly string[],
): BehaviorRegistryEntry {
  return deepFreeze({
    behaviorId,
    classification,
    selectable:
      classification === 'SELECTABLE_DETERMINISTIC' || classification === 'SELECTABLE_ONE_DRAW',
    family,
    resultDrawKind,
    baseWeight,
    minimumSeconds,
    maximumSeconds,
    tendencyKeys: [...tendencyKeys],
  });
}

/** The v2.9 FINAL canonical behavior registry, in its frozen table order. */
export const MODEL_B_BEHAVIOR_REGISTRY = deepFreeze([
  behavior('ADV', 'SELECTABLE_DETERMINISTIC', 'ADVANCE', null, 10, 1, 3, ['passSelection']),
  behavior('REORG', 'SELECTABLE_DETERMINISTIC', 'ADVANCE', null, 10, 1, 2, ['passSelection']),
  behavior('DRIVE', 'SELECTABLE_ONE_DRAW', 'CREATION', 'BEHAVIOR', 15, 2, 4, [
    'possessionParticipation',
    'shotZones.inside',
  ]),
  behavior('SHAKE', 'SELECTABLE_ONE_DRAW', 'CREATION', 'BEHAVIOR', 12, 1, 3, [
    'possessionParticipation',
    'shotZones.perimeter+midRange',
  ]),
  behavior('ISO', 'SELECTABLE_ONE_DRAW', 'CREATION', 'BEHAVIOR', 10, 2, 4, [
    'possessionParticipation',
  ]),
  behavior('STEP_BACK', 'SELECTABLE_ONE_DRAW', 'CREATION', 'BEHAVIOR', 10, 2, 3, [
    'possessionParticipation',
    'shotZones.perimeter+midRange',
  ]),
  behavior('POSTUP', 'SELECTABLE_ONE_DRAW', 'CREATION', 'BEHAVIOR', 12, 2, 5, [
    'possessionParticipation',
    'shotZones.inside',
  ]),
  behavior('HIGH_POST_CREATION', 'SELECTABLE_ONE_DRAW', 'CREATION', 'BEHAVIOR', 10, 2, 4, [
    'passSelection',
  ]),
  behavior('SPOTUP', 'SELECTABLE_ONE_DRAW', 'SHOT', 'SHOT', 12, 1, 2, [
    'shotZones.perimeter/midRange',
  ]),
  behavior('CATCHSHOT', 'SELECTABLE_ONE_DRAW', 'SHOT', 'SHOT', 12, 1, 2, ['shotZones.perimeter']),
  behavior('THREE', 'SELECTABLE_ONE_DRAW', 'SHOT', 'SHOT', 12, 2, 3, ['shotZones.perimeter']),
  behavior('MID', 'SELECTABLE_ONE_DRAW', 'SHOT', 'SHOT', 10, 1, 2, ['shotZones.midRange']),
  behavior('PULLUP', 'SELECTABLE_ONE_DRAW', 'SHOT', 'SHOT', 8, 2, 3, ['shotZones.midRange']),
  behavior('CLOSE', 'SELECTABLE_ONE_DRAW', 'SHOT', 'SHOT', 10, 1, 2, ['shotZones.inside']),
  behavior('FLOATER', 'SELECTABLE_ONE_DRAW', 'SHOT', 'SHOT', 8, 1, 2, ['shotZones.inside']),
  behavior('HOOK', 'SELECTABLE_ONE_DRAW', 'SHOT', 'SHOT', 10, 1, 2, ['shotZones.inside']),
  behavior('LAYUP', 'SELECTABLE_ONE_DRAW', 'SHOT', 'SHOT', 12, 1, 2, ['shotZones.inside']),
  behavior('CONTACTFIN', 'SELECTABLE_ONE_DRAW', 'SHOT', 'SHOT', 10, 2, 3, ['shotZones.inside']),
  behavior('CONTESTEDFIN', 'SELECTABLE_ONE_DRAW', 'SHOT', 'SHOT', 8, 1, 2, ['shotZones.inside']),
  behavior('PASS', 'SELECTABLE_ONE_DRAW', 'PASS', 'TURNOVER_OCCURRENCE', 15, 1, 3, [
    'passSelection',
  ]),
  behavior('HPASS', 'SELECTABLE_ONE_DRAW', 'PASS', 'TURNOVER_OCCURRENCE', 10, 1, 3, [
    'passSelection',
  ]),
  behavior('CREATIVE_PASS', 'SELECTABLE_ONE_DRAW', 'PASS', 'TURNOVER_OCCURRENCE', 6, 2, 4, [
    'passSelection',
  ]),
  behavior('ASTOPP', 'SELECTABLE_ONE_DRAW', 'PASS', 'TURNOVER_OCCURRENCE', 8, 1, 3, [
    'passSelection',
  ]),
  behavior('HELDKICK', 'SELECTABLE_ONE_DRAW', 'PASS', 'TURNOVER_OCCURRENCE', 8, 1, 3, [
    'passSelection',
  ]),
  behavior('SCREEN', 'SELECTABLE_ONE_DRAW', 'OFF_BALL', 'BEHAVIOR', 8, 1, 3, [
    'transitionParticipation',
  ]),
  behavior('CUT', 'SELECTABLE_ONE_DRAW', 'OFF_BALL', 'BEHAVIOR', 8, 1, 3, [
    'transitionParticipation',
    'shotZones.inside',
  ]),
  behavior('DOUBLECREATE', 'SELECTABLE_ONE_DRAW', 'OFF_BALL', 'BEHAVIOR', 6, 2, 4, [
    'passSelection',
  ]),
  behavior('ONDEF', 'SELECTABLE_DETERMINISTIC', 'DEFENSE', null, 12, 1, 3, ['100-defensiveRisk']),
  behavior('PRESS', 'SELECTABLE_ONE_DRAW', 'DEFENSE', 'DEFENSIVE_ACTION', 8, 1, 2, [
    'defensiveRisk',
  ]),
  behavior('STLTRY', 'SELECTABLE_DETERMINISTIC', 'DEFENSE', null, 6, 1, 2, ['defensiveRisk']),
  behavior('CONTEST', 'SELECTABLE_DETERMINISTIC', 'DEFENSE', null, 12, 1, 2, ['defensiveRisk']),
  behavior('HELPD', 'SELECTABLE_ONE_DRAW', 'DEFENSE', 'DEFENSIVE_ACTION', 8, 1, 2, [
    'defensiveRisk',
  ]),
  behavior('DOUBLET', 'SELECTABLE_ONE_DRAW', 'DEFENSE', 'DEFENSIVE_ACTION', 6, 1, 3, [
    'defensiveRisk',
  ]),
  behavior('TRANSITIOND', 'SELECTABLE_DETERMINISTIC', 'DEFENSE', null, 8, 1, 3, [
    'transitionParticipation',
  ]),
  behavior('FT', 'RULE_RESULT', 'RULE', 'SHOT', 0, 1, 1, []),
  behavior('PASSTOV', 'RULE_RESULT', 'RULE', 'TURNOVER_CLASSIFICATION', 0, 1, 2, []),
  behavior('BALLDESTROY', 'RULE_RESULT', 'RULE', 'TURNOVER_OCCURRENCE', 0, 1, 2, []),
  behavior('PUTBACK', 'RULE_RESULT', 'RULE', 'SHOT', 0, 1, 2, []),
  behavior('BLK', 'ATTRIBUTION_ONLY', 'RULE', 'BLOCK_ATTRIBUTION', 0, 1, 2, []),
  behavior('FOUL', 'RULE_RESULT', 'RULE', 'FOUL_TYPE', 0, 1, 2, []),
  behavior('ORB', 'RULE_RESULT', 'REBOUND', 'REBOUND', 0, 1, 2, []),
  behavior('DRB', 'RULE_RESULT', 'REBOUND', 'REBOUND', 0, 1, 2, []),
  behavior('BOXOUT', 'RULE_RESULT', 'REBOUND', null, 0, 1, 2, []),
  behavior('BLKLOOSE', 'RULE_RESULT', 'REBOUND', 'REBOUND', 0, 1, 1, []),
] satisfies readonly BehaviorRegistryEntry[]);

/** Independent machine transcription of the behavior-matrix IDs. */
export const MODEL_B_BEHAVIOR_MATRIX_IDS = deepFreeze([
  'ADV',
  'REORG',
  'DRIVE',
  'SHAKE',
  'ISO',
  'STEP_BACK',
  'POSTUP',
  'HIGH_POST_CREATION',
  'SPOTUP',
  'CATCHSHOT',
  'THREE',
  'MID',
  'PULLUP',
  'CLOSE',
  'FLOATER',
  'HOOK',
  'LAYUP',
  'CONTACTFIN',
  'CONTESTEDFIN',
  'PASS',
  'HPASS',
  'CREATIVE_PASS',
  'ASTOPP',
  'HELDKICK',
  'SCREEN',
  'CUT',
  'DOUBLECREATE',
  'ONDEF',
  'PRESS',
  'STLTRY',
  'CONTEST',
  'HELPD',
  'DOUBLET',
  'TRANSITIOND',
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
] as const);

export type ModelBBehaviorId = (typeof MODEL_B_BEHAVIOR_MATRIX_IDS)[number];

export const MODEL_B_EVENT_TYPES = deepFreeze([
  'CLOCK_ADVANCED',
  'POSSESSION_STARTED',
  'POSSESSION_ENDED',
  'TURNOVER',
  'FOUL',
  'FREE_THROW',
  'SHOT',
  'REBOUND',
  'SCORE',
  'ASSIST',
  'STEAL',
  'BLOCK',
  'SUBSTITUTION',
  'EFFECT_APPLIED',
  'PERIOD_COMPLETED',
  'MATCH_COMPLETED',
] as const);

export const MODEL_B_DRAW_KINDS = deepFreeze([
  'SEGMENT_DURATION',
  'TRANSITION',
  'BALL_HANDLER',
  'DEFENSIVE_ACTION',
  'TURNOVER_OCCURRENCE',
  'TURNOVER_CLASSIFICATION',
  'BEHAVIOR',
  'SHOOTER',
  'SHOT',
  'OFFENSIVE_FOUL',
  'DEFENSIVE_FOUL',
  'FOUL_TYPE',
  'REBOUND',
  'STEAL_ATTRIBUTION',
  'BLOCK_ATTRIBUTION',
  'ASSIST_ATTRIBUTION',
] as const satisfies readonly MatchDrawKind[]);

export const MODEL_B_LEGACY_EXECUTION_BLEND_REGISTRY = deepFreeze({
  BALL_SECURITY: [
    ['ballHandling', 500],
    ['playmaking', 300],
    ['tacticalUnderstanding', 200],
  ],
  DEFENSIVE_PRESSURE: [
    ['perimeterDefense', 550],
    ['athleticism', 250],
    ['tacticalUnderstanding', 200],
  ],
  INSIDE_OFFENSE: [
    ['finishing', 550],
    ['athleticism', 200],
    ['bodyImpact', 150],
    ['tacticalUnderstanding', 100],
  ],
  INSIDE_DEFENSE: [
    ['interiorDefense', 500],
    ['athleticism', 200],
    ['bodyImpact', 200],
    ['tacticalUnderstanding', 100],
  ],
  MID_RANGE_OFFENSE: [
    ['shooting', 650],
    ['finishing', 200],
    ['tacticalUnderstanding', 150],
  ],
  MID_RANGE_DEFENSE: [
    ['perimeterDefense', 450],
    ['interiorDefense', 250],
    ['athleticism', 150],
    ['tacticalUnderstanding', 150],
  ],
  THREE_POINT_OFFENSE: [
    ['shooting', 800],
    ['tacticalUnderstanding', 200],
  ],
  THREE_POINT_DEFENSE: [
    ['perimeterDefense', 650],
    ['athleticism', 200],
    ['tacticalUnderstanding', 150],
  ],
  CREATION: [
    ['playmaking', 550],
    ['ballHandling', 250],
    ['tacticalUnderstanding', 200],
  ],
  DRIVE_CREATION: [
    ['ballHandling', 550],
    ['athleticism', 250],
    ['tacticalUnderstanding', 200],
  ],
  SHAKE_CREATION: [
    ['ballHandling', 500],
    ['athleticism', 300],
    ['tacticalUnderstanding', 200],
  ],
  ISO_CREATION: [
    ['ballHandling', 500],
    ['athleticism', 300],
    ['tacticalUnderstanding', 200],
  ],
  STEP_BACK_CREATION: [
    ['ballHandling', 500],
    ['athleticism', 300],
    ['tacticalUnderstanding', 200],
  ],
  POSTUP_CREATION: [
    ['ballHandling', 450],
    ['bodyImpact', 350],
    ['tacticalUnderstanding', 200],
  ],
  HIGH_POST_CREATION: [
    ['playmaking', 550],
    ['ballHandling', 250],
    ['tacticalUnderstanding', 200],
  ],
  PERSONAL_REBOUND: [
    ['rebounding', 600],
    ['bodyImpact', 200],
    ['athleticism', 200],
  ],
  DEFENSIVE_CONTROL: [
    ['interiorDefense', 550],
    ['tacticalUnderstanding', 250],
    ['athleticism', 200],
  ],
  INSIDE_CONTACT: [
    ['finishing', 500],
    ['athleticism', 250],
    ['bodyImpact', 150],
    ['ballHandling', 100],
  ],
  PERIMETER_CONTACT: [
    ['shooting', 600],
    ['ballHandling', 200],
    ['tacticalUnderstanding', 200],
  ],
  STEAL: [
    ['perimeterDefense', 600],
    ['athleticism', 250],
    ['tacticalUnderstanding', 150],
  ],
  BALL_PROTECTION: [
    ['ballHandling', 550],
    ['playmaking', 250],
    ['tacticalUnderstanding', 200],
  ],
  BLOCK: [
    ['interiorDefense', 550],
    ['bodyImpact', 250],
    ['athleticism', 200],
  ],
  INSIDE_SHOT_PROTECTION: [
    ['finishing', 500],
    ['athleticism', 250],
    ['bodyImpact', 150],
    ['tacticalUnderstanding', 100],
  ],
  MID_SHOT_PROTECTION: [
    ['shooting', 600],
    ['ballHandling', 200],
    ['tacticalUnderstanding', 200],
  ],
  SCREEN: [
    ['tacticalUnderstanding', 500],
    ['bodyImpact', 300],
    ['athleticism', 200],
  ],
  CUT: [
    ['tacticalUnderstanding', 500],
    ['athleticism', 300],
    ['finishing', 200],
  ],
  DOUBLE_CREATE: [
    ['tacticalUnderstanding', 500],
    ['playmaking', 300],
    ['shooting', 200],
  ],
  HELP_DEFENSE: [
    ['interiorDefense', 450],
    ['perimeterDefense', 250],
    ['tacticalUnderstanding', 200],
    ['athleticism', 100],
  ],
  DOUBLE_TEAM: [
    ['perimeterDefense', 400],
    ['interiorDefense', 300],
    ['tacticalUnderstanding', 200],
    ['athleticism', 100],
  ],
  PRESS: [
    ['perimeterDefense', 500],
    ['athleticism', 250],
    ['tacticalUnderstanding', 250],
  ],
  SPACING: [
    ['shooting', 700],
    ['athleticism', 150],
    ['tacticalUnderstanding', 150],
  ],
  HELP_ENVIRONMENT_DEFENSE: [
    ['perimeterDefense', 500],
    ['interiorDefense', 300],
    ['tacticalUnderstanding', 200],
  ],
  SCREEN_DEFENSE: [
    ['perimeterDefense', 500],
    ['athleticism', 300],
    ['tacticalUnderstanding', 200],
  ],
  CUT_DEFENSE: [
    ['perimeterDefense', 450],
    ['interiorDefense', 250],
    ['athleticism', 150],
    ['tacticalUnderstanding', 150],
  ],
  DOUBLE_CREATE_DEFENSE: [
    ['interiorDefense', 450],
    ['perimeterDefense', 250],
    ['athleticism', 150],
    ['tacticalUnderstanding', 150],
  ],
  OFFENSIVE_CONTROL: [
    ['ballHandling', 500],
    ['athleticism', 300],
    ['tacticalUnderstanding', 200],
  ],
  HELD_KICK: [
    ['playmaking', 550],
    ['tacticalUnderstanding', 250],
    ['ballHandling', 200],
  ],
} as const);

export const MODEL_B_EXECUTION_BLEND_REGISTRY = deepFreeze({
  BALL_SECURITY: [
    ['ballHandling', 500],
    ['playmaking', 300],
    ['tacticalUnderstanding', 200],
  ],
  DEFENSIVE_PRESSURE: [
    ['perimeterDefense', 550],
    ['athleticism', 250],
    ['tacticalUnderstanding', 200],
  ],
  INSIDE_OFFENSE: [
    ['finishing', 500],
    ['athleticism', 150],
    ['strength', 100],
    ['height', 100],
    ['absoluteWingspan', 50],
    ['tacticalUnderstanding', 100],
  ],
  INSIDE_DEFENSE: [
    ['interiorDefense', 400],
    ['athleticism', 100],
    ['strength', 100],
    ['height', 150],
    ['absoluteWingspan', 150],
    ['tacticalUnderstanding', 100],
  ],
  MID_RANGE_OFFENSE: [
    ['shooting', 650],
    ['finishing', 200],
    ['tacticalUnderstanding', 150],
  ],
  MID_RANGE_DEFENSE: [
    ['perimeterDefense', 450],
    ['interiorDefense', 200],
    ['athleticism', 150],
    ['wingspanAdvantage', 100],
    ['tacticalUnderstanding', 100],
  ],
  THREE_POINT_OFFENSE: [
    ['shooting', 800],
    ['tacticalUnderstanding', 200],
  ],
  THREE_POINT_DEFENSE: [
    ['perimeterDefense', 650],
    ['athleticism', 150],
    ['wingspanAdvantage', 100],
    ['tacticalUnderstanding', 100],
  ],
  CREATION: [
    ['playmaking', 550],
    ['ballHandling', 250],
    ['tacticalUnderstanding', 200],
  ],
  DRIVE_CREATION: [
    ['ballHandling', 550],
    ['athleticism', 250],
    ['tacticalUnderstanding', 200],
  ],
  SHAKE_CREATION: [
    ['ballHandling', 500],
    ['athleticism', 300],
    ['tacticalUnderstanding', 200],
  ],
  ISO_CREATION: [
    ['ballHandling', 500],
    ['athleticism', 300],
    ['tacticalUnderstanding', 200],
  ],
  STEP_BACK_CREATION: [
    ['ballHandling', 500],
    ['athleticism', 300],
    ['tacticalUnderstanding', 200],
  ],
  POSTUP_CREATION: [
    ['ballHandling', 400],
    ['strength', 250],
    ['height', 100],
    ['absoluteWingspan', 50],
    ['tacticalUnderstanding', 200],
  ],
  HIGH_POST_CREATION: [
    ['playmaking', 550],
    ['ballHandling', 250],
    ['tacticalUnderstanding', 200],
  ],
  PERSONAL_REBOUND: [
    ['rebounding', 500],
    ['strength', 150],
    ['athleticism', 100],
    ['height', 150],
    ['absoluteWingspan', 100],
  ],
  BOXOUT_EXECUTION: [
    ['rebounding', 550],
    ['strength', 200],
    ['tacticalUnderstanding', 150],
    ['height', 50],
    ['athleticism', 50],
  ],
  DEFENSIVE_CONTROL: [
    ['perimeterDefense', 550],
    ['athleticism', 200],
    ['tacticalUnderstanding', 200],
    ['wingspanAdvantage', 50],
  ],
  INSIDE_DEFENSIVE_CONTROL: [
    ['interiorDefense', 400],
    ['strength', 150],
    ['athleticism', 100],
    ['height', 100],
    ['absoluteWingspan', 100],
    ['tacticalUnderstanding', 150],
  ],
  PERIMETER_DEFENSIVE_CONTROL: [
    ['perimeterDefense', 550],
    ['athleticism', 200],
    ['tacticalUnderstanding', 200],
    ['wingspanAdvantage', 50],
  ],
  INSIDE_CONTACT: [
    ['finishing', 450],
    ['strength', 200],
    ['athleticism', 150],
    ['height', 50],
    ['ballHandling', 150],
  ],
  PERIMETER_CONTACT: [
    ['shooting', 600],
    ['ballHandling', 200],
    ['tacticalUnderstanding', 200],
  ],
  STEAL: [
    ['perimeterDefense', 550],
    ['athleticism', 200],
    ['tacticalUnderstanding', 150],
    ['wingspanAdvantage', 100],
  ],
  PASS_INTERCEPTION: [
    ['perimeterDefense', 500],
    ['wingspanAdvantage', 200],
    ['athleticism', 150],
    ['tacticalUnderstanding', 150],
  ],
  BALL_PROTECTION: [
    ['ballHandling', 550],
    ['playmaking', 250],
    ['tacticalUnderstanding', 200],
  ],
  BLOCK: [
    ['interiorDefense', 450],
    ['athleticism', 150],
    ['height', 150],
    ['absoluteWingspan', 150],
    ['tacticalUnderstanding', 100],
  ],
  INSIDE_SHOT_PROTECTION: [
    ['interiorDefense', 450],
    ['athleticism', 150],
    ['strength', 150],
    ['height', 100],
    ['absoluteWingspan', 50],
    ['tacticalUnderstanding', 100],
  ],
  MID_SHOT_PROTECTION: [
    ['shooting', 600],
    ['ballHandling', 200],
    ['tacticalUnderstanding', 200],
  ],
  SCREEN: [
    ['tacticalUnderstanding', 450],
    ['strength', 350],
    ['athleticism', 200],
  ],
  CUT: [
    ['tacticalUnderstanding', 500],
    ['athleticism', 300],
    ['finishing', 200],
  ],
  DOUBLE_CREATE: [
    ['tacticalUnderstanding', 500],
    ['playmaking', 300],
    ['shooting', 200],
  ],
  HELP_DEFENSE: [
    ['interiorDefense', 400],
    ['perimeterDefense', 250],
    ['tacticalUnderstanding', 200],
    ['athleticism', 150],
  ],
  DOUBLE_TEAM: [
    ['perimeterDefense', 400],
    ['interiorDefense', 300],
    ['tacticalUnderstanding', 200],
    ['athleticism', 100],
  ],
  PRESS: [
    ['perimeterDefense', 500],
    ['athleticism', 250],
    ['tacticalUnderstanding', 250],
  ],
  SPACING: [
    ['shooting', 700],
    ['athleticism', 150],
    ['tacticalUnderstanding', 150],
  ],
  HELP_ENVIRONMENT_DEFENSE: [
    ['perimeterDefense', 500],
    ['interiorDefense', 300],
    ['tacticalUnderstanding', 200],
  ],
  SCREEN_DEFENSE: [
    ['perimeterDefense', 500],
    ['athleticism', 300],
    ['tacticalUnderstanding', 200],
  ],
  CUT_DEFENSE: [
    ['perimeterDefense', 450],
    ['interiorDefense', 250],
    ['athleticism', 150],
    ['tacticalUnderstanding', 150],
  ],
  DOUBLE_CREATE_DEFENSE: [
    ['interiorDefense', 450],
    ['perimeterDefense', 250],
    ['athleticism', 150],
    ['tacticalUnderstanding', 150],
  ],
  OFFENSIVE_CONTROL: [
    ['ballHandling', 500],
    ['athleticism', 300],
    ['tacticalUnderstanding', 200],
  ],
  HELD_KICK: [
    ['playmaking', 550],
    ['tacticalUnderstanding', 250],
    ['ballHandling', 200],
  ],
  TRANSITION_CONTROLLER: [
    ['athleticism', 500],
    ['ballHandling', 300],
    ['tacticalUnderstanding', 200],
  ],
  TRANSITION_SUPPORT: [
    ['athleticism', 600],
    ['tacticalUnderstanding', 400],
  ],
  TRANSITION_RETREAT: [
    ['athleticism', 600],
    ['tacticalUnderstanding', 400],
  ],
} as const);

export type ModelBExecutionBlend = keyof typeof MODEL_B_EXECUTION_BLEND_REGISTRY;

export const MODEL_B_PARAMETER_REGISTRY = deepFreeze({
  fixedPointScale: 1_000,
  regularPeriodSeconds: 600,
  overtimePeriodSeconds: 300,
  foulOutLimit: 5,
  loadByMatchKind: { SCRIMMAGE: 6_000, FRIENDLY: 10_000, OFFICIAL: 12_000 },
  staminaLoadReductionMilliPerPoint: 3,
  fatiguePenaltyThresholdMilli: 30_000,
  fatiguePenaltyRateMilli: 200,
  fatiguePenaltyMaximumMilli: 14_000,
  chemistryRoleWeights: {
    DEFAULT: 1_000,
    PRIMARY_ORGANIZER: 1_250,
    OFFENSIVE_HUB: 1_100,
    DEFENSIVE_CAPTAIN: 1_100,
  },
  chemistryExecutionRateMilli: 120,
  chemistryExecutionMinimumMilli: -6_000,
  chemistryExecutionMaximumMilli: 6_000,
  secondaryPositionPenaltyMilli: -3_000,
  otherPositionPenaltyMilli: -8_000,
  traitBonusMilli: 6_000,
  tacticalExecutionCapMilli: 6_000,
  paceLoadFactors: { SLOW: 900, BALANCED: 1_000, FAST: 1_150 },
  defenseLoadFactors: { PRESSURE: 1_100, BALANCED: 1_000, PAINT_PROTECT: 1_000 },
  tacticalLoadMinimumMilli: 850,
  tacticalLoadMaximumMilli: 1_200,
  paceDurationFactors: { SLOW: 1_120, BALANCED: 1_000, FAST: 880 },
  transitionWeightFactors: { SLOW: 800, BALANCED: 1_000, FAST: 1_250 },
  paceTurnoverModifierMilli: { SLOW: -15, BALANCED: 0, FAST: 15 },
  offensiveFocusAttemptFactors: {
    PERIMETER: { PERIMETER: 1_250, INTERIOR: 850 },
    BALANCED: { PERIMETER: 1_000, INTERIOR: 1_000 },
    INTERIOR: { PERIMETER: 850, INTERIOR: 1_250 },
  },
  interiorFoulFactorMilli: 1_100,
  perimeterDefenseExecutionModifierMilli: -4_000,
  pressureDefenseExecutionModifierMilli: 4_000,
  paintDefenseExecutionModifierMilli: -4_000,
  defensiveReboundPaintModifierMilli: 2_000,
  pressureConcededInsideOpportunityMilli: 3_000,
  paintConcededPerimeterOpportunityMilli: 3_000,
  failedRiskDefenseExecutionMilli: -2_000,
  failedRiskOpponentOpportunityMilli: 3_000,
  pressureTurnoverRiskMilli: 30,
  teamCoordination: {
    baseMilli: 50_000,
    teamExecutionMultiplier: 5,
    minimumMilli: 20_000,
    maximumMilli: 80_000,
  },
  opportunityQuality: {
    creationWeightMilli: 350,
    coordinationWeightMilli: 250,
    spacingWeightMilli: 200,
    helpEnvironmentWeightMilli: 200,
    emptyCandidateNeutralMilli: 50_000,
    minimumMilli: 0,
    maximumMilli: 100_000,
  },
  shotClock: {
    newPossessionSeconds: 30,
    offensiveReboundSeconds: 20,
    rushedThresholdSeconds: 5,
    rushedAttemptWeightMilli: 1_500,
    rushedExecutionModifierMilli: -6_000,
  },
  segmentDuration: {
    baselineMinimumSeconds: 14,
    baselineMaximumSeconds: 24,
  },
  shortHandedDefensePenaltyMilliPerMissingPlayer: 4_000,
  neutralRotationFatigueThresholdMilli: 70_000,
  neutralRotationMinimumFatigueAdvantageMilli: 10_000,
  turnover: {
    baseMilli: 130,
    differenceCoefficientNumerator: 2,
    differenceCoefficientDenominator: 1,
    minimumMilli: 60,
    maximumMilli: 250,
    pressuredBaseMilli: 500,
    pressuredActionCoefficientMilli: 40,
    pressuredDifferenceCoefficientNumerator: 2,
    pressuredDifferenceCoefficientDenominator: 1,
    pressuredMinimumMilli: 100,
    pressuredMaximumMilli: 900,
  },
  shot: {
    baseMilli: { INSIDE: 560, MID_RANGE: 390, THREE_POINT: 330 },
    executionCoefficientNumerator: 5,
    executionCoefficientDenominator: 2,
    opportunityCoefficientNumerator: 3,
    opportunityCoefficientDenominator: 2,
    minimumMilli: { INSIDE: 250, MID_RANGE: 150, THREE_POINT: 100 },
    maximumMilli: { INSIDE: 800, MID_RANGE: 650, THREE_POINT: 600 },
  },
  freeThrow: {
    baseMilli: 750,
    shootingCoefficientMilli: 3,
    fatigueCoefficientMilli: 2,
    minimumMilli: 450,
    maximumMilli: 950,
  },
  offensiveRebound: {
    baseMilli: 270,
    differenceCoefficientNumerator: 5,
    differenceCoefficientDenominator: 2,
    minimumMilli: 120,
    maximumMilli: 450,
    boxoutExecutionBonusMilli: 4_000,
    boxoutAllowedMinimumMilli: 3_000,
    boxoutAllowedMaximumMilli: 5_000,
  },
  defensiveFoul: {
    baseMilli: { PRESSURE: 40, JUMP_SHOT: 50, INSIDE: 100 },
    differenceCoefficientNumerator: 3,
    differenceCoefficientDenominator: 2,
    actionRiskMilli: { SAFE: -15, RISKY: 25 },
    minimumMilli: 10,
    maximumMilli: 250,
  },
  offensiveFoul: {
    baseMilli: 20,
    differenceCoefficientMilli: 1,
    minimumMilli: 5,
    maximumMilli: 80,
  },
  attribution: {
    steal: { baseMilli: 350, coefficientMilli: 3, minimumMilli: 100, maximumMilli: 750 },
    block: { baseMilli: 80, coefficientMilli: 2, minimumMilli: 10, maximumMilli: 250 },
    assist: {
      baseMilli: 550,
      coefficientNumerator: 5,
      coefficientDenominator: 2,
      minimumMilli: 150,
      maximumMilli: 900,
    },
  },
  creation: {
    DRIVE: { baseMilli: 450, coefficientMilli: 2, minimumMilli: 200, maximumMilli: 750 },
    SHAKE: { baseMilli: 400, coefficientMilli: 2, minimumMilli: 200, maximumMilli: 700 },
    ISO: { baseMilli: 350, coefficientMilli: 2, minimumMilli: 150, maximumMilli: 650 },
    STEP_BACK: { baseMilli: 400, coefficientMilli: 2, minimumMilli: 200, maximumMilli: 700 },
    POSTUP: { baseMilli: 450, coefficientMilli: 2, minimumMilli: 200, maximumMilli: 750 },
    HIGH_POST_CREATION: {
      baseMilli: 500,
      coefficientMilli: 2,
      minimumMilli: 250,
      maximumMilli: 800,
    },
  },
  behaviorExecution: {
    SCREEN: { baseMilli: 500, coefficientMilli: 2, minimumMilli: 200, maximumMilli: 800 },
    CUT: { baseMilli: 450, coefficientMilli: 2, minimumMilli: 150, maximumMilli: 750 },
    DOUBLECREATE: {
      baseMilli: 400,
      coefficientMilli: 2,
      minimumMilli: 150,
      maximumMilli: 750,
    },
    HELPD: { baseMilli: 500, coefficientMilli: 2, minimumMilli: 200, maximumMilli: 800 },
    DOUBLET: { baseMilli: 350, coefficientMilli: 2, minimumMilli: 150, maximumMilli: 700 },
    PRESS: { baseMilli: 400, coefficientMilli: 2, minimumMilli: 150, maximumMilli: 750 },
  },
  creativePassOpportunityBonusMilli: 8_000,
  creativePassTurnoverRiskMilli: 50,
  creationRawBonusMilli: 10_000,
  offBallRawBonusMilli: 10_000,
  failedDefenseRawBonusMilli: 8_000,
  opportunityPerEventCapMilli: 6_000,
  opportunityPossessionCapMilli: 6_000,
  opportunityMinimumMilli: 0,
  opportunityMaximumMilli: 100_000,
  probabilityRoundScale: 1_000,
});

export const MODEL_B_RNG_SEMANTIC_REGISTRY = deepFreeze([
  { drawKind: 'SEGMENT_DURATION', role: 'SEGMENT_DURATION', minimum: 0, maximum: 0 },
  { drawKind: 'TRANSITION', role: 'TRANSITION_OR_HALF_COURT', minimum: 0, maximum: 0 },
  { drawKind: 'BALL_HANDLER', role: 'OPENING_TEAM', minimum: 0, maximum: 0 },
  { drawKind: 'BALL_HANDLER', role: 'HANDLER', minimum: 1, maximum: 999 },
  { drawKind: 'BALL_HANDLER', role: 'RECEIVER_OR_BENEFICIARY', minimum: 2_000, maximum: 2_999 },
  { drawKind: 'BALL_HANDLER', role: 'MULTI_PARTICIPANT_ACTOR', minimum: 3_000, maximum: 3_999 },
  { drawKind: 'DEFENSIVE_ACTION', role: 'DEFENSIVE_MODE', minimum: 0, maximum: 99 },
  { drawKind: 'DEFENSIVE_ACTION', role: 'DEFENSIVE_EXECUTION', minimum: 1_000, maximum: 1_999 },
  { drawKind: 'TURNOVER_OCCURRENCE', role: 'BEHAVIOR_TURNOVER', minimum: 2_000, maximum: 2_999 },
  { drawKind: 'TURNOVER_CLASSIFICATION', role: 'TURNOVER_CLASSIFICATION', minimum: 0, maximum: 0 },
  { drawKind: 'BEHAVIOR', role: 'BEHAVIOR_SELECTION', minimum: 0, maximum: 999 },
  { drawKind: 'BEHAVIOR', role: 'CREATION_EXECUTION', minimum: 1_000, maximum: 1_999 },
  { drawKind: 'BEHAVIOR', role: 'OFF_BALL_EXECUTION', minimum: 3_000, maximum: 3_999 },
  { drawKind: 'SHOOTER', role: 'SHOOTER', minimum: 0, maximum: 999 },
  { drawKind: 'SHOT', role: 'FIELD_GOAL', minimum: 0, maximum: 999 },
  { drawKind: 'SHOT', role: 'FREE_THROW', minimum: 5_000, maximum: 5_999 },
  { drawKind: 'OFFENSIVE_FOUL', role: 'BEHAVIOR_FOUL', minimum: 4_000, maximum: 4_999 },
  { drawKind: 'DEFENSIVE_FOUL', role: 'BEHAVIOR_FOUL', minimum: 5_000, maximum: 5_999 },
  { drawKind: 'FOUL_TYPE', role: 'FOUL_CLASSIFICATION', minimum: 0, maximum: 0 },
  { drawKind: 'REBOUND', role: 'REBOUND_RESULT', minimum: 0, maximum: 999 },
  { drawKind: 'STEAL_ATTRIBUTION', role: 'STEAL_ATTRIBUTION', minimum: 0, maximum: 0 },
  { drawKind: 'BLOCK_ATTRIBUTION', role: 'BLOCK_ATTRIBUTION', minimum: 0, maximum: 0 },
  { drawKind: 'ASSIST_ATTRIBUTION', role: 'ASSIST_ATTRIBUTION', minimum: 0, maximum: 0 },
] as const satisfies readonly Readonly<{
  drawKind: MatchDrawKind;
  role: string;
  minimum: number;
  maximum: number;
}>[]);

function pairedSeeds(scenarioId: string): readonly string[] {
  return deepFreeze(
    Array.from(
      { length: 64 },
      (_, index) =>
        `p02-003-${scenarioId.toLowerCase()}-paired-${String(index + 1).padStart(4, '0')}`,
    ),
  );
}

export const MODEL_B_SCENARIO_REGISTRY = deepFreeze({
  version: 'p02-003-directional-scenarios-v1',
  scenarios: [
    { scenarioId: 'S1', gate: true, seeds: pairedSeeds('S1') },
    { scenarioId: 'S2', gate: true, seeds: pairedSeeds('S2') },
    { scenarioId: 'S3', gate: true, seeds: pairedSeeds('S3') },
    { scenarioId: 'S4', gate: true, seeds: pairedSeeds('S4') },
    { scenarioId: 'S6', gate: true, seeds: pairedSeeds('S6') },
    { scenarioId: 'S7', gate: false, seeds: pairedSeeds('S7') },
    { scenarioId: 'S8', gate: false, seeds: pairedSeeds('S8') },
  ],
});

export const MODEL_B_RULES_CONTENT_REGISTRY = deepFreeze({
  registryVersion: MODEL_B_REGISTRY_VERSION,
  rulesVersion: MODEL_B_RULES_VERSION,
  snapshotProfiles: MODEL_B_SNAPSHOT_PROFILE_REGISTRY,
  behaviorRegistry: MODEL_B_BEHAVIOR_REGISTRY,
  behaviorMatrixIds: MODEL_B_BEHAVIOR_MATRIX_IDS,
  eventTypes: MODEL_B_EVENT_TYPES,
  drawKinds: MODEL_B_DRAW_KINDS,
  executionBlends: MODEL_B_EXECUTION_BLEND_REGISTRY,
  defensiveDuties: MODEL_B_DEFENSIVE_DUTY_REGISTRY,
  defensiveActionFacts: MODEL_B_DEFENSIVE_ACTION_FACT_REGISTRY,
  parameters: MODEL_B_PARAMETER_REGISTRY,
  rngSemanticOrdinals: MODEL_B_RNG_SEMANTIC_REGISTRY,
  scenarioRegistry: MODEL_B_SCENARIO_REGISTRY,
});

export const MODEL_B_RULES_CONTENT_HASH = idHash(
  'p02-003-model-b-rules-content-v1',
  MODEL_B_RULES_CONTENT_REGISTRY as unknown as CanonicalV2Value,
);

export function assertModelBRegistryIntegrity(): void {
  const registryIds = MODEL_B_BEHAVIOR_REGISTRY.map(({ behaviorId }) => behaviorId);
  const uniqueIds = new Set(registryIds);
  if (registryIds.length !== 44 || uniqueIds.size !== 44) {
    throw new Error('Model B must register exactly 44 unique behavior IDs.');
  }
  if (
    registryIds.length !== MODEL_B_BEHAVIOR_MATRIX_IDS.length ||
    registryIds.some((behaviorId, index) => behaviorId !== MODEL_B_BEHAVIOR_MATRIX_IDS[index])
  ) {
    throw new Error(
      'Model B behavior registry and behavior matrix IDs must match in frozen order.',
    );
  }
  const selectable = MODEL_B_BEHAVIOR_REGISTRY.filter((entry) => entry.selectable);
  if (selectable.length !== 34 || MODEL_B_BEHAVIOR_REGISTRY.length - selectable.length !== 10) {
    throw new Error(
      'Model B behavior classification must remain 34 selectable plus 10 non-selectable.',
    );
  }
  for (const entry of MODEL_B_BEHAVIOR_REGISTRY) {
    if (entry.minimumSeconds < 1 || entry.maximumSeconds < entry.minimumSeconds) {
      throw new Error(`Invalid live-ball duration for behavior ${entry.behaviorId}.`);
    }
    if (entry.selectable !== entry.classification.startsWith('SELECTABLE_')) {
      throw new Error(
        `Behavior ${entry.behaviorId} has an inconsistent selectable classification.`,
      );
    }
  }
  if (MODEL_B_PARAMETER_REGISTRY.offensiveRebound.boxoutExecutionBonusMilli !== 4_000) {
    throw new Error('The frozen first-candidate BOXOUT execution bonus must remain +4.');
  }
  for (const [blend, terms] of Object.entries(MODEL_B_EXECUTION_BLEND_REGISTRY)) {
    if (terms.reduce((total, [, weight]) => total + weight, 0) !== 1_000) {
      throw new Error(`Physical execution blend ${blend} must total 1000.`);
    }
  }
  const insideProtection = MODEL_B_EXECUTION_BLEND_REGISTRY.INSIDE_SHOT_PROTECTION;
  if (
    insideProtection[0][0] !== 'interiorDefense' ||
    insideProtection[0][1] !== 450 ||
    insideProtection.some(([attribute]) => String(attribute) === 'finishing')
  ) {
    throw new Error(
      'R1 INSIDE_SHOT_PROTECTION must begin with 450 interiorDefense and exclude finishing.',
    );
  }
  if (MODEL_B_LEGACY_RULES_CONTENT_HASH === MODEL_B_RULES_CONTENT_HASH) {
    throw new Error('R1 Model B rules/content identity must differ from the legacy v2.9 identity.');
  }
  for (const scenario of MODEL_B_SCENARIO_REGISTRY.scenarios) {
    if (scenario.seeds.length !== 64 || new Set(scenario.seeds).size !== 64) {
      throw new Error(`Scenario ${scenario.scenarioId} must contain 64 unique paired seeds.`);
    }
  }
}

assertModelBRegistryIntegrity();
