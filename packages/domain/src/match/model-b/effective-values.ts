import { clampFixedPoint, compareUtf16CodeUnits, roundHalfUp } from '../../core/index.js';
import type { MatchInput } from '../schemas.js';
import {
  MODEL_B_EXECUTION_BLEND_REGISTRY,
  MODEL_B_LEGACY_EXECUTION_BLEND_REGISTRY,
  MODEL_B_PARAMETER_REGISTRY,
  type ModelBExecutionBlend,
} from './registries.js';

export type MatchPlayerSnapshot = MatchInput['homeTeam']['players'][number];
export type ModelBPhysicalPlayerSnapshot = Readonly<{
  snapshotVersion: 'P02_MATCH_PLAYER_PHYSICAL_V1';
  playerId: string;
  primaryPosition: 'PG' | 'SG' | 'SF' | 'PF' | 'C';
  secondaryPosition: 'PG' | 'SG' | 'SF' | 'PF' | 'C' | null;
  abilityProfile: Readonly<{
    version: 'P02_CORE_11_V1';
    values: Readonly<{
      finishing: number;
      shooting: number;
      ballHandling: number;
      playmaking: number;
      perimeterDefense: number;
      interiorDefense: number;
      rebounding: number;
      athleticism: number;
      stamina: number;
      tacticalUnderstanding: number;
      strength: number;
    }>;
  }>;
  physicalProfile: Readonly<{
    version: 'HEIGHT_WINGSPAN_CM_V1';
    heightCm: number;
    wingspanCm: number;
  }>;
  tendencies: MatchPlayerSnapshot['tendencies'];
  archetypeTrait: MatchPlayerSnapshot['archetypeTrait'];
  fatigueMilli: number;
  chemistryMilli: number;
}>;
export type ModelBExecutionPlayerSnapshot = MatchPlayerSnapshot | ModelBPhysicalPlayerSnapshot;
export type MatchPosition = MatchInput['homeTeam']['players'][number]['primaryPosition'];
export type MatchRoles = MatchInput['homeTeam']['roles'];
export type MatchTactics = MatchInput['homeTeam']['tactics'];

export type TacticalExecutionContext =
  | 'OPPONENT_PERIMETER_EXECUTION'
  | 'DEFENSIVE_PRESSURE'
  | 'OPPONENT_INSIDE_EXECUTION'
  | 'DEFENSIVE_REBOUND_EXECUTION'
  | 'OPPONENT_INSIDE_OPPORTUNITY'
  | 'OPPONENT_PERIMETER_OPPORTUNITY';

export type TraitContext =
  | 'NONE'
  | 'OPEN_PERIMETER_SHOT'
  | 'CONTACT_FINISH'
  | 'BALL_SECURITY'
  | 'ON_BALL_PERIMETER_DEFENSE'
  | 'PAINT_DEFENSE'
  | 'CONTESTED_REBOUND';

export type FatigueSensitivity = 'FULL' | 'HALF' | 'NONE';

export type EffectiveExecutionInput = Readonly<{
  player: ModelBExecutionPlayerSnapshot;
  blend: ModelBExecutionBlend;
  fatigueSensitivity: FatigueSensitivity;
  assignedPosition: MatchPosition | null;
  applyPositionMismatch: boolean;
  traitContext: TraitContext;
  chemistryModifierMilli: number;
  applyChemistry: boolean;
  tacticalModifierMilli: number;
}>;

export type EffectiveExecutionStages = Readonly<{
  abilityBlendMilli: number;
  fatiguePenaltyMilli: number;
  afterFatigueMilli: number;
  positionModifierMilli: number;
  afterPositionMilli: number;
  traitModifierMilli: number;
  afterTraitMilli: number;
  chemistryModifierMilli: number;
  afterChemistryMilli: number;
  tacticalModifierMilli: number;
  finalExecutionMilli: number;
}>;

