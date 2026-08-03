import { compareUtf16CodeUnits } from '../../core/index.js';
import { keyedDrawInt, keyedDrawUint64, type MatchDrawKey } from '../keyed-rng.js';
import type { MatchEvent } from '../schemas.js';
import {
  deriveModelBBoxoutActor,
  modelBDefensiveFoulLocalIndex,
  modelBOffensiveFoulLocalIndex,
  modelBPassResultDrawKey,
  modelBTurnoverLocalIndex,
  type MODEL_B_PASS_BEHAVIOR_IDS,
  type ModelBDrawContext,
} from './behavior-selection.js';
import type { MatchPlayerSnapshot } from './effective-values.js';
import { calculateFreeThrowProbabilityMilli } from './probabilities.js';
import { MODEL_B_PARAMETER_REGISTRY, type ModelBBehaviorId } from './registries.js';
import { predictModelBEventId, type ModelBFactDraft, type ModelBSession } from './session.js';

export type ModelBResolutionDraft = Readonly<{
  eventPayloads: readonly MatchEvent['payload'][];
  facts: readonly ModelBFactDraft[];
  drawKeys: readonly MatchDrawKey[];
}>;

export type ModelBReboundCandidate = Readonly<{
  player: MatchPlayerSnapshot;
  personalReboundExecutionMilli: number;
}>;

const CREATION_FACT_BEHAVIORS = new Set<ModelBBehaviorId>([
  'DRIVE',
  'SHAKE',
  'ISO',
  'STEP_BACK',
  'POSTUP',
  'HIGH_POST_CREATION',
  'SCREEN',
  'CUT',
  'HELDKICK',
  'DOUBLECREATE',
  'CREATIVE_PASS',
]);

const DRAW_DOMAIN = 0x1_0000_0000_0000_0000n;

function currentContext(session: ModelBSession): ModelBDrawContext {
  const anchor = session.anchors.at(-1);
  if (anchor === undefined) throw new Error('A Model B session requires a current Anchor.');
  return {
    matchSeed: session.input.matchSeed,
    period: anchor.period,
    possessionIndex: anchor.possession.possessionIndex,
    segmentIndex: anchor.possession.segmentIndex,
  };
}

function withDrawKind(
  context: ModelBDrawContext,
  drawKind: MatchDrawKey['drawKind'],
  localIndex: number,
): MatchDrawKey {
  return { ...context, drawKind, localIndex };
}

function assertProbabilityMilli(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0 || value > 1_000) {
    throw new Error(`${label} must be a probability integer in 0..1000.`);
  }
}

function assertTransitionOffset(value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error('transitionEventOffset must be a non-negative safe integer.');
  }
}

function drawOccurs(key: MatchDrawKey, probabilityMilli: number): boolean {
  assertProbabilityMilli(probabilityMilli, 'Model B draw probability');
  return keyedDrawInt(key, 0, 999) < probabilityMilli;
}

function emptyResolution(): ModelBResolutionDraft {
  return Object.freeze({ eventPayloads: [], facts: [], drawKeys: [] });
}

export function buildModelBCreationFactDraft(
  input: Readonly<{
    sourceEventIndexes: readonly number[];
    creatorId: string;
    beneficiaryId: string;
    behaviorId: ModelBBehaviorId;
    opportunityQualityDelta: number;
    defensiveResponse: 'NONE' | 'CONTESTED' | 'DOUBLE_TEAM' | 'COLLAPSED';
    period: number;
    possessionIndex: number;
    segmentIndex: number;
    nextBehaviorId: ModelBBehaviorId | null;
  }>,
): ModelBFactDraft {
  if (!CREATION_FACT_BEHAVIORS.has(input.behaviorId)) {
    throw new Error(`${input.behaviorId} cannot produce a CreationFact.`);
  }
  if (
    !Number.isSafeInteger(input.opportunityQualityDelta) ||
    Math.abs(input.opportunityQualityDelta) > MODEL_B_PARAMETER_REGISTRY.opportunityPerEventCapMilli
  ) {
    throw new Error('CreationFact must record the capped per-event opportunity delta.');
  }
  return Object.freeze({
    factKind: 'EXPLANATION',
    sourceEventIndexes: Object.freeze([...input.sourceEventIndexes]),
    payload: Object.freeze({
      type: 'CREATION',
      creatorId: input.creatorId,
      beneficiaryId: input.beneficiaryId,
      behaviorId: input.behaviorId,
      opportunityQualityDelta: input.opportunityQualityDelta,
      defensiveResponse: input.defensiveResponse,
      period: input.period,
      possessionIndex: input.possessionIndex,
      segmentIndex: input.segmentIndex,
      nextBehaviorId: input.nextBehaviorId,
    }),
  });
}

