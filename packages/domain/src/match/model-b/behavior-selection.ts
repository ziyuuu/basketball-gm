import { compareUtf16CodeUnits, roundHalfUp } from '../../core/index.js';
import { keyedDrawInt, type MatchDrawKey } from '../keyed-rng.js';
import type { MatchAnchor, MatchInput } from '../schemas.js';
import {
  calculateAbilityBlendMilli,
  modelBAbilityValues,
  stableSortPlayersById,
  type MatchPlayerSnapshot,
} from './effective-values.js';
import {
  MODEL_B_BEHAVIOR_REGISTRY,
  MODEL_B_DEFENSIVE_DUTY_REGISTRY,
  type BehaviorRegistryEntry,
  type ModelBBehaviorId,
} from './registries.js';

export type ModelBDrawContext = Readonly<{
  matchSeed: MatchInput['matchSeed'];
  period: number;
  possessionIndex: number;
  segmentIndex: number;
}>;

export type ModelBShotSelectionZone = 'INSIDE' | 'MID_RANGE' | 'THREE_POINT';

export type ModelBBehaviorCandidate = Readonly<{
  behavior: BehaviorRegistryEntry;
  weight: number;
  tendencyBasisPoints: number;
  tacticalMultiplierMilli: number;
  sceneAvailabilityMilli: number;
}>;

export type ModelBWeightedSelection<T> = Readonly<{
  value: T;
  drawKey: MatchDrawKey | null;
  totalWeight: number;
  usedFallback: boolean;
}>;

const BEHAVIOR_BY_ID = new Map(
  MODEL_B_BEHAVIOR_REGISTRY.map((entry) => [entry.behaviorId, entry] as const),
);

export const MODEL_B_PASS_BEHAVIOR_IDS = Object.freeze([
  'PASS',
  'HPASS',
  'CREATIVE_PASS',
  'ASTOPP',
  'HELDKICK',
] as const satisfies readonly ModelBBehaviorId[]);

export const MODEL_B_CREATION_EXIT_REGISTRY = Object.freeze({
  DRIVE: Object.freeze(['LAYUP', 'CONTACTFIN', 'HELDKICK'] as const),
  SHAKE: Object.freeze(['SPOTUP', 'PULLUP', 'THREE'] as const),
  ISO: Object.freeze(['PULLUP', 'MID'] as const),
  STEP_BACK: Object.freeze(['MID'] as const),
  POSTUP: Object.freeze(['HOOK', 'CLOSE'] as const),
  HIGH_POST_CREATION: Object.freeze(['HPASS', 'SPOTUP'] as const),
});

export type ModelBCreationBehaviorId = keyof typeof MODEL_B_CREATION_EXIT_REGISTRY;

const RANDOM_ACTOR_BEHAVIORS = new Set<ModelBBehaviorId>([
  'SCREEN',
  'CUT',
  'DOUBLECREATE',
  'PRESS',
  'STLTRY',
]);

const RANDOM_RECEIVER_OR_BENEFICIARY_BEHAVIORS = new Set<ModelBBehaviorId>([
  ...MODEL_B_PASS_BEHAVIOR_IDS,
  'SCREEN',
  'CUT',
  'DOUBLECREATE',
  'HIGH_POST_CREATION',
]);

const DUTY_ADJUSTED_BEHAVIORS = new Set<ModelBBehaviorId>(['HELPD', 'CONTEST', 'PRESS', 'STLTRY']);

const POSITION_ORDER = Object.freeze(['PG', 'SG', 'SF', 'PF', 'C'] as const);
export type ModelBLineup = MatchAnchor['lineups']['home'];
export type ModelBDefensiveSlot = (typeof POSITION_ORDER)[number];

export type ModelBBehaviorCandidateInput = Readonly<{
  decisionPlayer: MatchPlayerSnapshot;
  legalBehaviorIds: readonly ModelBBehaviorId[];
  sceneAvailabilityMilliByBehavior?: Partial<Record<ModelBBehaviorId, number>>;
  tacticalMultiplierMilliByBehavior?: Partial<Record<ModelBBehaviorId, number>>;
  currentLineup?: ModelBLineup;
  eligibleDefenderIds?: readonly string[];
  onBallDefenderId?: string;
  shotZone?: ModelBShotSelectionZone;
}>;