function assertMilli(value: number, label: string, minimum = -100_000, maximum = 100_000): void {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${label} must be a safe integer in ${minimum}..${maximum}.`);
  }
}

function isPhysicalSnapshot(
  player: ModelBExecutionPlayerSnapshot,
): player is ModelBPhysicalPlayerSnapshot {
  return 'snapshotVersion' in player && player.snapshotVersion === 'P02_MATCH_PLAYER_PHYSICAL_V1';
}

export function normalizeHeightMilli(heightCm: number): number {
  if (!Number.isSafeInteger(heightCm) || heightCm < 140 || heightCm > 220) {
    throw new Error('heightCm must be an integer in 140..220.');
  }
  return clampFixedPoint(roundHalfUp((heightCm - 150) * 100_000, 55), 0, 100_000);
}

export function normalizeAbsoluteWingspanMilli(wingspanCm: number): number {
  if (!Number.isSafeInteger(wingspanCm) || wingspanCm < 140 || wingspanCm > 235) {
    throw new Error('wingspanCm must be an integer in 140..235.');
  }
  return clampFixedPoint(roundHalfUp((wingspanCm - 150) * 100_000, 70), 0, 100_000);
}

export function normalizeWingspanAdvantageMilli(heightCm: number, wingspanCm: number): number {
  normalizeHeightMilli(heightCm);
  normalizeAbsoluteWingspanMilli(wingspanCm);
  return clampFixedPoint(roundHalfUp((wingspanCm - heightCm + 10) * 100_000, 30), 0, 100_000);
}

function physicalAttributeMilli(player: ModelBPhysicalPlayerSnapshot, attribute: string): number {
  if (attribute in player.abilityProfile.values) {
    return (
      player.abilityProfile.values[
        attribute as keyof ModelBPhysicalPlayerSnapshot['abilityProfile']['values']
      ] * 1_000
    );
  }
  if (attribute === 'height') return normalizeHeightMilli(player.physicalProfile.heightCm);
  if (attribute === 'absoluteWingspan') {
    return normalizeAbsoluteWingspanMilli(player.physicalProfile.wingspanCm);
  }
  if (attribute === 'wingspanAdvantage') {
    return normalizeWingspanAdvantageMilli(
      player.physicalProfile.heightCm,
      player.physicalProfile.wingspanCm,
    );
  }
  throw new Error(`Unknown Physical Model B attribute: ${attribute}.`);
}

function legacyAttributeMilli(player: MatchPlayerSnapshot, attribute: string): number {
  if (attribute === 'bodyImpact') return player.bodyImpact * 1_000;
  if (!(attribute in player.abilities))
    throw new Error(`Unknown legacy Model B ability: ${attribute}.`);
  return player.abilities[attribute as keyof MatchPlayerSnapshot['abilities']] * 1_000;
}

export function calculateAbilityBlendMilli(
  player: ModelBExecutionPlayerSnapshot,
  blend: ModelBExecutionBlend,
): number {
  const physical = isPhysicalSnapshot(player);
  const terms = physical
    ? MODEL_B_EXECUTION_BLEND_REGISTRY[blend]
    : MODEL_B_LEGACY_EXECUTION_BLEND_REGISTRY[
        blend as keyof typeof MODEL_B_LEGACY_EXECUTION_BLEND_REGISTRY
      ];
  if (terms === undefined) {
    throw new Error(`Execution blend ${blend} is unavailable for the legacy snapshot variant.`);
  }
  let totalWeight = 0;
  let weightedMilli = 0;
  for (const [attribute, weightMilli] of terms) {
    totalWeight += weightMilli;
    weightedMilli +=
      (physical
        ? physicalAttributeMilli(player, attribute)
        : legacyAttributeMilli(player, attribute)) * weightMilli;
  }
  if (totalWeight !== 1_000) throw new Error(`Execution blend ${blend} must total 1000.`);
  return roundHalfUp(weightedMilli, 1_000);
}

export function calculateFatiguePenaltyMilli(
  fatigueMilli: number,
  sensitivity: FatigueSensitivity,
): number {
  assertMilli(fatigueMilli, 'fatigueMilli', 0, 100_000);
  if (sensitivity === 'NONE') return 0;
  const excess = Math.max(
    0,
    fatigueMilli - MODEL_B_PARAMETER_REGISTRY.fatiguePenaltyThresholdMilli,
  );
  const fullPenalty = clampFixedPoint(
    roundHalfUp(excess * MODEL_B_PARAMETER_REGISTRY.fatiguePenaltyRateMilli, 1_000),
    0,
    MODEL_B_PARAMETER_REGISTRY.fatiguePenaltyMaximumMilli,
  );
  return sensitivity === 'HALF' ? roundHalfUp(fullPenalty, 2) : fullPenalty;
}

export function calculatePositionModifierMilli(
  player: ModelBExecutionPlayerSnapshot,
  assignedPosition: MatchPosition | null,
  applyPositionMismatch: boolean,
): number {
  if (
    !applyPositionMismatch ||
    assignedPosition === null ||
    assignedPosition === player.primaryPosition
  ) {
    return 0;
  }
  return assignedPosition === player.secondaryPosition
    ? MODEL_B_PARAMETER_REGISTRY.secondaryPositionPenaltyMilli
    : MODEL_B_PARAMETER_REGISTRY.otherPositionPenaltyMilli;
}

const TRAIT_CONTEXT = Object.freeze({
  SPOT_SHOOTER: 'OPEN_PERIMETER_SHOT',
  TOUGH_FINISHER: 'CONTACT_FINISH',
  STEADY_HANDLER: 'BALL_SECURITY',
  PERIMETER_LOCK: 'ON_BALL_PERIMETER_DEFENSE',
  PAINT_BARRIER: 'PAINT_DEFENSE',
  REBOUND_INSTINCT: 'CONTESTED_REBOUND',
} as const);

export function calculateTraitModifierMilli(
  player: ModelBExecutionPlayerSnapshot,
  context: TraitContext,
): number {
  const trait = player.archetypeTrait;
  return trait !== null && TRAIT_CONTEXT[trait] === context
    ? MODEL_B_PARAMETER_REGISTRY.traitBonusMilli
    : 0;
}

export function capTacticalModifierMilli(modifierMilli: number): number {
  assertMilli(modifierMilli, 'tacticalModifierMilli');
  return clampFixedPoint(
    modifierMilli,
    -MODEL_B_PARAMETER_REGISTRY.tacticalExecutionCapMilli,
    MODEL_B_PARAMETER_REGISTRY.tacticalExecutionCapMilli,
  );
}

export function calculateTacticalExecutionModifierMilli(
  tactics: MatchTactics,
  context: TacticalExecutionContext,
): number {
  if (tactics.defensiveFocus === 'PRESSURE') {
    if (context === 'OPPONENT_PERIMETER_EXECUTION') {
      return MODEL_B_PARAMETER_REGISTRY.perimeterDefenseExecutionModifierMilli;
    }
    if (context === 'DEFENSIVE_PRESSURE') {
      return MODEL_B_PARAMETER_REGISTRY.pressureDefenseExecutionModifierMilli;
    }
    if (context === 'OPPONENT_INSIDE_OPPORTUNITY') {
      return MODEL_B_PARAMETER_REGISTRY.pressureConcededInsideOpportunityMilli;
    }
  }
  if (tactics.defensiveFocus === 'PAINT_PROTECT') {
    if (context === 'OPPONENT_INSIDE_EXECUTION') {
      return MODEL_B_PARAMETER_REGISTRY.paintDefenseExecutionModifierMilli;
    }
    if (context === 'DEFENSIVE_REBOUND_EXECUTION') {
      return MODEL_B_PARAMETER_REGISTRY.defensiveReboundPaintModifierMilli;
    }
    if (context === 'OPPONENT_PERIMETER_OPPORTUNITY') {
      return MODEL_B_PARAMETER_REGISTRY.paintConcededPerimeterOpportunityMilli;
    }
  }
  return 0;
}

export function calculateOffensiveAttemptFactorMilli(
  tactics: MatchTactics,
  zone: 'PERIMETER' | 'INTERIOR',
): number {
  return MODEL_B_PARAMETER_REGISTRY.offensiveFocusAttemptFactors[tactics.offensiveFocus][zone];
}

export function calculateTacticalLoadFactorMilli(tactics: MatchTactics): number {
  const combined = roundHalfUp(
    MODEL_B_PARAMETER_REGISTRY.paceLoadFactors[tactics.pace] *
      MODEL_B_PARAMETER_REGISTRY.defenseLoadFactors[tactics.defensiveFocus],
    1_000,
  );
  return clampFixedPoint(
    combined,
    MODEL_B_PARAMETER_REGISTRY.tacticalLoadMinimumMilli,
    MODEL_B_PARAMETER_REGISTRY.tacticalLoadMaximumMilli,
  );
}

export function calculateCommittedFatigueIncrementMilli(
  input: Readonly<{
    matchKind: MatchInput['matchKind'];
    seconds: number;
    stamina: number;
    tactics: MatchTactics;
  }>,
): number {
  if (!Number.isSafeInteger(input.seconds) || input.seconds < 0) {
    throw new Error('Committed fatigue seconds must be a non-negative safe integer.');
  }
  if (!Number.isSafeInteger(input.stamina) || input.stamina < 0 || input.stamina > 100) {
    throw new Error('Stamina must be an integer in 0..100.');
  }
  const staminaFactorMilli =
    1_000 - input.stamina * MODEL_B_PARAMETER_REGISTRY.staminaLoadReductionMilliPerPoint;
  const numerator =
    MODEL_B_PARAMETER_REGISTRY.loadByMatchKind[input.matchKind] *
    input.seconds *
    staminaFactorMilli *
    calculateTacticalLoadFactorMilli(input.tactics);
  return roundHalfUp(numerator, 2_400 * 1_000 * 1_000);
}

export function calculateEffectiveExecutionStages(
  input: EffectiveExecutionInput,
): EffectiveExecutionStages {
  assertMilli(input.chemistryModifierMilli, 'chemistryModifierMilli');
  const abilityBlendMilli = calculateAbilityBlendMilli(input.player, input.blend);
  const fatiguePenaltyMilli = calculateFatiguePenaltyMilli(
    input.player.fatigueMilli,
    input.fatigueSensitivity,
  );
  const afterFatigueMilli = abilityBlendMilli - fatiguePenaltyMilli;
  const positionModifierMilli = calculatePositionModifierMilli(
    input.player,
    input.assignedPosition,
    input.applyPositionMismatch,
  );
  const afterPositionMilli = afterFatigueMilli + positionModifierMilli;
  const traitModifierMilli = calculateTraitModifierMilli(input.player, input.traitContext);
  const afterTraitMilli = afterPositionMilli + traitModifierMilli;
  const chemistryModifierMilli = input.applyChemistry ? input.chemistryModifierMilli : 0;
  const afterChemistryMilli = afterTraitMilli + chemistryModifierMilli;
  const tacticalModifierMilli = capTacticalModifierMilli(input.tacticalModifierMilli);
  return Object.freeze({
    abilityBlendMilli,
    fatiguePenaltyMilli,
    afterFatigueMilli,
    positionModifierMilli,
    afterPositionMilli,
    traitModifierMilli,
    afterTraitMilli,
    chemistryModifierMilli,
    afterChemistryMilli,
    tacticalModifierMilli,
    finalExecutionMilli: clampFixedPoint(afterChemistryMilli + tacticalModifierMilli, 0, 100_000),
  });
}

export function calculateLineupChemistryMilli(
  players: readonly MatchPlayerSnapshot[],
  roles: MatchRoles,
): number {
  if (players.length < 2 || players.length > 5) {
    throw new Error('Lineup chemistry requires the actual 2..5 eligible players.');
  }
  const uniqueIds = new Set(players.map(({ playerId }) => playerId));
  if (uniqueIds.size !== players.length)
    throw new Error('Lineup chemistry players must be unique.');
  let weightedChemistry = 0;
  let totalWeight = 0;
  for (const player of players) {
    const weights = [MODEL_B_PARAMETER_REGISTRY.chemistryRoleWeights.DEFAULT];
    if (roles.primaryOrganizer === player.playerId) {
      weights.push(MODEL_B_PARAMETER_REGISTRY.chemistryRoleWeights.PRIMARY_ORGANIZER);
    }
    if (roles.offensiveHub === player.playerId) {
      weights.push(MODEL_B_PARAMETER_REGISTRY.chemistryRoleWeights.OFFENSIVE_HUB);
    }
    if (roles.defensiveCaptain === player.playerId) {
      weights.push(MODEL_B_PARAMETER_REGISTRY.chemistryRoleWeights.DEFENSIVE_CAPTAIN);
    }
    const weight = Math.max(...weights);
    weightedChemistry += player.chemistryMilli * weight;
    totalWeight += weight;
  }
  return roundHalfUp(weightedChemistry, totalWeight);
}

export function calculateChemistryExecutionModifierMilli(chemistryMilli: number): number {
  assertMilli(chemistryMilli, 'chemistryMilli', 0, 100_000);
  return clampFixedPoint(
    roundHalfUp(
      (chemistryMilli - 50_000) * MODEL_B_PARAMETER_REGISTRY.chemistryExecutionRateMilli,
      1_000,
    ),
    MODEL_B_PARAMETER_REGISTRY.chemistryExecutionMinimumMilli,
    MODEL_B_PARAMETER_REGISTRY.chemistryExecutionMaximumMilli,
  );
}

export function calculateTeamCoordinationIndexMilli(teamExecutionModifierMilli: number): number {
  assertMilli(teamExecutionModifierMilli, 'teamExecutionModifierMilli');
  const parameters = MODEL_B_PARAMETER_REGISTRY.teamCoordination;
  return clampFixedPoint(
    parameters.baseMilli + teamExecutionModifierMilli * parameters.teamExecutionMultiplier,
    parameters.minimumMilli,
    parameters.maximumMilli,
  );
}

export function calculateOpportunityQualityMilli(
  input: Readonly<{
    creationExecutionMilli: number;
    teamCoordinationMilli: number;
    spacingMilli: number;
    helpEnvironmentMilli: number;
    tacticalOpportunityModifierMilli: number;
    possessionDeltasMilli?: readonly number[];
  }>,
): number {
  const parameters = MODEL_B_PARAMETER_REGISTRY.opportunityQuality;
  for (const [label, value] of Object.entries(input)) {
    if (label === 'possessionDeltasMilli') continue;
    assertMilli(value as number, label);
  }
  const base = roundHalfUp(
    input.creationExecutionMilli * parameters.creationWeightMilli +
      input.teamCoordinationMilli * parameters.coordinationWeightMilli +
      input.spacingMilli * parameters.spacingWeightMilli +
      input.helpEnvironmentMilli * parameters.helpEnvironmentWeightMilli,
    1_000,
  );
  const eventDeltas = (input.possessionDeltasMilli ?? []).map((value) =>
    clampFixedPoint(
      value,
      -MODEL_B_PARAMETER_REGISTRY.opportunityPerEventCapMilli,
      MODEL_B_PARAMETER_REGISTRY.opportunityPerEventCapMilli,
    ),
  );
  const netDelta = clampFixedPoint(
    eventDeltas.reduce((total, value) => total + value, 0),
    -MODEL_B_PARAMETER_REGISTRY.opportunityPossessionCapMilli,
    MODEL_B_PARAMETER_REGISTRY.opportunityPossessionCapMilli,
  );
  return clampFixedPoint(
    base + capTacticalModifierMilli(input.tacticalOpportunityModifierMilli) + netDelta,
    parameters.minimumMilli,
    parameters.maximumMilli,
  );
}

export function stableSortPlayersById(
  players: readonly MatchPlayerSnapshot[],
): MatchPlayerSnapshot[] {
  return [...players].sort((left, right) => compareUtf16CodeUnits(left.playerId, right.playerId));
}