export function buildModelBPassFactDraft(
  input: Readonly<{
    sourceEventIndexes: readonly number[];
    passerId: string;
    receiverId: string;
    behaviorId: (typeof MODEL_B_PASS_BEHAVIOR_IDS)[number];
    possessionIndex: number;
    segmentIndex: number;
    sequence: number;
  }>,
): ModelBFactDraft {
  if (input.passerId === input.receiverId)
    throw new Error('A PASS fact cannot record a self-pass.');
  if (!Number.isSafeInteger(input.sequence) || input.sequence < 0) {
    throw new Error('A PASS fact sequence must be a non-negative safe integer.');
  }
  return Object.freeze({
    factKind: 'EXPLANATION',
    sourceEventIndexes: Object.freeze([...input.sourceEventIndexes]),
    payload: Object.freeze({
      type: 'PASS',
      passerId: input.passerId,
      receiverId: input.receiverId,
      behaviorId: input.behaviorId,
      possessionIndex: input.possessionIndex,
      segmentIndex: input.segmentIndex,
      sequence: input.sequence,
    }),
  });
}

export function buildModelBPossessionHandlerFactDraft(
  input: Readonly<{
    sourceEventIndexes: readonly number[];
    handlerPlayerId: string;
    period: number;
    possessionIndex: number;
    segmentIndex: number;
  }>,
): ModelBFactDraft {
  return Object.freeze({
    factKind: 'STATISTICAL',
    sourceEventIndexes: Object.freeze([...input.sourceEventIndexes]),
    payload: Object.freeze({
      type: 'POSSESSION_HANDLER',
      handlerPlayerId: input.handlerPlayerId,
      period: input.period,
      possessionIndex: input.possessionIndex,
      segmentIndex: input.segmentIndex,
    }),
  });
}

export function buildModelBTeamReboundFactDraft(
  input: Readonly<{
    sourceEventIndexes: readonly number[];
    awardedSide: 'HOME' | 'AWAY';
    period: number;
    possessionIndex: number;
    segmentIndex: number;
  }>,
): ModelBFactDraft {
  return Object.freeze({
    factKind: 'EXPLANATION',
    sourceEventIndexes: Object.freeze([...input.sourceEventIndexes]),
    payload: Object.freeze({
      type: 'TEAM_REBOUND',
      reason: 'UNCONTROLLED_OUT_OF_BOUNDS',
      awardedSide: input.awardedSide,
      period: input.period,
      possessionIndex: input.possessionIndex,
      segmentIndex: input.segmentIndex,
    }),
  });
}

export type ModelBTurnoverResolution = ModelBResolutionDraft &
  Readonly<{
    occurred: boolean;
    turnoverKind: 'PRESSURED_LIVE_BALL' | 'UNFORCED_DEAD_BALL' | null;
    stealOccurred: boolean;
    occurrenceDrawKey: MatchDrawKey;
  }>;