export type ModelBBehaviorSelectionInput = Readonly<{
  context: ModelBDrawContext;
  behaviorSelectionOrdinal: number;
  safeFallbackBehaviorId: ModelBBehaviorId;
}> &
  ModelBBehaviorCandidateInput;

export function deriveModelBDefensiveSlot(
  lineup: ModelBLineup,
  playerId: string,
): ModelBDefensiveSlot {
  const slot = POSITION_ORDER.find((candidate) => lineup[candidate] === playerId);
  if (slot === undefined) throw new Error(`${playerId} does not occupy a current lineup slot.`);
  return slot;
}

export function deriveModelBDefensiveDuty(
  lineup: ModelBLineup,
  playerId: string,
): (typeof MODEL_B_DEFENSIVE_DUTY_REGISTRY)[ModelBDefensiveSlot]['duty'] {
  return MODEL_B_DEFENSIVE_DUTY_REGISTRY[deriveModelBDefensiveSlot(lineup, playerId)].duty;
}

export function calculateModelBDutyAdjustedSceneAvailabilityMilli(
  input: Readonly<{
    ordinarySceneAvailabilityMilli: number;
    behaviorId: 'HELPD' | 'CONTEST' | 'PRESS' | 'STLTRY';
    assignedSlot: ModelBDefensiveSlot;
  }>,
): number {
  assertFactor(input.ordinarySceneAvailabilityMilli, 'ordinary scene availability', 1_000);
  return roundHalfUp(
    input.ordinarySceneAvailabilityMilli *
      MODEL_B_DEFENSIVE_DUTY_REGISTRY[input.assignedSlot].availabilityMilli[input.behaviorId],
    1_000,
  );
}