/** Resolves the one turnover chain shared by every selectable behavior. */
export function buildModelBTurnoverResolution(
  session: ModelBSession,
  input: Readonly<{
    transitionEventOffset: number;
    handlerPlayerId: string;
    behaviorSelectionOrdinal: number;
    occurrenceProbabilityMilli: number;
    pressuredClassificationProbabilityMilli: number;
    stealCandidate?: Readonly<{ playerId: string; attributionProbabilityMilli: number }>;
  }>,
): ModelBTurnoverResolution {
  assertTransitionOffset(input.transitionEventOffset);
  const context = currentContext(session);
  const occurrenceDrawKey = withDrawKind(
    context,
    'TURNOVER_OCCURRENCE',
    modelBTurnoverLocalIndex(input.behaviorSelectionOrdinal),
  );
  if (!drawOccurs(occurrenceDrawKey, input.occurrenceProbabilityMilli)) {
    return Object.freeze({
      ...emptyResolution(),
      drawKeys: Object.freeze([occurrenceDrawKey]),
      occurred: false,
      turnoverKind: null,
      stealOccurred: false,
      occurrenceDrawKey,
    });
  }

  assertProbabilityMilli(
    input.pressuredClassificationProbabilityMilli,
    'Pressured turnover classification probability',
  );
  const classificationKey = withDrawKind(context, 'TURNOVER_CLASSIFICATION', 0);
  const drawKeys: MatchDrawKey[] = [occurrenceDrawKey, classificationKey];
  const turnoverKind = drawOccurs(classificationKey, input.pressuredClassificationProbabilityMilli)
    ? ('PRESSURED_LIVE_BALL' as const)
    : ('UNFORCED_DEAD_BALL' as const);
  const eventPayloads: MatchEvent['payload'][] = [
    { type: 'TURNOVER', playerId: input.handlerPlayerId, turnoverKind },
  ];
  let stealOccurred = false;
  if (turnoverKind === 'PRESSURED_LIVE_BALL' && input.stealCandidate !== undefined) {
    const stealKey = withDrawKind(context, 'STEAL_ATTRIBUTION', 0);
    drawKeys.push(stealKey);
    stealOccurred = drawOccurs(stealKey, input.stealCandidate.attributionProbabilityMilli);
    if (stealOccurred) {
      eventPayloads.push({
        type: 'STEAL',
        playerId: input.stealCandidate.playerId,
        sourceEventId: predictModelBEventId(session, input.transitionEventOffset, 'TURNOVER'),
      });
    }
  }
  return Object.freeze({
    eventPayloads: Object.freeze(eventPayloads),
    facts: Object.freeze([]),
    drawKeys: Object.freeze(drawKeys),
    occurred: true,
    turnoverKind,
    stealOccurred,
    occurrenceDrawKey,
  });
}

export type ModelBPassResolution = ModelBResolutionDraft &
  Readonly<{
    turnoverOccurred: boolean;
    turnoverKind: 'PRESSURED_LIVE_BALL' | 'UNFORCED_DEAD_BALL' | null;
    stealOccurred: boolean;
    nextHandlerPlayerId: string | null;
    behaviorResultDrawKey: MatchDrawKey;
  }>;

export function buildModelBPassResolution(
  session: ModelBSession,
  input: Readonly<{
    transitionEventOffset: number;
    seconds: number;
    behaviorId: (typeof MODEL_B_PASS_BEHAVIOR_IDS)[number];
    behaviorSelectionOrdinal: number;
    passSequence: number;
    passerId: string;
    receiverId: string;
    turnoverProbabilityMilli: number;
    pressuredClassificationProbabilityMilli: number;
    stealCandidate?: Readonly<{ playerId: string; attributionProbabilityMilli: number }>;
  }>,
): ModelBPassResolution {
  assertTransitionOffset(input.transitionEventOffset);
  if (!Number.isSafeInteger(input.seconds) || input.seconds < 1) {
    throw new Error('A PASS behavior must consume at least one second.');
  }
  if (input.passerId === input.receiverId) {
    throw new Error('A PASS behavior cannot target its current passer.');
  }
  const context = currentContext(session);
  const behaviorResultDrawKey = modelBPassResultDrawKey(
    context,
    input.behaviorId,
    input.behaviorSelectionOrdinal,
  );
  const clockPayload = { type: 'CLOCK_ADVANCED' as const, seconds: input.seconds };
  const turnover = buildModelBTurnoverResolution(session, {
    transitionEventOffset: input.transitionEventOffset + 1,
    handlerPlayerId: input.passerId,
    behaviorSelectionOrdinal: input.behaviorSelectionOrdinal,
    occurrenceProbabilityMilli: input.turnoverProbabilityMilli,
    pressuredClassificationProbabilityMilli: input.pressuredClassificationProbabilityMilli,
    ...(input.stealCandidate === undefined ? {} : { stealCandidate: input.stealCandidate }),
  });
  if (!turnover.occurred) {
    const anchor = session.anchors.at(-1)!;
    return Object.freeze({
      eventPayloads: Object.freeze([clockPayload]),
      facts: Object.freeze([
        buildModelBPassFactDraft({
          sourceEventIndexes: [input.transitionEventOffset],
          passerId: input.passerId,
          receiverId: input.receiverId,
          behaviorId: input.behaviorId,
          possessionIndex: anchor.possession.possessionIndex,
          segmentIndex: anchor.possession.segmentIndex,
          sequence: input.passSequence,
        }),
      ]),
      drawKeys: turnover.drawKeys,
      turnoverOccurred: false,
      turnoverKind: null,
      stealOccurred: false,
      nextHandlerPlayerId: input.receiverId,
      behaviorResultDrawKey,
    });
  }
  return Object.freeze({
    eventPayloads: Object.freeze([clockPayload, ...turnover.eventPayloads]),
    facts: Object.freeze([]),
    drawKeys: turnover.drawKeys,
    turnoverOccurred: true,
    turnoverKind: turnover.turnoverKind,
    stealOccurred: turnover.stealOccurred,
    nextHandlerPlayerId: null,
    behaviorResultDrawKey,
  });
}

export type ModelBShotResolution = ModelBResolutionDraft &
  Readonly<{
    made: boolean;
    assistOccurred: boolean;
    blockOccurred: boolean;
    shotEventId: string;
  }>;

export function buildModelBShotResolution(
  session: ModelBSession,
  input: Readonly<{
    transitionEventOffset: number;
    shooterId: string;
    zone: 'INSIDE' | 'MID_RANGE' | 'THREE_POINT';
    shotInstanceIndex: number;
    makeProbabilityMilli: number;
    assistCandidate?: Readonly<{ playerId: string; attributionProbabilityMilli: number }>;
    blockCandidate?: Readonly<{ playerId: string; attributionProbabilityMilli: number }>;
  }>,
): ModelBShotResolution {
  assertTransitionOffset(input.transitionEventOffset);
  if (
    !Number.isSafeInteger(input.shotInstanceIndex) ||
    input.shotInstanceIndex < 0 ||
    input.shotInstanceIndex > 999
  ) {
    throw new Error('shotInstanceIndex must be in 0..999.');
  }
  const context = currentContext(session);
  const shotKey = withDrawKind(context, 'SHOT', input.shotInstanceIndex);
  const made = drawOccurs(shotKey, input.makeProbabilityMilli);
  const shotEventId = predictModelBEventId(session, input.transitionEventOffset, 'SHOT');
  const eventPayloads: MatchEvent['payload'][] = [
    { type: 'SHOT', shooterId: input.shooterId, zone: input.zone, made },
  ];
  const drawKeys: MatchDrawKey[] = [shotKey];
  let assistOccurred = false;
  let blockOccurred = false;
  if (made) {
    eventPayloads.push({
      type: 'SCORE',
      side: session.anchors.at(-1)!.possession.side,
      playerId: input.shooterId,
      points: input.zone === 'THREE_POINT' ? 3 : 2,
    });
    if (input.assistCandidate !== undefined) {
      if (input.assistCandidate.playerId === input.shooterId) {
        throw new Error('A shooter cannot assist their own made field goal.');
      }
      const assistKey = withDrawKind(context, 'ASSIST_ATTRIBUTION', 0);
      drawKeys.push(assistKey);
      assistOccurred = drawOccurs(assistKey, input.assistCandidate.attributionProbabilityMilli);
      if (assistOccurred) {
        eventPayloads.push({
          type: 'ASSIST',
          playerId: input.assistCandidate.playerId,
          sourceEventId: shotEventId,
        });
      }
    }
  } else if (input.blockCandidate !== undefined && input.zone !== 'THREE_POINT') {
    const blockKey = withDrawKind(context, 'BLOCK_ATTRIBUTION', 0);
    drawKeys.push(blockKey);
    blockOccurred = drawOccurs(blockKey, input.blockCandidate.attributionProbabilityMilli);
    if (blockOccurred) {
      eventPayloads.push({
        type: 'BLOCK',
        playerId: input.blockCandidate.playerId,
        sourceEventId: shotEventId,
      });
    }
  }
  return Object.freeze({
    eventPayloads: Object.freeze(eventPayloads),
    facts: Object.freeze([]),
    drawKeys: Object.freeze(drawKeys),
    made,
    assistOccurred,
    blockOccurred,
    shotEventId,
  });
}