function assertOrdinal(value: number, minimum: number, maximum: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${label} must be a safe integer in ${minimum}..${maximum}.`);
  }
}

function assertFactor(value: number, label: string, maximum: number): void {
  if (!Number.isSafeInteger(value) || value < 0 || value > maximum) {
    throw new Error(`${label} must be a safe integer in 0..${maximum}.`);
  }
}

function drawKey(
  context: ModelBDrawContext,
  drawKind: MatchDrawKey['drawKind'],
  localIndex: number,
): MatchDrawKey {
  return {
    matchSeed: context.matchSeed,
    period: context.period,
    possessionIndex: context.possessionIndex,
    segmentIndex: context.segmentIndex,
    drawKind,
    localIndex,
  };
}

function selectableBehavior(behaviorId: ModelBBehaviorId): BehaviorRegistryEntry {
  const behavior = BEHAVIOR_BY_ID.get(behaviorId);
  if (behavior === undefined) throw new Error(`Unknown Model B behavior: ${behaviorId}.`);
  if (!behavior.selectable) {
    throw new Error(`Non-selectable behavior ${behaviorId} cannot enter P_select.`);
  }
  return behavior;
}

function weightedSelection<T>(
  values: readonly T[],
  weights: readonly number[],
  key: MatchDrawKey,
  fallback: T | null,
): ModelBWeightedSelection<T> {
  if (values.length === 0 || values.length !== weights.length) {
    throw new Error('A weighted Model B selection requires aligned non-empty candidates.');
  }
  let totalWeight = 0;
  for (const weight of weights) {
    if (!Number.isSafeInteger(weight) || weight < 0) {
      throw new Error('Model B candidate weights must be non-negative safe integers.');
    }
    totalWeight += weight;
    if (!Number.isSafeInteger(totalWeight)) {
      throw new Error('Model B candidate weight total exceeds the safe integer range.');
    }
  }
  if (totalWeight === 0) {
    if (fallback === null) throw new Error('Zero total weight requires a fixed safe fallback.');
    return Object.freeze({ value: fallback, drawKey: null, totalWeight, usedFallback: true });
  }
  const target = keyedDrawInt(key, 0, totalWeight - 1);
  let cumulative = 0;
  for (let index = 0; index < values.length; index += 1) {
    cumulative += weights[index]!;
    if (target < cumulative) {
      return Object.freeze({
        value: values[index]!,
        drawKey: Object.freeze(key),
        totalWeight,
        usedFallback: false,
      });
    }
  }
  throw new Error('Model B weighted selection failed to resolve its exact integer draw.');
}

function tendencyValue(
  player: MatchPlayerSnapshot,
  key: string,
  shotZone: ModelBShotSelectionZone | undefined,
): number {
  switch (key) {
    case 'possessionParticipation':
      return player.tendencies.possessionParticipation;
    case 'passSelection':
      return player.tendencies.passSelection;
    case 'transitionParticipation':
      return player.tendencies.transitionParticipation;
    case 'defensiveRisk':
      return player.tendencies.defensiveRisk;
    case '100-defensiveRisk':
      return 100 - player.tendencies.defensiveRisk;
    case '100-transitionParticipation':
      return 100 - player.tendencies.transitionParticipation;
    case 'shotZones.inside':
      return player.tendencies.shotZones.inside;
    case 'shotZones.midRange':
      return player.tendencies.shotZones.midRange;
    case 'shotZones.perimeter':
      return player.tendencies.shotZones.perimeter;
    case 'shotZones.perimeter+midRange':
      return player.tendencies.shotZones.perimeter + player.tendencies.shotZones.midRange;
    case 'shotZones.perimeter/midRange':
      if (shotZone === 'MID_RANGE') return player.tendencies.shotZones.midRange;
      if (shotZone === 'THREE_POINT') return player.tendencies.shotZones.perimeter;
      if (shotZone === 'INSIDE') return 0;
      return player.tendencies.shotZones.perimeter + player.tendencies.shotZones.midRange;
    default:
      throw new Error(`Unknown Model B tendency key: ${key}.`);
  }
}

/** Exact product of the registry tendency factors on a common 0..10,000 basis. */
export function calculateModelBBehaviorTendencyBasisPoints(
  player: MatchPlayerSnapshot,
  behaviorId: ModelBBehaviorId,
  shotZone?: ModelBShotSelectionZone,
): number {
  const behavior = selectableBehavior(behaviorId);
  if (behavior.tendencyKeys.length === 0) return 10_000;
  let numerator = 1;
  for (const key of behavior.tendencyKeys) numerator *= tendencyValue(player, key, shotZone);
  const denominator = 100 ** behavior.tendencyKeys.length;
  const basisPoints = (numerator * 10_000) / denominator;
  if (!Number.isSafeInteger(basisPoints)) {
    throw new Error(`Behavior ${behaviorId} produced a non-integral tendency factor.`);
  }
  return basisPoints;
}

export function buildModelBBehaviorCandidates(
  input: ModelBBehaviorCandidateInput,
): readonly ModelBBehaviorCandidate[] {
  const legalIds = new Set(input.legalBehaviorIds);
  if (legalIds.size !== input.legalBehaviorIds.length) {
    throw new Error('Model B legal behavior IDs must be unique.');
  }
  for (const behaviorId of legalIds) selectableBehavior(behaviorId);
  return Object.freeze(
    MODEL_B_BEHAVIOR_REGISTRY.filter(
      (behavior): behavior is BehaviorRegistryEntry =>
        behavior.selectable && legalIds.has(behavior.behaviorId as ModelBBehaviorId),
    ).map((behavior) => {
      const behaviorId = behavior.behaviorId as ModelBBehaviorId;
      let ordinarySceneAvailabilityMilli =
        input.sceneAvailabilityMilliByBehavior?.[behaviorId] ?? 1_000;
      assertFactor(
        ordinarySceneAvailabilityMilli,
        `${behaviorId} ordinary scene availability`,
        1_000,
      );
      if (DUTY_ADJUSTED_BEHAVIORS.has(behaviorId) && input.currentLineup === undefined) {
        throw new Error(`${behaviorId} requires the current defensive lineup.`);
      }
      if (behaviorId === 'HELPD') {
        if (input.eligibleDefenderIds === undefined || input.onBallDefenderId === undefined) {
          throw new Error('HELPD requires the current eligible defenders and on-ball defender.');
        }
        deriveModelBDefensiveSlot(input.currentLineup!, input.onBallDefenderId);
        if (!input.eligibleDefenderIds.includes(input.onBallDefenderId)) {
          throw new Error('HELPD requires an eligible on-ball defender.');
        }
        const lineupIds = new Set(Object.values(input.currentLineup!));
        const hasHelper = input.eligibleDefenderIds.some(
          (playerId) => lineupIds.has(playerId) && playerId !== input.onBallDefenderId,
        );
        if (!hasHelper) ordinarySceneAvailabilityMilli = 0;
      }
      const sceneAvailabilityMilli = DUTY_ADJUSTED_BEHAVIORS.has(behaviorId)
        ? calculateModelBDutyAdjustedSceneAvailabilityMilli({
            ordinarySceneAvailabilityMilli,
            behaviorId: behaviorId as 'HELPD' | 'CONTEST' | 'PRESS' | 'STLTRY',
            assignedSlot: deriveModelBDefensiveSlot(
              input.currentLineup!,
              input.decisionPlayer.playerId,
            ),
          })
        : ordinarySceneAvailabilityMilli;
      const tacticalMultiplierMilli =
        input.tacticalMultiplierMilliByBehavior?.[behaviorId] ?? 1_000;
      assertFactor(sceneAvailabilityMilli, `${behaviorId} scene availability`, 1_000);
      assertFactor(tacticalMultiplierMilli, `${behaviorId} tactical multiplier`, 10_000);
      const tendencyBasisPoints = calculateModelBBehaviorTendencyBasisPoints(
        input.decisionPlayer,
        behaviorId,
        input.shotZone,
      );
      const weight =
        behavior.baseWeight *
        tendencyBasisPoints *
        tacticalMultiplierMilli *
        sceneAvailabilityMilli;
      if (!Number.isSafeInteger(weight)) {
        throw new Error(`Behavior ${behaviorId} weight exceeds the safe integer range.`);
      }
      return Object.freeze({
        behavior,
        weight,
        tendencyBasisPoints,
        tacticalMultiplierMilli,
        sceneAvailabilityMilli,
      });
    }),
  );
}

export function selectModelBBehavior(
  input: ModelBBehaviorSelectionInput,
): ModelBWeightedSelection<ModelBBehaviorCandidate> {
  assertOrdinal(input.behaviorSelectionOrdinal, 0, 999, 'behaviorSelectionOrdinal');
  const candidates = buildModelBBehaviorCandidates(input);
  const fallback = candidates.find(
    ({ behavior, sceneAvailabilityMilli }) =>
      behavior.behaviorId === input.safeFallbackBehaviorId && sceneAvailabilityMilli > 0,
  );
  if (fallback === undefined) {
    throw new Error('The fixed safe fallback must be a legal and available selectable behavior.');
  }
  return weightedSelection(
    candidates,
    candidates.map(({ weight }) => weight),
    drawKey(input.context, 'BEHAVIOR', input.behaviorSelectionOrdinal),
    fallback,
  );
}

export function selectModelBCreationExit(
  input: Omit<Parameters<typeof selectModelBBehavior>[0], 'legalBehaviorIds'> &
    Readonly<{ creationBehaviorId: ModelBCreationBehaviorId }>,
): ModelBWeightedSelection<ModelBBehaviorCandidate> {
  return selectModelBBehavior({
    ...input,
    legalBehaviorIds: MODEL_B_CREATION_EXIT_REGISTRY[input.creationBehaviorId],
  });
}

export function modelBHandlerLocalIndex(handlerInstanceIndex: number): number {
  assertOrdinal(handlerInstanceIndex, 0, 998, 'handlerInstanceIndex');
  return handlerInstanceIndex + 1;
}

export function modelBReceiverLocalIndex(behaviorSelectionOrdinal: number): number {
  assertOrdinal(behaviorSelectionOrdinal, 0, 999, 'behaviorSelectionOrdinal');
  return 2_000 + behaviorSelectionOrdinal;
}

export function modelBActorLocalIndex(behaviorSelectionOrdinal: number): number {
  assertOrdinal(behaviorSelectionOrdinal, 0, 999, 'behaviorSelectionOrdinal');
  return 3_000 + behaviorSelectionOrdinal;
}

export function modelBCreationExecutionLocalIndex(behaviorSelectionOrdinal: number): number {
  assertOrdinal(behaviorSelectionOrdinal, 0, 999, 'behaviorSelectionOrdinal');
  return 1_000 + behaviorSelectionOrdinal;
}

export function modelBOffBallExecutionLocalIndex(behaviorSelectionOrdinal: number): number {
  assertOrdinal(behaviorSelectionOrdinal, 0, 999, 'behaviorSelectionOrdinal');
  return 3_000 + behaviorSelectionOrdinal;
}

export function modelBDefenseExecutionLocalIndex(behaviorSelectionOrdinal: number): number {
  assertOrdinal(behaviorSelectionOrdinal, 0, 999, 'behaviorSelectionOrdinal');
  return 1_000 + behaviorSelectionOrdinal;
}

export function modelBTurnoverLocalIndex(behaviorSelectionOrdinal: number): number {
  assertOrdinal(behaviorSelectionOrdinal, 0, 999, 'behaviorSelectionOrdinal');
  return 2_000 + behaviorSelectionOrdinal;
}

export function modelBOffensiveFoulLocalIndex(behaviorSelectionOrdinal: number): number {
  assertOrdinal(behaviorSelectionOrdinal, 0, 999, 'behaviorSelectionOrdinal');
  return 4_000 + behaviorSelectionOrdinal;
}

export function modelBDefensiveFoulLocalIndex(behaviorSelectionOrdinal: number): number {
  assertOrdinal(behaviorSelectionOrdinal, 0, 999, 'behaviorSelectionOrdinal');
  return 5_000 + behaviorSelectionOrdinal;
}

export function selectModelBHandler(
  input: Readonly<{
    context: ModelBDrawContext;
    handlerInstanceIndex: number;
    candidates: readonly MatchPlayerSnapshot[];
  }>,
): ModelBWeightedSelection<MatchPlayerSnapshot> {
  const candidates = stableSortPlayersById(input.candidates);
  if (candidates.length === 0) throw new Error('A handler selection requires an eligible player.');
  return weightedSelection(
    candidates,
    candidates.map(({ tendencies }) => tendencies.possessionParticipation),
    drawKey(input.context, 'BALL_HANDLER', modelBHandlerLocalIndex(input.handlerInstanceIndex)),
    candidates[0]!,
  );
}

export function selectModelBReceiverOrBeneficiary(
  input: Readonly<{
    context: ModelBDrawContext;
    behaviorId: ModelBBehaviorId;
    behaviorSelectionOrdinal: number;
    candidates: readonly MatchPlayerSnapshot[];
    excludedPlayerIds: readonly string[];
  }>,
): ModelBWeightedSelection<MatchPlayerSnapshot> | null {
  if (!RANDOM_RECEIVER_OR_BENEFICIARY_BEHAVIORS.has(input.behaviorId)) {
    throw new Error(`Behavior ${input.behaviorId} does not use a receiver or beneficiary draw.`);
  }
  const excluded = new Set(input.excludedPlayerIds);
  const candidates = stableSortPlayersById(
    input.candidates.filter(({ playerId }) => !excluded.has(playerId)),
  );
  if (candidates.length === 0) return null;
  return weightedSelection(
    candidates,
    candidates.map(() => 1),
    drawKey(
      input.context,
      'BALL_HANDLER',
      modelBReceiverLocalIndex(input.behaviorSelectionOrdinal),
    ),
    candidates[0]!,
  );
}

export function selectModelBHelpDefender(
  input: Readonly<{
    context: ModelBDrawContext;
    behaviorSelectionOrdinal: number;
    currentLineup: ModelBLineup;
    candidates: readonly MatchPlayerSnapshot[];
    onBallDefenderId: string;
  }>,
): ModelBWeightedSelection<MatchPlayerSnapshot> | null {
  const lineupIds = new Set(Object.values(input.currentLineup));
  if (!lineupIds.has(input.onBallDefenderId)) {
    throw new Error('The HELPD on-ball defender must occupy a current lineup slot.');
  }
  const candidates = stableSortPlayersById(
    input.candidates.filter(
      ({ playerId }) => lineupIds.has(playerId) && playerId !== input.onBallDefenderId,
    ),
  );
  if (candidates.length === 0) return null;
  return weightedSelection(
    candidates,
    candidates.map(
      ({ playerId }) =>
        MODEL_B_DEFENSIVE_DUTY_REGISTRY[deriveModelBDefensiveSlot(input.currentLineup, playerId)]
          .helpSelectionWeight,
    ),
    drawKey(input.context, 'BALL_HANDLER', modelBActorLocalIndex(input.behaviorSelectionOrdinal)),
    null,
  );
}

export function selectModelBActor(
  input: Readonly<{
    context: ModelBDrawContext;
    behaviorId: ModelBBehaviorId;
    behaviorSelectionOrdinal: number;
    candidates: readonly MatchPlayerSnapshot[];
    excludedPlayerIds: readonly string[];
  }>,
): ModelBWeightedSelection<MatchPlayerSnapshot> | null {
  if (!RANDOM_ACTOR_BEHAVIORS.has(input.behaviorId)) {
    throw new Error(`Behavior ${input.behaviorId} does not use a random actor draw.`);
  }
  const excluded = new Set(input.excludedPlayerIds);
  const candidates = stableSortPlayersById(
    input.candidates.filter(({ playerId }) => !excluded.has(playerId)),
  );
  if (candidates.length === 0) return null;
  return weightedSelection(
    candidates,
    candidates.map(() => 1),
    drawKey(input.context, 'BALL_HANDLER', modelBActorLocalIndex(input.behaviorSelectionOrdinal)),
    candidates[0]!,
  );
}

export function selectModelBDoubleTeamActors(
  candidates: readonly MatchPlayerSnapshot[],
): readonly [MatchPlayerSnapshot, MatchPlayerSnapshot] | null {
  if (candidates.length < 2) return null;
  const ordered = [...candidates].sort(
    (left, right) =>
      modelBAbilityValues(right).interiorDefense - modelBAbilityValues(left).interiorDefense ||
      compareUtf16CodeUnits(left.playerId, right.playerId),
  );
  return Object.freeze([ordered[0]!, ordered[1]!] as const);
}

export function deriveModelBBoxoutActor(
  input: Readonly<{
    candidates: readonly MatchPlayerSnapshot[];
    excludedPlayerIds: readonly string[];
    personalReboundExecutionMilliByPlayerId: Readonly<Record<string, number>>;
  }>,
): MatchPlayerSnapshot | null {
  const excluded = new Set(input.excludedPlayerIds);
  const candidates = input.candidates.filter(({ playerId }) => !excluded.has(playerId));
  if (candidates.length === 0) return null;
  for (const { playerId } of candidates) {
    const execution = input.personalReboundExecutionMilliByPlayerId[playerId];
    if (!Number.isSafeInteger(execution)) {
      throw new Error(`BOXOUT requires a personal rebound execution for ${playerId}.`);
    }
  }
  return [...candidates].sort((left, right) => {
    const executionDifference =
      input.personalReboundExecutionMilliByPlayerId[right.playerId]! -
      input.personalReboundExecutionMilliByPlayerId[left.playerId]!;
    return executionDifference || compareUtf16CodeUnits(left.playerId, right.playerId);
  })[0]!;
}

function deterministicDutyCandidate(
  input: Readonly<{
    currentLineup: ModelBLineup;
    candidates: readonly MatchPlayerSnapshot[];
    excludedPlayerIds?: readonly string[];
    executionBlend: 'BLOCK' | 'PASS_INTERCEPTION';
    modifier: 'blockCandidateModifierMilli' | 'passInterceptionCandidateModifierMilli';
  }>,
): MatchPlayerSnapshot | null {
  const lineupIds = new Set(Object.values(input.currentLineup));
  const excludedIds = new Set(input.excludedPlayerIds ?? []);
  const candidates = input.candidates.filter(
    ({ playerId }) => lineupIds.has(playerId) && !excludedIds.has(playerId),
  );
  if (candidates.length === 0) return null;
  return [...candidates].sort((left, right) => {
    const score = (player: MatchPlayerSnapshot): number => {
      const slot = deriveModelBDefensiveSlot(input.currentLineup, player.playerId);
      return (
        calculateAbilityBlendMilli(player, input.executionBlend) +
        MODEL_B_DEFENSIVE_DUTY_REGISTRY[slot][input.modifier]
      );
    };
    return score(right) - score(left) || compareUtf16CodeUnits(left.playerId, right.playerId);
  })[0]!;
}

export function deriveModelBBlockHelpCandidate(
  input: Readonly<{
    currentLineup: ModelBLineup;
    candidates: readonly MatchPlayerSnapshot[];
    directDefenderId: string;
  }>,
): MatchPlayerSnapshot | null {
  deriveModelBDefensiveSlot(input.currentLineup, input.directDefenderId);
  return deterministicDutyCandidate({
    ...input,
    excludedPlayerIds: [input.directDefenderId],
    executionBlend: 'BLOCK',
    modifier: 'blockCandidateModifierMilli',
  });
}

export function deriveModelBPassInterceptionCandidate(
  input: Readonly<{
    currentLineup: ModelBLineup;
    candidates: readonly MatchPlayerSnapshot[];
  }>,
): MatchPlayerSnapshot | null {
  return deterministicDutyCandidate({
    ...input,
    executionBlend: 'PASS_INTERCEPTION',
    modifier: 'passInterceptionCandidateModifierMilli',
  });
}

export function resolveModelBDirectOpponent(
  input: Readonly<{
    actorPlayerId: string;
    actorLineup: Readonly<Record<(typeof POSITION_ORDER)[number], string>>;
    opponentLineup: Readonly<Record<(typeof POSITION_ORDER)[number], string>>;
    eligibleOpponentIds: readonly string[];
  }>,
): string | null {
  const actorPosition = POSITION_ORDER.find(
    (position) => input.actorLineup[position] === input.actorPlayerId,
  );
  if (actorPosition === undefined) throw new Error('The actor must occupy a current lineup slot.');
  const eligible = new Set(input.eligibleOpponentIds);
  const directOpponent = input.opponentLineup[actorPosition];
  if (eligible.has(directOpponent)) return directOpponent;
  const actorPositionIndex = POSITION_ORDER.indexOf(actorPosition);
  const fallbacks = POSITION_ORDER.map((position, index) => ({
    playerId: input.opponentLineup[position],
    distance: Math.abs(index - actorPositionIndex),
  })).filter(({ playerId }) => eligible.has(playerId));
  fallbacks.sort(
    (left, right) =>
      left.distance - right.distance || compareUtf16CodeUnits(left.playerId, right.playerId),
  );
  return fallbacks[0]?.playerId ?? null;
}

/** PASS-family resolution has exactly one result draw: TURNOVER_OCCURRENCE 2000+selection. */
export function modelBPassResultDrawKey(
  context: ModelBDrawContext,
  behaviorId: (typeof MODEL_B_PASS_BEHAVIOR_IDS)[number],
  behaviorSelectionOrdinal: number,
): MatchDrawKey {
  if (!MODEL_B_PASS_BEHAVIOR_IDS.includes(behaviorId)) {
    throw new Error(`${behaviorId} is not a Model B PASS-family behavior.`);
  }
  return drawKey(
    context,
    'TURNOVER_OCCURRENCE',
    modelBTurnoverLocalIndex(behaviorSelectionOrdinal),
  );
}

export function selectModelBDefensiveMode(
  input: Readonly<{
    context: ModelBDrawContext;
    defender: MatchPlayerSnapshot;
    modeInstanceIndex: number;
  }>,
): ModelBWeightedSelection<'SAFE' | 'RISKY'> {
  assertOrdinal(input.modeInstanceIndex, 0, 99, 'modeInstanceIndex');
  const risk = input.defender.tendencies.defensiveRisk;
  return weightedSelection(
    ['SAFE', 'RISKY'],
    [100 - risk, risk],
    drawKey(input.context, 'DEFENSIVE_ACTION', input.modeInstanceIndex),
    'SAFE',
  );
}