export type ModelBFreeThrowResolution = ModelBResolutionDraft &
  Readonly<{ made: number; attempted: number; lastAttemptMade: boolean }>;

export function buildModelBFreeThrowResolution(
  session: ModelBSession,
  input: Readonly<{
    transitionEventOffset: number;
    shooterId: string;
    attempts: 1 | 2 | 3;
    shootingMilli: number;
    fatiguePenaltyMilli: number;
    freeThrowInstanceStart?: number;
  }>,
): ModelBFreeThrowResolution {
  assertTransitionOffset(input.transitionEventOffset);
  const start = input.freeThrowInstanceStart ?? 0;
  if (!Number.isSafeInteger(start) || start < 0 || start + input.attempts > 1_000) {
    throw new Error('Free-throw instance range must fit 0..999.');
  }
  const probabilityMilli = calculateFreeThrowProbabilityMilli(
    input.shootingMilli,
    input.fatiguePenaltyMilli,
  );
  const context = currentContext(session);
  const eventPayloads: MatchEvent['payload'][] = [];
  const drawKeys: MatchDrawKey[] = [];
  let madeCount = 0;
  let lastAttemptMade = false;
  for (let attempt = 0; attempt < input.attempts; attempt += 1) {
    const key = withDrawKind(context, 'SHOT', 5_000 + start + attempt);
    drawKeys.push(key);
    const made = drawOccurs(key, probabilityMilli);
    lastAttemptMade = made;
    eventPayloads.push({ type: 'FREE_THROW', shooterId: input.shooterId, made });
    if (made) {
      madeCount += 1;
      eventPayloads.push({
        type: 'SCORE',
        side: session.anchors.at(-1)!.possession.side,
        playerId: input.shooterId,
        points: 1,
      });
    }
  }
  return Object.freeze({
    eventPayloads: Object.freeze(eventPayloads),
    facts: Object.freeze([]),
    drawKeys: Object.freeze(drawKeys),
    made: madeCount,
    attempted: input.attempts,
    lastAttemptMade,
  });
}

function weightedCandidateFromDraw(
  candidates: readonly ModelBReboundCandidate[],
  weights: readonly number[],
  draw: bigint,
  domain: bigint,
): MatchPlayerSnapshot {
  if (candidates.length === 0 || candidates.length !== weights.length || domain <= 0n) {
    throw new Error('A rebound attribution requires aligned candidates and a positive domain.');
  }
  const total = weights.reduce((sum, weight) => {
    if (!Number.isSafeInteger(weight) || weight < 0) {
      throw new Error('Rebound candidate weights must be non-negative safe integers.');
    }
    return sum + BigInt(weight);
  }, 0n);
  if (total <= 0n) throw new Error('A rebound attribution requires positive candidate weight.');
  const target = (draw * total) / domain;
  let cumulative = 0n;
  for (let index = 0; index < candidates.length; index += 1) {
    cumulative += BigInt(weights[index]!);
    if (target < cumulative) return candidates[index]!.player;
  }
  throw new Error('Rebound attribution failed to resolve its exact keyed draw.');
}

export type ModelBReboundResolution = ModelBResolutionDraft &
  Readonly<{
    kind: 'OFFENSIVE' | 'DEFENSIVE';
    rebounderId: string;
    boxerId: string | null;
  }>;

export function buildModelBReboundResolution(
  session: ModelBSession,
  input: Readonly<{
    transitionEventOffset: number;
    reboundInstanceIndex: number;
    offensiveReboundProbabilityMilli: number;
    offensiveCandidates: readonly ModelBReboundCandidate[];
    defensiveCandidates: readonly ModelBReboundCandidate[];
    boxoutExcludedPlayerIds?: readonly string[];
  }>,
): ModelBReboundResolution {
  assertTransitionOffset(input.transitionEventOffset);
  assertProbabilityMilli(input.offensiveReboundProbabilityMilli, 'Offensive rebound probability');
  if (
    !Number.isSafeInteger(input.reboundInstanceIndex) ||
    input.reboundInstanceIndex < 0 ||
    input.reboundInstanceIndex > 999
  ) {
    throw new Error('reboundInstanceIndex must be in 0..999.');
  }
  const stable = (candidates: readonly ModelBReboundCandidate[]) =>
    [...candidates].sort((left, right) =>
      compareUtf16CodeUnits(left.player.playerId, right.player.playerId),
    );
  const offense = stable(input.offensiveCandidates);
  const defense = stable(input.defensiveCandidates);
  if (defense.length === 0) throw new Error('A rebound requires an eligible defensive candidate.');
  const boxer = deriveModelBBoxoutActor({
    candidates: defense.map(({ player }) => player),
    excludedPlayerIds: input.boxoutExcludedPlayerIds ?? [],
    personalReboundExecutionMilliByPlayerId: Object.fromEntries(
      defense.map(({ player, personalReboundExecutionMilli }) => [
        player.playerId,
        personalReboundExecutionMilli,
      ]),
    ),
  });
  const offenseWeights = offense.map(({ player, personalReboundExecutionMilli }) => {
    const weight =
      Math.max(1, personalReboundExecutionMilli) * player.tendencies.offensiveRebounding;
    if (!Number.isSafeInteger(weight)) throw new Error('Offensive rebound weight overflow.');
    return weight;
  });
  const defenseWeights = defense.map(({ player, personalReboundExecutionMilli }) =>
    Math.max(
      1,
      personalReboundExecutionMilli +
        (player.playerId === boxer?.playerId
          ? MODEL_B_PARAMETER_REGISTRY.offensiveRebound.boxoutExecutionBonusMilli
          : 0),
    ),
  );
  const offenseHasParticipant = offenseWeights.some((weight) => weight > 0);
  const context = currentContext(session);
  const reboundKey = withDrawKind(context, 'REBOUND', input.reboundInstanceIndex);
  const rawDraw = keyedDrawUint64(reboundKey);
  const offenseDomain = offenseHasParticipant
    ? (DRAW_DOMAIN * BigInt(input.offensiveReboundProbabilityMilli)) / 1_000n
    : 0n;
  let kind: 'OFFENSIVE' | 'DEFENSIVE';
  let rebounder: MatchPlayerSnapshot;
  if (rawDraw < offenseDomain) {
    kind = 'OFFENSIVE';
    rebounder = weightedCandidateFromDraw(offense, offenseWeights, rawDraw, offenseDomain);
  } else {
    kind = 'DEFENSIVE';
    rebounder = weightedCandidateFromDraw(
      defense,
      defenseWeights,
      rawDraw - offenseDomain,
      DRAW_DOMAIN - offenseDomain,
    );
  }
  return Object.freeze({
    eventPayloads: Object.freeze([
      { type: 'REBOUND', playerId: rebounder.playerId, kind } as const,
    ]),
    facts: Object.freeze([]),
    drawKeys: Object.freeze([reboundKey]),
    kind,
    rebounderId: rebounder.playerId,
    boxerId: boxer?.playerId ?? null,
  });
}

export type ModelBFoulResolution = ModelBResolutionDraft &
  Readonly<{
    occurred: boolean;
    foulKind: 'PERSONAL' | 'SHOOTING' | 'OFFENSIVE' | null;
    freeThrowAttempts: 0 | 1 | 2 | 3;
  }>;

function classifyFoulKey(context: ModelBDrawContext): MatchDrawKey {
  const key = withDrawKind(context, 'FOUL_TYPE', 0);
  keyedDrawInt(key, 0, 0);
  return key;
}

export function buildModelBOffensiveFoulResolution(
  session: ModelBSession,
  input: Readonly<{
    transitionEventOffset: number;
    playerId: string;
    behaviorSelectionOrdinal: number;
    occurrenceProbabilityMilli: number;
  }>,
): ModelBFoulResolution {
  assertTransitionOffset(input.transitionEventOffset);
  const context = currentContext(session);
  const occurrenceKey = withDrawKind(
    context,
    'OFFENSIVE_FOUL',
    modelBOffensiveFoulLocalIndex(input.behaviorSelectionOrdinal),
  );
  if (!drawOccurs(occurrenceKey, input.occurrenceProbabilityMilli)) {
    return Object.freeze({
      ...emptyResolution(),
      drawKeys: Object.freeze([occurrenceKey]),
      occurred: false,
      foulKind: null,
      freeThrowAttempts: 0,
    });
  }
  const classificationKey = classifyFoulKey(context);
  const eventPayloads: MatchEvent['payload'][] = [
    { type: 'FOUL', playerId: input.playerId, foulKind: 'OFFENSIVE' },
    { type: 'TURNOVER', playerId: input.playerId, turnoverKind: 'OFFENSIVE_FOUL' },
  ];
  return Object.freeze({
    eventPayloads: Object.freeze(eventPayloads),
    facts: Object.freeze([]),
    drawKeys: Object.freeze([occurrenceKey, classificationKey]),
    occurred: true,
    foulKind: 'OFFENSIVE',
    freeThrowAttempts: 0,
  });
}

export function buildModelBDefensiveFoulResolution(
  session: ModelBSession,
  input: Readonly<{
    transitionEventOffset: number;
    defenderId: string;
    behaviorSelectionOrdinal: number;
    occurrenceProbabilityMilli: number;
    shootingContext: null | Readonly<{
      zone: 'INSIDE' | 'MID_RANGE' | 'THREE_POINT';
      made: boolean;
    }>;
  }>,
): ModelBFoulResolution {
  assertTransitionOffset(input.transitionEventOffset);
  const context = currentContext(session);
  const occurrenceKey = withDrawKind(
    context,
    'DEFENSIVE_FOUL',
    modelBDefensiveFoulLocalIndex(input.behaviorSelectionOrdinal),
  );
  if (!drawOccurs(occurrenceKey, input.occurrenceProbabilityMilli)) {
    return Object.freeze({
      ...emptyResolution(),
      drawKeys: Object.freeze([occurrenceKey]),
      occurred: false,
      foulKind: null,
      freeThrowAttempts: 0,
    });
  }
  const classificationKey = classifyFoulKey(context);
  const foulKind = input.shootingContext === null ? ('PERSONAL' as const) : ('SHOOTING' as const);
  const freeThrowAttempts =
    input.shootingContext === null
      ? 0
      : input.shootingContext.made
        ? 1
        : input.shootingContext.zone === 'THREE_POINT'
          ? 3
          : 2;
  const eventPayloads: MatchEvent['payload'][] = [
    { type: 'FOUL', playerId: input.defenderId, foulKind },
  ];
  return Object.freeze({
    eventPayloads: Object.freeze(eventPayloads),
    facts: Object.freeze([]),
    drawKeys: Object.freeze([occurrenceKey, classificationKey]),
    occurred: true,
    foulKind,
    freeThrowAttempts,
  });
}
