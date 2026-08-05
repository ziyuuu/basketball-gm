import {
  canonicalizeV2,
  clampFixedPoint,
  compareUtf16CodeUnits,
  idHash,
  roundHalfUp,
} from '../../core/index.js';
import { keyedDrawInt, keyedDrawUint64 } from '../keyed-rng.js';
import {
  MatchProtocolBundleSchema,
  MatchResultDraftSchema,
  deriveEventDigest,
  deriveMatchResultId,
  type MatchEvent,
} from '../schemas.js';
import {
  deriveModelBBlockHelpCandidate,
  modelBCreationExecutionLocalIndex,
  modelBDefenseExecutionLocalIndex,
  modelBOffBallExecutionLocalIndex,
  resolveModelBDirectOpponent,
  selectModelBActor,
  selectModelBBehavior,
  selectModelBCreationExit,
  selectModelBDoubleTeamActors,
  selectModelBHandler,
  selectModelBHelpDefender,
  selectModelBReceiverOrBeneficiary,
  type ModelBDrawContext,
} from './behavior-selection.js';
import {
  buildModelBCreationFactDraft,
  buildModelBDefensiveActionFactDraft,
  buildModelBDefensiveFoulResolution,
  buildModelBFreeThrowResolution,
  buildModelBOffensiveFoulResolution,
  buildModelBPassFactDraft,
  buildModelBPossessionHandlerFactDraft,
  buildModelBReboundResolution,
  buildModelBShotResolution,
  buildModelBTurnoverResolution,
} from './basketball-results.js';
import {
  completeModelBPeriod,
  commitModelBActiveSegment,
  commitModelBRuleTransition,
  rebuildModelBShotClockSeconds,
  type ModelBSegmentResolution,
} from './clock-rules.js';
import {
  calculateChemistryExecutionModifierMilli,
  calculateEffectiveExecutionStages,
  calculateFatiguePenaltyMilli,
  calculateOpportunityQualityMilli,
  calculateTacticalExecutionModifierMilli,
  calculateTeamCoordinationIndexMilli,
  modelBAbilityValues,
  type MatchPlayerSnapshot,
  type TacticalExecutionContext,
  type TraitContext,
} from './effective-values.js';
import {
  calculateAttributionProbabilityMilli,
  calculateBehaviorExecutionProbabilityMilli,
  calculateCreationProbabilityMilli,
  calculateDefensiveFoulProbabilityMilli,
  calculateOffensiveFoulProbabilityMilli,
  calculateOffensiveReboundProbabilityMilli,
  calculatePressuredTurnoverClassificationProbabilityMilli,
  calculateShotProbabilityMilli,
  calculateTurnoverProbabilityMilli,
} from './probabilities.js';
import {
  MODEL_B_BEHAVIOR_REGISTRY,
  MODEL_B_PARAMETER_REGISTRY,
  type ModelBBehaviorId,
  type ModelBExecutionBlend,
} from './registries.js';
import {
  buildModelBTranscript,
  commitModelBAutomatedDecision,
  predictModelBEventId,
  assertModelBSessionInvariants,
  type ModelBFactDraft,
  type ModelBMatchInput,
  type ModelBSession,
} from './session.js';
import {
  buildModelBFoulOutBoundaryPlan,
  buildModelBNeutralRotationPlan,
  buildModelBOpponentPolicyPlan,
  eligibleModelBLineupPlayerIds,
} from './state-rules.js';

/** The frozen P02-002 protocol envelope; Model B adds no parallel bundle shape. */
export type ModelBProtocolBundle = ReturnType<typeof MatchProtocolBundleSchema.parse>;
type MatchSide = ModelBSession['anchors'][number]['possession']['side'];
type ShotZone = 'INSIDE' | 'MID_RANGE' | 'THREE_POINT';
type Phase = 'HALF_COURT_NORMAL' | 'TRANSITION' | 'LATE_CLOCK';
type HandlerReason =
  | 'SEGMENT_CARRY'
  | 'NEW_POSSESSION_ORIGIN'
  | 'PASS_RECEIVER'
  | 'OFFENSIVE_REBOUND_CARRY'
  | 'SAME_SIDE_DEAD_BALL_CARRY';
type RunnerShotBehavior = Extract<
  ModelBBehaviorId,
  | 'SPOTUP'
  | 'CATCHSHOT'
  | 'THREE'
  | 'MID'
  | 'PULLUP'
  | 'CLOSE'
  | 'FLOATER'
  | 'HOOK'
  | 'LAYUP'
  | 'CONTACTFIN'
  | 'CONTESTEDFIN'
>;
type RunnerCreationBehavior = Extract<
  ModelBBehaviorId,
  'DRIVE' | 'SHAKE' | 'ISO' | 'STEP_BACK' | 'POSTUP' | 'HIGH_POST_CREATION'
>;
type RunnerOffBallBehavior = Extract<ModelBBehaviorId, 'SCREEN' | 'CUT' | 'DOUBLECREATE'>;
type RunnerPassBehavior = Extract<
  ModelBBehaviorId,
  'PASS' | 'HPASS' | 'CREATIVE_PASS' | 'ASTOPP' | 'HELDKICK'
>;

/**
 * A deterministic decision source for runner-level golden vectors.  The
 * vector does not build events, facts, anchors, or a parallel phase machine:
 * it supplies only decisions that the live SegmentRuntime would otherwise
 * obtain from keyed selectors.  `runModelBRunnerVector` still executes the
 * normal live loop and commits its resulting authoritative objects.
 */
export type ModelBRunnerVector = Readonly<{
  offense: readonly Readonly<{
    behaviorId: ModelBBehaviorId;
    actionDurationRawUint64: bigint;
    /** null proves this step is expected to execute after the LATE guard. */
    ordinaryGapRawUint64: bigint | null;
    /** Required only for a pass behavior; otherwise null. */
    receiverPlayerId: string | null;
    /** The vector may suppress only a pass/creation turnover for timing vectors. */
    turnoverMode: 'FORCE_NONE' | 'KEYED';
  }>[];
}>;

const UINT64_DOMAIN = 1n << 64n;
const PASS_BEHAVIORS = new Set<ModelBBehaviorId>([
  'PASS',
  'HPASS',
  'CREATIVE_PASS',
  'ASTOPP',
  'HELDKICK',
]);
const SHOT_BEHAVIORS = new Set<ModelBBehaviorId>([
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
]);
const CREATION_BEHAVIORS = new Set<ModelBBehaviorId>([
  'DRIVE',
  'SHAKE',
  'ISO',
  'STEP_BACK',
  'POSTUP',
  'HIGH_POST_CREATION',
]);
const OFF_BALL_BEHAVIORS = new Set<ModelBBehaviorId>(['SCREEN', 'CUT', 'DOUBLECREATE']);
const OFFENSIVE_FOUL_CREATION_BEHAVIORS = new Set<ModelBBehaviorId>(['ISO', 'POSTUP']);
const SHOT_ZONE_BY_BEHAVIOR: Readonly<Record<RunnerShotBehavior, ShotZone>> = {
  SPOTUP: 'MID_RANGE',
  CATCHSHOT: 'THREE_POINT',
  THREE: 'THREE_POINT',
  MID: 'MID_RANGE',
  PULLUP: 'MID_RANGE',
  CLOSE: 'INSIDE',
  FLOATER: 'INSIDE',
  HOOK: 'INSIDE',
  LAYUP: 'INSIDE',
  CONTACTFIN: 'INSIDE',
  CONTESTEDFIN: 'INSIDE',
};
const CREATION_BLEND: Readonly<Record<RunnerCreationBehavior, ModelBExecutionBlend>> = {
  DRIVE: 'DRIVE_CREATION',
  SHAKE: 'SHAKE_CREATION',
  ISO: 'ISO_CREATION',
  STEP_BACK: 'STEP_BACK_CREATION',
  POSTUP: 'POSTUP_CREATION',
  HIGH_POST_CREATION: 'HIGH_POST_CREATION',
};
const CREATION_SAFE_EXIT: Readonly<Record<RunnerCreationBehavior, ModelBBehaviorId>> = {
  DRIVE: 'LAYUP',
  SHAKE: 'SPOTUP',
  ISO: 'PULLUP',
  STEP_BACK: 'MID',
  POSTUP: 'HOOK',
  HIGH_POST_CREATION: 'HPASS',
};

export const MODEL_B_RUNNER_SELECTABLE_BEHAVIOR_IDS = Object.freeze(
  MODEL_B_BEHAVIOR_REGISTRY.filter(({ selectable }) => selectable).map(
    ({ behaviorId }) => behaviorId as ModelBBehaviorId,
  ),
);
const OFFENSIVE_BEHAVIORS = Object.freeze(
  MODEL_B_RUNNER_SELECTABLE_BEHAVIOR_IDS.filter(
    (behaviorId) => behavior(behaviorId).family !== 'DEFENSE',
  ),
);
const DEFENSIVE_BEHAVIORS = Object.freeze(
  MODEL_B_RUNNER_SELECTABLE_BEHAVIOR_IDS.filter(
    (behaviorId) => behavior(behaviorId).family === 'DEFENSE' && behaviorId !== 'TRANSITIOND',
  ),
);

function current(session: ModelBSession) {
  const anchor = session.anchors.at(-1);
  if (anchor === undefined) throw new Error('A Model B session requires a current Anchor.');
  return anchor;
}

function behavior(behaviorId: ModelBBehaviorId) {
  const entry = MODEL_B_BEHAVIOR_REGISTRY.find((candidate) => candidate.behaviorId === behaviorId);
  if (entry === undefined) throw new Error(`Unknown frozen Model B behavior ${behaviorId}.`);
  return entry;
}

function oppositeSide(side: MatchSide): MatchSide {
  return side === 'HOME' ? 'AWAY' : 'HOME';
}

function sideKey(side: MatchSide): 'home' | 'away' {
  return side === 'HOME' ? 'home' : 'away';
}

function drawContext(session: ModelBSession): ModelBDrawContext {
  const anchor = current(session);
  return {
    matchSeed: session.input.matchSeed,
    period: anchor.period,
    possessionIndex: anchor.possession.possessionIndex,
    segmentIndex: anchor.possession.segmentIndex,
  };
}

function mapInclusive(raw: bigint, minimum: number, maximum: number): number {
  if (!Number.isSafeInteger(minimum) || !Number.isSafeInteger(maximum) || minimum > maximum) {
    throw new Error('Model B mapInclusive requires ordered safe integer bounds.');
  }
  return minimum + Number((raw * BigInt(maximum - minimum + 1)) / UINT64_DOMAIN);
}

/**
 * R2 permits the internal encoding but requires one deterministic, domain-isolated
 * sub-value.  This canonical hash construction is frozen by the runner tests.
 */
export function deriveModelBSubUint64(
  root: bigint,
  role:
    | 'ACTION_DURATION'
    | 'ORDINARY_GAP'
    | 'FORMATION'
    | 'TRANSITION_WINDOW'
    | 'OFF_SUPPORT'
    | 'DEF_RETREAT'
    | 'FALLBACK',
  subject: string,
): bigint {
  const digest = idHash('p02-003-r2-subvalue-v1', root.toString(10), role, subject);
  return BigInt(`0x${digest.slice('sha256:'.length, 'sha256:'.length + 16)}`);
}

function probabilityOccurs(raw: bigint, probabilityMilli: number): boolean {
  if (!Number.isSafeInteger(probabilityMilli) || probabilityMilli < 0 || probabilityMilli > 1_000) {
    throw new Error('Model B probability must be a 0..1000 integer.');
  }
  return raw * 1_000n < BigInt(probabilityMilli) * UINT64_DOMAIN;
}

function teamPlayers(session: ModelBSession, side: MatchSide): readonly MatchPlayerSnapshot[] {
  return side === 'HOME' ? session.input.homeTeam.players : session.input.awayTeam.players;
}

function eligiblePlayers(session: ModelBSession, side: MatchSide): readonly MatchPlayerSnapshot[] {
  const allowed = new Set(
    eligibleModelBLineupPlayerIds(current(session), side, session.input.rules.foulOutLimit),
  );
  return teamPlayers(session, side).filter(({ playerId }) => allowed.has(playerId));
}

function player(session: ModelBSession, side: MatchSide, playerId: string): MatchPlayerSnapshot {
  const found = teamPlayers(session, side).find((candidate) => candidate.playerId === playerId);
  if (found === undefined)
    throw new Error(`Model B runner cannot resolve ${playerId} for ${side}.`);
  return found;
}

function pendingPossessionStartCount(session: ModelBSession): 0 | 1 {
  const anchor = current(session);
  return session.events.some(
    (event) =>
      event.period === anchor.period &&
      event.possessionIndex === anchor.possession.possessionIndex &&
      event.payload.type === 'POSSESSION_STARTED',
  )
    ? 0
    : 1;
}

function selectedShooter(
  session: ModelBSession,
  candidates: readonly MatchPlayerSnapshot[],
  shotInstanceIndex: number,
): MatchPlayerSnapshot {
  const ordered = [...candidates].sort((left, right) =>
    compareUtf16CodeUnits(left.playerId, right.playerId),
  );
  if (ordered.length === 0) throw new Error('A field-goal behavior requires an eligible shooter.');
  return ordered[
    keyedDrawInt(
      { ...drawContext(session), drawKind: 'SHOOTER', localIndex: shotInstanceIndex },
      0,
      ordered.length - 1,
    )
  ]!;
}

function handlerFromCurrentPossession(
  session: ModelBSession,
  offense: readonly MatchPlayerSnapshot[],
): MatchPlayerSnapshot {
  const anchor = current(session);
  const previousControlEvent = [...session.events]
    .reverse()
    .find(({ payload }) => payload.type !== 'POSSESSION_ENDED');
  if (previousControlEvent?.payload.type === 'REBOUND') {
    return player(session, anchor.possession.side, previousControlEvent.payload.playerId);
  }
  if (previousControlEvent?.payload.type === 'STEAL') {
    return player(session, anchor.possession.side, previousControlEvent.payload.playerId);
  }
  for (const fact of [...session.facts].reverse()) {
    const payload = fact.payload as Record<string, unknown>;
    if (
      payload.type === 'POSSESSION_HANDLER' &&
      payload.period === anchor.period &&
      payload.possessionIndex === anchor.possession.possessionIndex &&
      typeof payload.handlerPlayerId === 'string'
    ) {
      return player(session, anchor.possession.side, payload.handlerPlayerId);
    }
  }
  return selectModelBHandler({
    context: drawContext(session),
    handlerInstanceIndex: 0,
    candidates: offense,
  }).value;
}

function initialHandlerProvenance(session: ModelBSession): Readonly<{
  reason: HandlerReason;
  originEventId: string | null;
}> {
  const anchor = current(session);
  const origin = [...session.events]
    .reverse()
    .find(({ payload }) => payload.type !== 'POSSESSION_ENDED');
  if (anchor.possession.segmentIndex > 0) {
    if (origin?.payload.type === 'REBOUND' && origin.payload.kind === 'OFFENSIVE') {
      return { reason: 'OFFENSIVE_REBOUND_CARRY', originEventId: origin.eventId };
    }
    return { reason: 'SAME_SIDE_DEAD_BALL_CARRY', originEventId: origin?.eventId ?? null };
  }
  if (
    origin?.payload.type === 'REBOUND' ||
    (origin?.payload.type === 'TURNOVER' && origin.payload.turnoverKind === 'PRESSURED_LIVE_BALL')
  ) {
    return { reason: 'NEW_POSSESSION_ORIGIN', originEventId: origin.eventId };
  }
  return { reason: 'SEGMENT_CARRY', originEventId: null };
}

function currentSnapshot(
  session: ModelBSession,
  playerSnapshot: MatchPlayerSnapshot,
): MatchPlayerSnapshot {
  return {
    ...playerSnapshot,
    fatigueMilli:
      current(session).fatigueMilliByPlayer[playerSnapshot.playerId] ?? playerSnapshot.fatigueMilli,
  };
}

function assignedPosition(session: ModelBSession, side: MatchSide, playerId: string) {
  const lineup = current(session).lineups[sideKey(side)];
  const value = Object.entries(lineup).find(([, id]) => id === playerId)?.[0];
  return value === undefined ? null : (value as MatchPlayerSnapshot['primaryPosition']);
}

function effectiveExecution(
  session: ModelBSession,
  side: MatchSide,
  playerSnapshot: MatchPlayerSnapshot,
  blend: ModelBExecutionBlend,
  traitContext: TraitContext = 'NONE',
  tacticalContext: TacticalExecutionContext | null = null,
): number {
  const anchor = current(session);
  return calculateEffectiveExecutionStages({
    player: currentSnapshot(session, playerSnapshot),
    blend,
    fatigueSensitivity: 'FULL',
    assignedPosition: assignedPosition(session, side, playerSnapshot.playerId),
    applyPositionMismatch: true,
    traitContext,
    chemistryModifierMilli: calculateChemistryExecutionModifierMilli(
      anchor.chemistryWeightedMilli[sideKey(side)],
    ),
    applyChemistry: true,
    tacticalModifierMilli:
      tacticalContext === null
        ? 0
        : calculateTacticalExecutionModifierMilli(
            anchor.effectiveFragment.tactics[sideKey(side)],
            tacticalContext,
          ),
  }).finalExecutionMilli;
}

function transitionIndividualExecution(
  session: ModelBSession,
  playerSnapshot: MatchPlayerSnapshot,
  blend: Extract<
    ModelBExecutionBlend,
    'TRANSITION_CONTROLLER' | 'TRANSITION_SUPPORT' | 'TRANSITION_RETREAT'
  >,
): number {
  return calculateEffectiveExecutionStages({
    player: currentSnapshot(session, playerSnapshot),
    blend,
    fatigueSensitivity: 'FULL',
    assignedPosition: null,
    applyPositionMismatch: false,
    traitContext: 'NONE',
    chemistryModifierMilli: 0,
    applyChemistry: false,
    tacticalModifierMilli: 0,
  }).finalExecutionMilli;
}

function weightedTransitionExecution(
  session: ModelBSession,
  side: MatchSide,
  participants: readonly MatchPlayerSnapshot[],
  weights: readonly number[],
  blends: readonly Extract<
    ModelBExecutionBlend,
    'TRANSITION_CONTROLLER' | 'TRANSITION_SUPPORT' | 'TRANSITION_RETREAT'
  >[],
): number {
  if (
    participants.length === 0 ||
    participants.length !== weights.length ||
    participants.length !== blends.length
  ) {
    throw new Error('Transition execution requires one positive weight and blend per participant.');
  }
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  if (totalWeight < 1) throw new Error('Transition execution weights must be positive.');
  const weighted = participants.reduce(
    (sum, participant, index) =>
      sum + transitionIndividualExecution(session, participant, blends[index]!) * weights[index]!,
    0,
  );
  return clampFixedPoint(
    roundHalfUp(weighted, totalWeight) +
      calculateChemistryExecutionModifierMilli(
        current(session).chemistryWeightedMilli[sideKey(side)],
      ),
    0,
    100_000,
  );
}

function transitionCandidateScore(
  session: ModelBSession,
  participant: MatchPlayerSnapshot,
  noise: bigint,
  role: 'SUPPORT' | 'DRB_RETREAT' | 'LIVE_BALL_RETREAT',
): number {
  const values = modelBAbilityValues(participant);
  const fatiguePenalty = calculateFatiguePenaltyMilli(
    current(session).fatigueMilliByPlayer[participant.playerId] ?? participant.fatigueMilli,
    'FULL',
  );
  const athleticismMilli = clampFixedPoint(values.athleticism * 1_000 - fatiguePenalty, 0, 100_000);
  const tacticalUnderstandingMilli = clampFixedPoint(
    values.tacticalUnderstanding * 1_000 - fatiguePenalty,
    0,
    100_000,
  );
  const tendencyMilli =
    role === 'SUPPORT'
      ? participant.tendencies.transitionParticipation * 1_000
      : role === 'DRB_RETREAT'
        ? 100_000 - participant.tendencies.offensiveRebounding * 1_000
        : tacticalUnderstandingMilli;
  const noiseMilli = Number((noise * 100_001n) / UINT64_DOMAIN);
  return roundHalfUp(athleticismMilli * 500 + tendencyMilli * 300 + noiseMilli * 200, 1_000);
}

function zoneBlends(zone: ShotZone): readonly [ModelBExecutionBlend, ModelBExecutionBlend] {
  if (zone === 'INSIDE') return ['INSIDE_OFFENSE', 'INSIDE_SHOT_PROTECTION'];
  if (zone === 'MID_RANGE') return ['MID_RANGE_OFFENSE', 'MID_RANGE_DEFENSE'];
  return ['THREE_POINT_OFFENSE', 'THREE_POINT_DEFENSE'];
}

function offenseTacticalContext(zone: ShotZone): TacticalExecutionContext {
  return zone === 'INSIDE' ? 'OPPONENT_INSIDE_EXECUTION' : 'OPPONENT_PERIMETER_EXECUTION';
}

function offenseOpportunityContext(zone: ShotZone): TacticalExecutionContext {
  return zone === 'INSIDE' ? 'OPPONENT_INSIDE_OPPORTUNITY' : 'OPPONENT_PERIMETER_OPPORTUNITY';
}

function hasBoundaryActor(
  session: ModelBSession,
  actor: 'ASSISTANT' | 'OPPONENT' | 'RULES',
): boolean {
  const boundary = current(session).controlBoundary;
  if (boundary === null) return false;
  return session.transcriptEntries.some(
    (entry) =>
      entry.actor === actor &&
      entry.controlBoundary.kind === boundary.kind &&
      entry.controlBoundary.period === boundary.period &&
      entry.controlBoundary.possessionIndex === boundary.possessionIndex &&
      entry.controlBoundary.segmentIndex === boundary.segmentIndex,
  );
}

/** Regenerates B6 rule/policy decisions; replay never treats an empty transcript as authority. */
function resolveAutomatedBoundary(session: ModelBSession): ModelBSession | null {
  const anchor = current(session);
  const boundary = anchor.controlBoundary;
  if (boundary === null || anchor.status !== 'IN_PROGRESS') return null;
  const initialRuleBoundary =
    boundary.kind === 'DEAD_BALL' &&
    !session.transcriptEntries.some(({ actor }) => actor === 'RULES');
  const initialAssistantBoundary =
    boundary.kind === 'DEAD_BALL' &&
    !session.transcriptEntries.some(({ actor }) => actor === 'ASSISTANT');
  const mayNeedRulePlan =
    initialRuleBoundary ||
    anchor.boxScore.home.players.some(
      ({ personalFouls }) => personalFouls >= session.input.rules.foulOutLimit,
    ) ||
    anchor.boxScore.away.players.some(
      ({ personalFouls }) => personalFouls >= session.input.rules.foulOutLimit,
    );
  const rulePlan = mayNeedRulePlan ? buildModelBFoulOutBoundaryPlan(session) : null;
  if (rulePlan !== null && rulePlan.eventPayloads.length > 0) {
    return commitModelBRuleTransition(session, {
      eventPayloads: rulePlan.eventPayloads,
      status: rulePlan.status,
      controlBoundaryKind: rulePlan.status === 'IN_PROGRESS' ? 'DEAD_BALL' : 'MATCH_COMPLETE',
    });
  }
  if (initialRuleBoundary && rulePlan !== null && !hasBoundaryActor(session, 'RULES')) {
    return commitModelBAutomatedDecision(session, {
      actor: 'RULES',
      ruleId: rulePlan.ruleId,
      ruleInputHash: rulePlan.ruleInputHash,
      effectiveFragment: anchor.effectiveFragment,
    });
  }
  if (
    session.input.controlStrategy === 'INSTANT' &&
    (boundary.kind === 'DEAD_BALL' || boundary.kind === 'PERIOD_BREAK')
  ) {
    const mayNeedRotation =
      initialAssistantBoundary ||
      Object.values(anchor.fatigueMilliByPlayer).some(
        (fatigueMilli) =>
          fatigueMilli >= MODEL_B_PARAMETER_REGISTRY.neutralRotationFatigueThresholdMilli,
      );
    if (mayNeedRotation) {
      const plan = buildModelBNeutralRotationPlan(session);
      if (plan.eventPayloads.length > 0)
        return commitModelBRuleTransition(session, { eventPayloads: plan.eventPayloads });
      if (initialAssistantBoundary && !hasBoundaryActor(session, 'ASSISTANT')) {
        return commitModelBAutomatedDecision(session, {
          actor: 'ASSISTANT',
          policyId: plan.policyId,
          policyInputHash: plan.policyInputHash,
          effectiveFragment: anchor.effectiveFragment,
        });
      }
    }
  }
  if (!hasBoundaryActor(session, 'OPPONENT') && boundary.kind === 'PERIOD_BREAK') {
    const plan = buildModelBOpponentPolicyPlan(session);
    const alreadyApplied = anchor.effectiveFragment.effects.some(
      (effect) =>
        effect.source.kind === 'OPPONENT_POLICY' && effect.source.sourceId === plan.policyId,
    );
    if (plan.eventPayloads.length > 0 && !alreadyApplied) {
      return commitModelBRuleTransition(session, {
        eventPayloads: plan.eventPayloads,
        effectiveFragment: plan.effectiveFragment,
      });
    }
    return commitModelBAutomatedDecision(session, {
      actor: 'OPPONENT',
      policyId: plan.policyId,
      policyInputHash: plan.policyInputHash,
      effectiveFragment: anchor.effectiveFragment,
    });
  }
  return null;
}

type TransitionOrigin = Readonly<{
  kind: 'DRB' | 'PRESSURED_LIVE_BALL';
  sourceEventId: string;
  sourceModifierMilli: number;
}>;

function transitionOrigin(session: ModelBSession): TransitionOrigin | null {
  const anchor = current(session);
  if (pendingPossessionStartCount(session) === 0 || anchor.possession.segmentIndex !== 0)
    return null;
  // A credited STEAL is attribution for the turnover, not a new control origin.
  // Walk the current atomic tail so TURNOVER remains authoritative when the
  // canonical TURNOVER -> STEAL -> POSSESSION_ENDED ordering is present.
  const event = [...session.events]
    .reverse()
    .find(({ payload }) => payload.type === 'REBOUND' || payload.type === 'TURNOVER');
  if (event?.payload.type === 'REBOUND' && event.payload.kind === 'DEFENSIVE') {
    return { kind: 'DRB', sourceEventId: event.eventId, sourceModifierMilli: 0 };
  }
  if (event?.payload.type === 'TURNOVER' && event.payload.turnoverKind === 'PRESSURED_LIVE_BALL') {
    return { kind: 'PRESSURED_LIVE_BALL', sourceEventId: event.eventId, sourceModifierMilli: 100 };
  }
  return null;
}

/** The accepted formation formula, including its independent pace adjustment. */
export function calculateModelBTransitionFormationProbabilityMilli(
  input: Readonly<{
    offenseExecutionMilli: number;
    defenseExecutionMilli: number;
    sourceModifierMilli: number;
    pace: 'SLOW' | 'BALANCED' | 'FAST';
  }>,
): number {
  const raw =
    240 +
    roundHalfUp((input.offenseExecutionMilli - input.defenseExecutionMilli) * 35, 10_000) +
    input.sourceModifierMilli;
  return clampFixedPoint(
    roundHalfUp(raw * MODEL_B_PARAMETER_REGISTRY.transitionWeightFactors[input.pace], 1_000),
    60,
    650,
  );
}

/** Frozen D.14 fallback probability; comparison still uses the isolated subvalue. */
export function calculateModelBTransitionFallbackProbabilityMilli(
  input: Readonly<{
    offenseExecutionMilli: number;
    defenseExecutionMilli: number;
    elapsedTransitionDecisionSeconds: number;
    transitionWindowSeconds: number;
    completedTransitionOffenseActions: number;
  }>,
): number {
  if (
    !Number.isSafeInteger(input.elapsedTransitionDecisionSeconds) ||
    !Number.isSafeInteger(input.transitionWindowSeconds) ||
    input.transitionWindowSeconds < 1 ||
    !Number.isSafeInteger(input.completedTransitionOffenseActions) ||
    input.completedTransitionOffenseActions < 1
  ) {
    throw new Error(
      'Model B transition fallback requires a positive integer duration and action count.',
    );
  }
  return clampFixedPoint(
    200 +
      roundHalfUp((input.defenseExecutionMilli - input.offenseExecutionMilli) * 40, 10_000) +
      roundHalfUp(300 * input.elapsedTransitionDecisionSeconds, input.transitionWindowSeconds) +
      50 * Math.max(0, input.completedTransitionOffenseActions - 1),
    50,
    900,
  );
}

class SegmentRuntime {
  readonly session: ModelBSession;
  readonly offenseSide: MatchSide;
  readonly defenseSide: MatchSide;
  readonly offense: readonly MatchPlayerSnapshot[];
  readonly defense: readonly MatchPlayerSnapshot[];
  readonly prefix: number;
  readonly segmentRoot: bigint;
  readonly normalTargetSeconds: number;
  readonly terminalReserveSeconds = 1;
  readonly runnerVector: ModelBRunnerVector | null;
  readonly payloads: MatchEvent['payload'][] = [];
  readonly facts: ModelBFactDraft[] = [];
  readonly opportunityDeltas: number[] = [];
  periodRemaining: number;
  shotRemaining: number;
  decisionElapsedSeconds = 0;
  phase: Phase = 'HALF_COURT_NORMAL';
  behaviorSelectionOrdinal = 0;
  shotInstanceIndex = 0;
  reboundInstanceIndex = 0;
  handler: MatchPlayerSnapshot;
  handlerFactCreated = false;
  handlerSequence = 0;
  initialHandlerReason: HandlerReason;
  initialHandlerOriginEventId: string | null;
  passSequence = 0;
  turnoverRiskMilli = 0;
  contestDefenseModifierMilli = 0;
  creationExecutionMilli: number;
  pendingShooterId: string | null = null;
  pendingAssist: Readonly<{ passerId: string; receiverId: string }> | null = null;
  stealCandidate: Readonly<{ playerId: string; attributionProbabilityMilli: number }> | null = null;
  forceNextBehavior: ModelBBehaviorId | null = null;
  forceOffense = false;
  transitionWindowSeconds: number | null = null;
  transitionRoot: bigint | null = null;
  transitionOffenseExecutionMilli: number | null = null;
  transitionDefenseExecutionMilli: number | null = null;
  transitionSupporterIds: readonly string[] = [];
  transitionRetreaterIds: readonly string[] = [];
  transitionContextFactIndex: number | null = null;
  completedTransitionOffenseActions = 0;
  lastActionTraceFactIndex: number | null = null;

  constructor(session: ModelBSession, runnerVector: ModelBRunnerVector | null = null) {
    this.session = session;
    this.runnerVector = runnerVector;
    const anchor = current(session);
    this.offenseSide = anchor.possession.side;
    this.defenseSide = oppositeSide(this.offenseSide);
    this.offense = eligiblePlayers(session, this.offenseSide);
    this.defense = eligiblePlayers(session, this.defenseSide);
    if (this.offense.length === 0 || this.defense.length === 0) {
      throw new Error('A live Model B possession requires eligible players on both sides.');
    }
    this.prefix = pendingPossessionStartCount(session);
    this.periodRemaining = anchor.periodClockSeconds;
    this.shotRemaining = rebuildModelBShotClockSeconds(anchor, session.events);
    this.segmentRoot = keyedDrawUint64({
      ...drawContext(session),
      drawKind: 'SEGMENT_DURATION',
      localIndex: 0,
    });
    const baseSeconds = mapInclusive(
      this.segmentRoot,
      MODEL_B_PARAMETER_REGISTRY.segmentDuration.baselineMinimumSeconds,
      MODEL_B_PARAMETER_REGISTRY.segmentDuration.baselineMaximumSeconds,
    );
    const paceFactor =
      MODEL_B_PARAMETER_REGISTRY.paceDurationFactors[
        anchor.effectiveFragment.tactics[sideKey(this.offenseSide)].pace
      ];
    const pacedSeconds = roundHalfUp(baseSeconds * paceFactor, 1_000);
    this.normalTargetSeconds = Math.min(pacedSeconds, this.periodRemaining, this.shotRemaining);
    this.handler = handlerFromCurrentPossession(session, this.offense);
    const provenance = initialHandlerProvenance(session);
    this.initialHandlerReason = provenance.reason;
    this.initialHandlerOriginEventId = provenance.originEventId;
    // PASS sequences are dense across the full possession, not merely within one
    // runner segment. A same-side continuation starts a fresh SegmentRuntime
    // while retaining the possession coordinate, so recover the next ordinal
    // from the accepted Fact history before emitting another successful pass.
    this.passSequence = session.facts.filter((fact) => {
      const payload = fact.payload;
      return (
        payload !== null &&
        typeof payload === 'object' &&
        !Array.isArray(payload) &&
        (payload as Record<string, unknown>).type === 'PASS' &&
        (payload as Record<string, unknown>).possessionIndex === anchor.possession.possessionIndex
      );
    }).length;
    this.creationExecutionMilli = effectiveExecution(
      session,
      this.offenseSide,
      this.handler,
      'CREATION',
    );
  }

  private coordinate() {
    const anchor = current(this.session);
    return {
      period: anchor.period,
      possessionIndex: anchor.possession.possessionIndex,
      segmentIndex: anchor.possession.segmentIndex,
    };
  }

  transitionOffenseParticipants(): readonly MatchPlayerSnapshot[] {
    if (this.phase !== 'TRANSITION') return this.offense;
    const participantIds = new Set([this.handler.playerId, ...this.transitionSupporterIds]);
    return this.offense.filter(({ playerId }) => participantIds.has(playerId));
  }

  transitionDefenseParticipants(): readonly MatchPlayerSnapshot[] {
    if (this.phase !== 'TRANSITION') return this.defense;
    const participantIds = new Set(this.transitionRetreaterIds);
    return this.defense.filter(({ playerId }) => participantIds.has(playerId));
  }

  appendDecisionClock(seconds: number): number {
    if (
      !Number.isSafeInteger(seconds) ||
      seconds < 1 ||
      seconds > this.periodRemaining ||
      seconds > this.shotRemaining
    ) {
      throw new Error('A Model B decision clock must remain inside both live clocks.');
    }
    const index = this.payloads.length;
    this.payloads.push({ type: 'CLOCK_ADVANCED', seconds });
    this.periodRemaining -= seconds;
    this.shotRemaining -= seconds;
    this.decisionElapsedSeconds += seconds;
    if (!this.handlerFactCreated) {
      const coordinate = this.coordinate();
      this.facts.push(
        buildModelBPossessionHandlerFactDraft({
          sourceEventIndexes: [index],
          handlerPlayerId: this.handler.playerId,
          reason: this.initialHandlerReason,
          handlerSequence: this.handlerSequence,
          originEventId: this.initialHandlerOriginEventId,
          ...coordinate,
        }),
      );
      this.handlerSequence += 1;
      this.handlerFactCreated = true;
    }
    return index;
  }

  appendPostReleaseClock(seconds: number): number | null {
    if (seconds < 1) return null;
    if (seconds > this.periodRemaining)
      throw new Error('A post-release clock cannot exceed period time.');
    const index = this.payloads.length;
    this.payloads.push({ type: 'CLOCK_ADVANCED', seconds });
    this.periodRemaining -= seconds;
    return index;
  }

  addActionTrace(
    input: Readonly<{
      behaviorId: ModelBBehaviorId;
      clockIndex: number;
      handlerBeforeId: string;
      actorIds: readonly string[];
      targetIds: readonly string[];
      durationSeconds: number;
      startOffsetSeconds: number;
      resultCode: string;
      resultIndexes: readonly number[];
      opportunityQualityMilli?: number;
    }>,
  ): void {
    const coordinate = this.coordinate();
    this.lastActionTraceFactIndex = this.facts.length;
    this.facts.push({
      factKind: 'OBSERVATION',
      sourceEventIndexes: [input.clockIndex],
      intraTypeOrdinal: this.behaviorSelectionOrdinal,
      payload: {
        type: 'ACTION_TRACE',
        behaviorId: input.behaviorId,
        family: behavior(input.behaviorId).family,
        classification: behavior(input.behaviorId).classification,
        timeClass: 'BEHAVIOR',
        behaviorSelectionOrdinal: this.behaviorSelectionOrdinal,
        ruleActionOrdinal: null,
        phase: this.phase,
        offenseSide: this.offenseSide,
        actorIds: [...input.actorIds].sort(compareUtf16CodeUnits),
        targetIds: [...input.targetIds].sort(compareUtf16CodeUnits),
        handlerBeforeId: input.handlerBeforeId,
        handlerAfterId: this.handler.playerId,
        startOffsetSeconds: input.startOffsetSeconds,
        endOffsetSeconds: input.startOffsetSeconds + input.durationSeconds,
        durationSeconds: input.durationSeconds,
        resultCode: input.resultCode,
        resultBehaviorIds: [],
        resultEventDraftIndexes: [...input.resultIndexes],
        ...(input.opportunityQualityMilli === undefined
          ? {}
          : { opportunityQualityMilli: input.opportunityQualityMilli }),
        ...coordinate,
      },
    });
  }

  markTransitionFallback(
    reason: 'WINDOW_EXPIRED' | 'REORG_COMPLETED' | 'RNG_DEFENSE_RECOVERY',
  ): void {
    if (this.lastActionTraceFactIndex === null) return;
    const trace = this.facts[this.lastActionTraceFactIndex];
    if (trace === undefined) return;
    this.facts[this.lastActionTraceFactIndex] = {
      ...trace,
      payload: {
        ...(trace.payload as Record<string, unknown>),
        transitionFallback: true,
        transitionFallbackReason: reason,
      },
    };
    if (this.transitionContextFactIndex === null) return;
    const context = this.facts[this.transitionContextFactIndex];
    if (context === undefined) return;
    const traceOrdinal = (trace.payload as Record<string, unknown>).behaviorSelectionOrdinal;
    this.facts[this.transitionContextFactIndex] = {
      ...context,
      payload: {
        ...(context.payload as Record<string, unknown>),
        fallback: {
          occurred: true,
          atDecisionSecond: this.decisionElapsedSeconds,
          reason:
            reason === 'REORG_COMPLETED'
              ? 'REORG'
              : reason === 'WINDOW_EXPIRED'
                ? 'WINDOW_EXPIRED'
                : 'RNG_DEFENSE_RECOVERY',
          sourceBehaviorOrdinal:
            typeof traceOrdinal === 'number' && Number.isSafeInteger(traceOrdinal)
              ? traceOrdinal
              : null,
        },
        finalPhase: 'HALF_COURT',
      },
    };
  }

  changeHandler(next: MatchPlayerSnapshot, sourceClockIndex: number): void {
    if (next.playerId === this.handler.playerId) return;
    this.handler = next;
    const coordinate = this.coordinate();
    this.facts.push(
      buildModelBPossessionHandlerFactDraft({
        sourceEventIndexes: [sourceClockIndex],
        handlerPlayerId: next.playerId,
        reason: 'PASS_RECEIVER',
        handlerSequence: this.handlerSequence,
        originEventId: null,
        ...coordinate,
      }),
    );
    this.handlerSequence += 1;
  }

  actionRaw(behaviorId: ModelBBehaviorId): bigint {
    const controlled = this.currentVectorStep(behaviorId);
    if (controlled !== null) return controlled.actionDurationRawUint64;
    return deriveModelBSubUint64(
      this.segmentRoot,
      'ACTION_DURATION',
      `${this.behaviorSelectionOrdinal}:${behaviorId}`,
    );
  }

  ordinaryGapRaw(behaviorId: ModelBBehaviorId): bigint {
    const controlled = this.currentVectorStep(behaviorId);
    if (controlled !== null) {
      if (controlled.ordinaryGapRawUint64 === null) {
        throw new Error('A runner vector must not read an ordinary-gap raw after the LATE guard.');
      }
      return controlled.ordinaryGapRawUint64;
    }
    return deriveModelBSubUint64(
      this.segmentRoot,
      'ORDINARY_GAP',
      `${this.behaviorSelectionOrdinal}:${behaviorId}`,
    );
  }

  durationFor(behaviorId: ModelBBehaviorId, terminal: boolean): number | null {
    const entry = behavior(behaviorId);
    const deadline =
      this.phase === 'TRANSITION' ? this.transitionWindowSeconds! : this.normalTargetSeconds;
    const remaining =
      this.phase === 'LATE_CLOCK'
        ? Math.min(this.periodRemaining, this.shotRemaining)
        : deadline - this.decisionElapsedSeconds;
    const reserve = terminal || this.phase === 'LATE_CLOCK' ? 0 : this.terminalReserveSeconds;
    const maximum = Math.min(entry.maximumSeconds, remaining - reserve);
    if (maximum < entry.minimumSeconds) return null;
    return mapInclusive(this.actionRaw(behaviorId), entry.minimumSeconds, maximum);
  }

  appendOrdinaryGap(behaviorId: ModelBBehaviorId, duration: number, terminal: boolean): void {
    if (this.phase === 'LATE_CLOCK') return;
    const deadline =
      this.phase === 'TRANSITION' ? this.transitionWindowSeconds! : this.normalTargetSeconds;
    const reserve = terminal ? 0 : this.terminalReserveSeconds;
    const maximumGap = deadline - this.decisionElapsedSeconds - duration - reserve;
    if (maximumGap < 0) throw new Error('A time-legal Model B action cannot have a negative gap.');
    const gap = mapInclusive(this.ordinaryGapRaw(behaviorId), 0, maximumGap);
    if (gap > 0) this.appendDecisionClock(gap);
  }

  opportunityQuality(): number {
    const anchor = current(this.session);
    const zone = this.pendingShooterId === null ? 'MID_RANGE' : 'INSIDE';
    return calculateOpportunityQualityMilli({
      creationExecutionMilli: this.creationExecutionMilli,
      teamCoordinationMilli: calculateTeamCoordinationIndexMilli(
        calculateChemistryExecutionModifierMilli(
          anchor.chemistryWeightedMilli[sideKey(this.offenseSide)],
        ),
      ),
      spacingMilli: 50_000,
      helpEnvironmentMilli: 50_000,
      tacticalOpportunityModifierMilli: calculateTacticalExecutionModifierMilli(
        anchor.effectiveFragment.tactics[sideKey(this.defenseSide)],
        offenseOpportunityContext(zone),
      ),
      possessionDeltasMilli: this.opportunityDeltas,
    });
  }

  currentVectorStep(behaviorId?: ModelBBehaviorId): ModelBRunnerVector['offense'][number] | null {
    if (this.runnerVector === null) return null;
    const step = this.runnerVector.offense[this.behaviorSelectionOrdinal];
    if (step === undefined) {
      throw new Error(
        'Model B runner vector exhausted before the live segment reached a boundary.',
      );
    }
    if (behaviorId !== undefined && step.behaviorId !== behaviorId) {
      throw new Error(
        `Model B runner vector expected ${step.behaviorId}, received ${behaviorId} at ordinal ${this.behaviorSelectionOrdinal}.`,
      );
    }
    return step;
  }

  controlledReceiver(behaviorId: RunnerPassBehavior): MatchPlayerSnapshot | null {
    const step = this.currentVectorStep(behaviorId);
    if (step === null) return null;
    if (step.receiverPlayerId === null) {
      throw new Error(`Model B runner vector requires a receiver for ${behaviorId}.`);
    }
    if (step.receiverPlayerId === this.handler.playerId) {
      throw new Error('Model B runner vector cannot create a self-pass.');
    }
    const receiver = this.transitionOffenseParticipants().find(
      ({ playerId }) => playerId === step.receiverPlayerId,
    );
    if (receiver === undefined) {
      throw new Error(`Model B runner vector receiver ${step.receiverPlayerId} is not legal.`);
    }
    return receiver;
  }
}

function phaseGuard(runtime: SegmentRuntime): boolean {
  if (runtime.phase === 'LATE_CLOCK') return false;
  const deadline =
    runtime.phase === 'TRANSITION' ? runtime.transitionWindowSeconds! : runtime.normalTargetSeconds;
  const remaining = deadline - runtime.decisionElapsedSeconds;
  if (remaining > runtime.terminalReserveSeconds) return false;
  if (remaining > 0) runtime.appendDecisionClock(remaining);
  if (runtime.phase === 'TRANSITION') {
    runtime.phase =
      runtime.decisionElapsedSeconds >= runtime.normalTargetSeconds
        ? 'LATE_CLOCK'
        : 'HALF_COURT_NORMAL';
  } else {
    runtime.phase = 'LATE_CLOCK';
  }
  return true;
}

/**
 * Frozen-v6 phase-machine projection. It is deliberately small enough for
 * golden-vector tests, but uses the same target, guard and allocation rules as
 * the production segment loop above. It does not fabricate a transcript or a
 * MatchResult; production still materializes the returned timing semantics in
 * `runLiveSegment`.
 */
export function runModelBSegmentPhaseMachine(
  input: Readonly<{
    state: Readonly<{
      phase: Phase;
      periodClockSeconds: number;
      shotClockSeconds: number;
      decisionElapsedSeconds: number;
      normalTargetSeconds: number;
      transitionWindowSeconds: number;
      terminalReserveSeconds: number;
      handlerPlayerId: string;
    }>;
    plans: readonly Readonly<{
      candidates: readonly Readonly<{ behaviorId: ModelBBehaviorId; weight: number }>[];
      behaviorSelectionRawUint64: bigint;
      actionDurationRawUint64: bigint;
      ordinaryGapRawUint64: bigint | null;
      receiverId: string | null;
      resultCode: 'PASS_SUCCESS' | 'NO_EFFECT';
    }>[];
  }>,
): Readonly<{
  eventPayloads: readonly MatchEvent['payload'][];
  factDrafts: readonly ModelBFactDraft[];
  handlerPlayerId: string;
  phase: Phase;
  decisionElapsedSeconds: number;
  shotClockSeconds: number;
  behaviorSelectionOrdinal: number;
}> {
  let phase = input.state.phase;
  let periodClockSeconds = input.state.periodClockSeconds;
  let shotClockSeconds = input.state.shotClockSeconds;
  let elapsed = input.state.decisionElapsedSeconds;
  let handlerPlayerId = input.state.handlerPlayerId;
  const events: MatchEvent['payload'][] = [];
  const facts: ModelBFactDraft[] = [];
  let initialHandlerFactCreated = false;
  let handlerSequence = 0;
  const appendClock = (seconds: number): void => {
    if (seconds < 1 || seconds > periodClockSeconds || seconds > shotClockSeconds) {
      throw new Error('The frozen phase machine cannot overrun either decision clock.');
    }
    events.push({ type: 'CLOCK_ADVANCED', seconds });
    periodClockSeconds -= seconds;
    shotClockSeconds -= seconds;
    elapsed += seconds;
    if (!initialHandlerFactCreated) {
      facts.push({
        factKind: 'STATISTICAL',
        sourceEventIndexes: [events.length - 1],
        intraTypeOrdinal: handlerSequence,
        payload: {
          type: 'POSSESSION_HANDLER',
          handlerPlayerId,
          reason: 'SEGMENT_CARRY',
          handlerSequence,
        },
      });
      initialHandlerFactCreated = true;
      handlerSequence += 1;
    }
  };
  for (let ordinal = 0; ordinal < input.plans.length; ordinal += 1) {
    if (phase !== 'LATE_CLOCK') {
      const deadline =
        phase === 'TRANSITION'
          ? input.state.transitionWindowSeconds
          : input.state.normalTargetSeconds;
      const remaining = deadline - elapsed;
      if (remaining <= input.state.terminalReserveSeconds) {
        if (remaining > 0) appendClock(remaining);
        phase =
          phase === 'TRANSITION' && elapsed < input.state.normalTargetSeconds
            ? 'HALF_COURT_NORMAL'
            : 'LATE_CLOCK';
      }
    }
    const plan = input.plans[ordinal]!;
    const totalWeight = plan.candidates.reduce((total, candidate) => total + candidate.weight, 0);
    if (totalWeight < 1) throw new Error('A V6 phase plan requires positive candidate weight.');
    const selectedTarget = Number(
      (plan.behaviorSelectionRawUint64 * BigInt(totalWeight)) / UINT64_DOMAIN,
    );
    let cursor = 0;
    const selected = plan.candidates.find((candidate) => {
      cursor += candidate.weight;
      return selectedTarget < cursor;
    });
    if (selected === undefined) throw new Error('A V6 phase plan must select a candidate.');
    const entry = behavior(selected.behaviorId);
    const deadline =
      phase === 'TRANSITION'
        ? input.state.transitionWindowSeconds
        : input.state.normalTargetSeconds;
    const remaining =
      phase === 'LATE_CLOCK' ? Math.min(periodClockSeconds, shotClockSeconds) : deadline - elapsed;
    const terminal = SHOT_BEHAVIORS.has(selected.behaviorId);
    const reserve = terminal || phase === 'LATE_CLOCK' ? 0 : input.state.terminalReserveSeconds;
    const maximum = Math.min(entry.maximumSeconds, remaining - reserve);
    if (maximum < entry.minimumSeconds)
      throw new Error('The phase guard admitted an illegal candidate.');
    const duration = mapInclusive(plan.actionDurationRawUint64, entry.minimumSeconds, maximum);
    if (phase === 'LATE_CLOCK') {
      if (plan.ordinaryGapRawUint64 !== null) {
        throw new Error('LATE_CLOCK must forbid ordinary-gap raw consumption.');
      }
    } else {
      if (plan.ordinaryGapRawUint64 === null) {
        throw new Error('NORMAL/TRANSITION behavior must consume its ordinary-gap raw.');
      }
      const maximumGap = remaining - duration - reserve;
      const gap = mapInclusive(plan.ordinaryGapRawUint64, 0, maximumGap);
      if (gap > 0) appendClock(gap);
    }
    const behaviorClockIndex = events.length;
    const handlerBeforeId = handlerPlayerId;
    appendClock(duration);
    if (plan.resultCode === 'PASS_SUCCESS') {
      if (plan.receiverId === null)
        throw new Error('A successful V6 PASS must identify its receiver.');
      facts.push({
        factKind: 'EXPLANATION',
        sourceEventIndexes: [behaviorClockIndex],
        intraTypeOrdinal: ordinal,
        payload: {
          type: 'PASS',
          passerId: handlerBeforeId,
          receiverId: plan.receiverId,
          behaviorId: selected.behaviorId,
          sequence: ordinal,
        },
      });
      handlerPlayerId = plan.receiverId;
      facts.push({
        factKind: 'STATISTICAL',
        sourceEventIndexes: [behaviorClockIndex],
        intraTypeOrdinal: handlerSequence,
        payload: {
          type: 'POSSESSION_HANDLER',
          handlerPlayerId,
          reason: 'PASS_RECEIVER',
          handlerSequence,
        },
      });
      handlerSequence += 1;
    }
    facts.push({
      factKind: 'OBSERVATION',
      sourceEventIndexes: [behaviorClockIndex],
      intraTypeOrdinal: ordinal,
      payload: {
        type: 'ACTION_TRACE',
        behaviorId: selected.behaviorId,
        classification: entry.classification,
        timeClass: 'BEHAVIOR',
        behaviorSelectionOrdinal: ordinal,
        ruleActionOrdinal: null,
        phase,
        handlerBeforeId,
        handlerAfterId: handlerPlayerId,
        resultCode: plan.resultCode,
        resultBehaviorIds: [],
        resultEventDraftIndexes: [],
      },
    });
    if (shotClockSeconds === 0) {
      events.push({
        type: 'TURNOVER',
        playerId: handlerPlayerId,
        turnoverKind: 'UNFORCED_DEAD_BALL',
      });
      facts.push({
        factKind: 'EXPLANATION',
        sourceEventIndexes: [behaviorClockIndex],
        intraTypeOrdinal: 0,
        payload: { type: 'SHOT_CLOCK_VIOLATION', handlerPlayerId },
      });
      return Object.freeze({
        eventPayloads: Object.freeze(events),
        factDrafts: Object.freeze(facts),
        handlerPlayerId,
        phase,
        decisionElapsedSeconds: elapsed,
        shotClockSeconds,
        behaviorSelectionOrdinal: ordinal + 1,
      });
    }
  }
  return Object.freeze({
    eventPayloads: Object.freeze(events),
    factDrafts: Object.freeze(facts),
    handlerPlayerId,
    phase,
    decisionElapsedSeconds: elapsed,
    shotClockSeconds,
    behaviorSelectionOrdinal: input.plans.length,
  });
}

function actionFits(
  runtime: SegmentRuntime,
  behaviorId: ModelBBehaviorId,
  terminal: boolean,
): boolean {
  const controlled = runtime.currentVectorStep();
  if (controlled !== null && controlled.behaviorId !== behaviorId) return false;
  return runtime.durationFor(behaviorId, terminal) !== null;
}

function directDefender(runtime: SegmentRuntime, target: MatchPlayerSnapshot): MatchPlayerSnapshot {
  const anchor = current(runtime.session);
  const eligibleDefenders = runtime.transitionDefenseParticipants();
  const defenderId = resolveModelBDirectOpponent({
    actorPlayerId: target.playerId,
    actorLineup: anchor.lineups[sideKey(runtime.offenseSide)],
    opponentLineup: anchor.lineups[sideKey(runtime.defenseSide)],
    eligibleOpponentIds: eligibleDefenders.map(({ playerId }) => playerId),
  });
  if (defenderId === null) throw new Error('A legal Model B action requires an on-ball defender.');
  return player(runtime.session, runtime.defenseSide, defenderId);
}

function transitionParticipants(
  runtime: SegmentRuntime,
  origin: NonNullable<TransitionOrigin>,
  transitionRoot: bigint,
): Readonly<{
  supporters: readonly MatchPlayerSnapshot[];
  retreaters: readonly MatchPlayerSnapshot[];
}> {
  const supporters = runtime.offense
    .filter(({ playerId }) => playerId !== runtime.handler.playerId)
    .map((participant) => ({
      participant,
      score: transitionCandidateScore(
        runtime.session,
        participant,
        deriveModelBSubUint64(transitionRoot, 'OFF_SUPPORT', participant.playerId),
        'SUPPORT',
      ),
    }))
    .sort((left, right) =>
      right.score === left.score
        ? compareUtf16CodeUnits(left.participant.playerId, right.participant.playerId)
        : right.score - left.score,
    )
    .slice(0, Math.min(2, runtime.offense.length - 1))
    .map(({ participant }) => participant);
  const retreatRole: 'DRB_RETREAT' | 'LIVE_BALL_RETREAT' =
    origin.kind === 'DRB' ? 'DRB_RETREAT' : 'LIVE_BALL_RETREAT';
  const retreaters = runtime.defense
    .map((participant) => ({
      participant,
      score: transitionCandidateScore(
        runtime.session,
        participant,
        deriveModelBSubUint64(transitionRoot, 'DEF_RETREAT', participant.playerId),
        retreatRole,
      ),
    }))
    .sort((left, right) =>
      right.score === left.score
        ? compareUtf16CodeUnits(left.participant.playerId, right.participant.playerId)
        : right.score - left.score,
    )
    .slice(0, Math.min(3, runtime.defense.length))
    .map(({ participant }) => participant);
  return Object.freeze({
    supporters: Object.freeze(supporters),
    retreaters: Object.freeze(retreaters),
  });
}

function transitionEntry(runtime: SegmentRuntime): void {
  const origin = transitionOrigin(runtime.session);
  if (origin === null) return;
  const transitionD = behavior('TRANSITIOND');
  const available = Math.min(runtime.periodRemaining, runtime.shotRemaining);
  if (available < transitionD.minimumSeconds + runtime.terminalReserveSeconds) return;
  const controller = runtime.handler;
  const transitionRoot = keyedDrawUint64({
    ...drawContext(runtime.session),
    drawKind: 'TRANSITION',
    localIndex: 0,
  });
  const participants = transitionParticipants(runtime, origin, transitionRoot);
  runtime.transitionSupporterIds = participants.supporters.map(({ playerId }) => playerId);
  runtime.transitionRetreaterIds = participants.retreaters.map(({ playerId }) => playerId);
  const direct = participants.retreaters[0];
  if (direct === undefined) throw new Error('Transition entry requires a legal primary retreater.');
  const offenseExecution = weightedTransitionExecution(
    runtime.session,
    runtime.offenseSide,
    [controller, ...participants.supporters],
    [700, ...participants.supporters.map(() => 150)],
    [
      'TRANSITION_CONTROLLER',
      ...participants.supporters.map<'TRANSITION_SUPPORT'>(() => 'TRANSITION_SUPPORT'),
    ],
  );
  const defenseExecution = weightedTransitionExecution(
    runtime.session,
    runtime.defenseSide,
    participants.retreaters,
    [600, ...participants.retreaters.slice(1).map(() => 200)],
    participants.retreaters.map<'TRANSITION_RETREAT'>(() => 'TRANSITION_RETREAT'),
  );
  const probabilityMilli = calculateModelBTransitionFormationProbabilityMilli({
    offenseExecutionMilli: offenseExecution,
    defenseExecutionMilli: defenseExecution,
    sourceModifierMilli: origin.sourceModifierMilli,
    pace: current(runtime.session).effectiveFragment.tactics[sideKey(runtime.offenseSide)].pace,
  });
  // The forced singleton still consumes the frozen BEHAVIOR ordinal zero.
  selectModelBBehavior({
    context: drawContext(runtime.session),
    behaviorSelectionOrdinal: runtime.behaviorSelectionOrdinal,
    decisionPlayer: direct,
    legalBehaviorIds: ['TRANSITIOND'],
    safeFallbackBehaviorId: 'TRANSITIOND',
  });
  const duration = runtime.durationFor('TRANSITIOND', false);
  if (duration === null) return;
  const start = runtime.decisionElapsedSeconds;
  const clockIndex = runtime.appendDecisionClock(duration);
  const formed = probabilityOccurs(
    deriveModelBSubUint64(transitionRoot, 'FORMATION', '0'),
    probabilityMilli,
  );
  runtime.transitionWindowSeconds = Math.min(
    mapInclusive(deriveModelBSubUint64(transitionRoot, 'TRANSITION_WINDOW', ''), 3, 8),
    runtime.normalTargetSeconds,
  );
  runtime.transitionContextFactIndex = runtime.facts.length;
  runtime.facts.push({
    factKind: 'EXPLANATION',
    sourceEventIndexes: [clockIndex],
    intraTypeOrdinal: 0,
    payload: {
      type: 'TRANSITION_CONTEXT',
      origin: origin.kind,
      originEventId: origin.sourceEventId,
      controllerId: controller.playerId,
      supporterIds: runtime.transitionSupporterIds,
      retreaterIds: runtime.transitionRetreaterIds,
      offenseExecutionMilli: offenseExecution,
      defenseExecutionMilli: defenseExecution,
      formationProbabilityMilli: probabilityMilli,
      formed,
      transitionWindowSeconds: runtime.transitionWindowSeconds,
      fallback: null,
      finalPhase: formed ? 'TRANSITION' : 'HALF_COURT',
      ...runtime['coordinate'](),
    },
  });
  runtime.addActionTrace({
    behaviorId: 'TRANSITIOND',
    clockIndex,
    handlerBeforeId: runtime.handler.playerId,
    actorIds: runtime.transitionRetreaterIds,
    targetIds: [controller.playerId],
    durationSeconds: duration,
    startOffsetSeconds: start,
    resultCode: formed ? 'TRANSITION_FORMED' : 'TRANSITION_STOPPED',
    resultIndexes: [],
  });
  runtime.behaviorSelectionOrdinal += 1;
  if (!formed) return;
  runtime.phase = 'TRANSITION';
  runtime.transitionRoot = transitionRoot;
  runtime.transitionOffenseExecutionMilli = offenseExecution;
  runtime.transitionDefenseExecutionMilli = defenseExecution;
  runtime.forceOffense = true;
}

function applyTransitionFallback(
  runtime: SegmentRuntime,
  trigger: 'WINDOW_EXPIRED' | 'REORG_COMPLETED' | 'OFFENSE_COMPLETED',
): boolean {
  if (runtime.phase !== 'TRANSITION' || runtime.transitionRoot === null) return false;
  const leaveTransition = (
    reason: 'WINDOW_EXPIRED' | 'REORG_COMPLETED' | 'RNG_DEFENSE_RECOVERY',
  ): boolean => {
    runtime.phase =
      runtime.decisionElapsedSeconds >= runtime.normalTargetSeconds
        ? 'LATE_CLOCK'
        : 'HALF_COURT_NORMAL';
    runtime.forceOffense = false;
    runtime.markTransitionFallback(reason);
    return true;
  };
  runtime.completedTransitionOffenseActions += 1;
  if (
    trigger === 'WINDOW_EXPIRED' ||
    trigger === 'REORG_COMPLETED' ||
    runtime.decisionElapsedSeconds >= runtime.transitionWindowSeconds!
  ) {
    return leaveTransition(trigger === 'REORG_COMPLETED' ? 'REORG_COMPLETED' : 'WINDOW_EXPIRED');
  }
  const probabilityMilli = calculateModelBTransitionFallbackProbabilityMilli({
    offenseExecutionMilli: runtime.transitionOffenseExecutionMilli!,
    defenseExecutionMilli: runtime.transitionDefenseExecutionMilli!,
    elapsedTransitionDecisionSeconds: runtime.decisionElapsedSeconds,
    transitionWindowSeconds: runtime.transitionWindowSeconds!,
    completedTransitionOffenseActions: runtime.completedTransitionOffenseActions,
  });
  const raw = deriveModelBSubUint64(
    runtime.transitionRoot,
    'FALLBACK',
    String(runtime.completedTransitionOffenseActions),
  );
  if (probabilityOccurs(raw, probabilityMilli)) {
    return leaveTransition('RNG_DEFENSE_RECOVERY');
  }
  return false;
}

function resolveDefense(
  runtime: SegmentRuntime,
  behaviorId: Extract<
    ModelBBehaviorId,
    'ONDEF' | 'PRESS' | 'STLTRY' | 'CONTEST' | 'HELPD' | 'DOUBLET'
  >,
  duration: number,
): ModelBSegmentResolution | null {
  const handlerBefore = runtime.handler;
  const defender = directDefender(runtime, handlerBefore);
  const supporting =
    behaviorId === 'DOUBLET'
      ? (selectModelBDoubleTeamActors(
          runtime.defense.filter(({ playerId }) => playerId !== defender.playerId),
        )?.map(({ playerId }) => playerId) ?? [])
      : [];
  const actor =
    behaviorId === 'HELPD'
      ? (selectModelBHelpDefender({
          context: drawContext(runtime.session),
          behaviorSelectionOrdinal: runtime.behaviorSelectionOrdinal,
          currentLineup: current(runtime.session).lineups[sideKey(runtime.defenseSide)],
          candidates: runtime.defense,
          onBallDefenderId: defender.playerId,
        })?.value ??
        (() => {
          throw new Error(
            'HELPD requires a legal help defender distinct from the on-ball defender.',
          );
        })())
      : behaviorId === 'STLTRY'
        ? (selectModelBActor({
            context: drawContext(runtime.session),
            behaviorId,
            behaviorSelectionOrdinal: runtime.behaviorSelectionOrdinal,
            candidates: runtime.defense,
            excludedPlayerIds: [],
          })?.value ?? defender)
        : defender;
  runtime.appendOrdinaryGap(behaviorId, duration, false);
  const start = runtime.decisionElapsedSeconds;
  const clockIndex = runtime.appendDecisionClock(duration);
  let resultCode: string;
  const resultIndexes: number[] = [];
  if (behaviorId === 'ONDEF') {
    runtime.contestDefenseModifierMilli += 2_000;
    resultCode = 'ON_BALL_DEFENSE_APPLIED';
  } else if (behaviorId === 'CONTEST') {
    runtime.contestDefenseModifierMilli += 4_000;
    resultCode = 'CONTEST_APPLIED_TO_NEXT_SHOT';
  } else if (behaviorId === 'STLTRY') {
    runtime.stealCandidate = {
      playerId: actor.playerId,
      attributionProbabilityMilli: calculateAttributionProbabilityMilli(
        'STEAL',
        effectiveExecution(runtime.session, runtime.defenseSide, actor, 'STEAL'),
        effectiveExecution(
          runtime.session,
          runtime.offenseSide,
          handlerBefore,
          'BALL_PROTECTION',
          'BALL_SECURITY',
        ),
      ),
    };
    resultCode = 'STEAL_ATTRIBUTION_CANDIDATE_ARMED';
  } else {
    const execution = effectiveExecution(
      runtime.session,
      runtime.defenseSide,
      actor,
      behaviorId === 'PRESS' ? 'PRESS' : behaviorId === 'DOUBLET' ? 'DOUBLE_TEAM' : 'HELP_DEFENSE',
      behaviorId === 'HELPD' ? 'PAINT_DEFENSE' : 'ON_BALL_PERIMETER_DEFENSE',
      behaviorId === 'PRESS' ? 'DEFENSIVE_PRESSURE' : null,
    );
    const resistance = effectiveExecution(
      runtime.session,
      runtime.offenseSide,
      handlerBefore,
      behaviorId === 'HELPD' ? 'CREATION' : 'BALL_PROTECTION',
      behaviorId === 'HELPD' ? 'NONE' : 'BALL_SECURITY',
    );
    const success =
      keyedDrawInt(
        {
          ...drawContext(runtime.session),
          drawKind: 'DEFENSIVE_ACTION',
          localIndex: modelBDefenseExecutionLocalIndex(runtime.behaviorSelectionOrdinal),
        },
        0,
        999,
      ) < calculateBehaviorExecutionProbabilityMilli(behaviorId, execution, resistance);
    if (behaviorId === 'DOUBLET' && !success) {
      const foul = buildModelBDefensiveFoulResolution(runtime.session, {
        transitionEventOffset: runtime.prefix + runtime.payloads.length,
        defenderId: defender.playerId,
        behaviorSelectionOrdinal: runtime.behaviorSelectionOrdinal,
        occurrenceProbabilityMilli: calculateDefensiveFoulProbabilityMilli({
          context: 'PRESSURE',
          offensiveContactMilli: effectiveExecution(
            runtime.session,
            runtime.offenseSide,
            handlerBefore,
            'INSIDE_CONTACT',
            'CONTACT_FINISH',
          ),
          defensiveControlMilli: effectiveExecution(
            runtime.session,
            runtime.defenseSide,
            defender,
            'DEFENSIVE_CONTROL',
            'ON_BALL_PERIMETER_DEFENSE',
          ),
          actionMode: 'RISKY',
        }),
        shootingContext: null,
      });
      if (foul.occurred) {
        const first = runtime.payloads.length;
        runtime.payloads.push(...foul.eventPayloads);
        resultIndexes.push(first);
        runtime.facts.push(
          buildModelBDefensiveActionFactDraft({
            sourceEventIndexes: [clockIndex],
            behaviorId,
            offenseSide: runtime.offenseSide,
            defenseSide: runtime.defenseSide,
            handlerId: handlerBefore.playerId,
            primaryDefenderId: defender.playerId,
            supportingDefenderIds: supporting,
            result: 'FOUL',
            opportunityQualityDelta: 0,
            breakdownOpportunity: false,
            behaviorSelectionOrdinal: runtime.behaviorSelectionOrdinal,
            ...runtime['coordinate'](),
          }),
        );
        resultCode = 'DOUBLE_TEAM_DEFENSIVE_FOUL';
        runtime.addActionTrace({
          behaviorId,
          clockIndex,
          handlerBeforeId: handlerBefore.playerId,
          actorIds: [actor.playerId, ...supporting],
          targetIds: [handlerBefore.playerId],
          durationSeconds: duration,
          startOffsetSeconds: start,
          resultCode,
          resultIndexes,
        });
        runtime.behaviorSelectionOrdinal += 1;
        return runtime.periodRemaining === 0 ? 'PERIOD_END' : 'SAME_SIDE_DEAD_BALL';
      }
    }
    const delta = behaviorId === 'HELPD' ? (success ? -6_000 : 0) : success ? -3_000 : 6_000;
    runtime.opportunityDeltas.push(delta);
    if (success && (behaviorId === 'PRESS' || behaviorId === 'DOUBLET')) {
      runtime.turnoverRiskMilli += MODEL_B_PARAMETER_REGISTRY.pressureTurnoverRiskMilli;
    }
    if (!success && (behaviorId === 'PRESS' || behaviorId === 'DOUBLET')) {
      runtime.contestDefenseModifierMilli +=
        MODEL_B_PARAMETER_REGISTRY.failedRiskDefenseExecutionMilli;
    }
    runtime.facts.push(
      buildModelBDefensiveActionFactDraft({
        sourceEventIndexes: [clockIndex],
        behaviorId,
        offenseSide: runtime.offenseSide,
        defenseSide: runtime.defenseSide,
        handlerId: handlerBefore.playerId,
        primaryDefenderId: defender.playerId,
        supportingDefenderIds: behaviorId === 'HELPD' ? [actor.playerId] : supporting,
        result:
          behaviorId === 'HELPD'
            ? success
              ? 'SUCCESS'
              : 'NO_EFFECT'
            : success
              ? 'SUCCESS'
              : 'FAILED_BREAKDOWN',
        opportunityQualityDelta: delta,
        breakdownOpportunity: behaviorId !== 'HELPD' && !success,
        behaviorSelectionOrdinal: runtime.behaviorSelectionOrdinal,
        ...runtime['coordinate'](),
      }),
    );
    resultCode = `${behaviorId}_${success ? 'SUCCESS' : 'FAILED'}`;
  }
  runtime.addActionTrace({
    behaviorId,
    clockIndex,
    handlerBeforeId: handlerBefore.playerId,
    actorIds: [actor.playerId, ...supporting],
    targetIds: [handlerBefore.playerId],
    durationSeconds: duration,
    startOffsetSeconds: start,
    resultCode,
    resultIndexes,
  });
  runtime.behaviorSelectionOrdinal += 1;
  runtime.forceOffense = true;
  if (runtime.periodRemaining === 0) return 'PERIOD_END';
  return null;
}

function turnoverProbability(
  runtime: SegmentRuntime,
  handler: MatchPlayerSnapshot,
  defender: MatchPlayerSnapshot,
  creative = false,
): number {
  return calculateTurnoverProbabilityMilli({
    defensivePressureMilli: effectiveExecution(
      runtime.session,
      runtime.defenseSide,
      defender,
      'DEFENSIVE_PRESSURE',
      'ON_BALL_PERIMETER_DEFENSE',
      'DEFENSIVE_PRESSURE',
    ),
    ballSecurityMilli: effectiveExecution(
      runtime.session,
      runtime.offenseSide,
      handler,
      'BALL_PROTECTION',
      'BALL_SECURITY',
    ),
    actionPressureMilli: runtime.turnoverRiskMilli > 0 ? 4_000 : -3_000,
    pace: current(runtime.session).effectiveFragment.tactics[sideKey(runtime.offenseSide)].pace,
    teamExecutionModifierMilli: calculateChemistryExecutionModifierMilli(
      current(runtime.session).chemistryWeightedMilli[sideKey(runtime.offenseSide)],
    ),
    additionalRiskMilli:
      runtime.turnoverRiskMilli +
      (creative ? MODEL_B_PARAMETER_REGISTRY.creativePassTurnoverRiskMilli : 0),
  });
}

function resolveTurnover(
  runtime: SegmentRuntime,
  handler: MatchPlayerSnapshot,
  defender: MatchPlayerSnapshot,
  creative = false,
): readonly number[] | null {
  if (runtime.currentVectorStep()?.turnoverMode === 'FORCE_NONE') return null;
  const resolution = buildModelBTurnoverResolution(runtime.session, {
    transitionEventOffset: runtime.prefix + runtime.payloads.length,
    handlerPlayerId: handler.playerId,
    behaviorSelectionOrdinal: runtime.behaviorSelectionOrdinal,
    occurrenceProbabilityMilli: turnoverProbability(runtime, handler, defender, creative),
    pressuredClassificationProbabilityMilli:
      calculatePressuredTurnoverClassificationProbabilityMilli({
        defensivePressureMilli: effectiveExecution(
          runtime.session,
          runtime.defenseSide,
          defender,
          'DEFENSIVE_PRESSURE',
          'ON_BALL_PERIMETER_DEFENSE',
          'DEFENSIVE_PRESSURE',
        ),
        ballSecurityMilli: effectiveExecution(
          runtime.session,
          runtime.offenseSide,
          handler,
          'BALL_PROTECTION',
          'BALL_SECURITY',
        ),
        actionPressureMilli: runtime.turnoverRiskMilli > 0 ? 4_000 : -3_000,
      }),
    ...(runtime.stealCandidate === null ? {} : { stealCandidate: runtime.stealCandidate }),
  });
  if (!resolution.occurred) return null;
  const first = runtime.payloads.length;
  runtime.payloads.push(...resolution.eventPayloads);
  return resolution.eventPayloads.map((_, index) => first + index);
}

function resolvePass(
  runtime: SegmentRuntime,
  behaviorId: RunnerPassBehavior,
  duration: number,
): ModelBSegmentResolution | null {
  const handlerBefore = runtime.handler;
  const defender = directDefender(runtime, handlerBefore);
  const receiver =
    runtime.controlledReceiver(behaviorId) ??
    selectModelBReceiverOrBeneficiary({
      context: drawContext(runtime.session),
      behaviorId,
      behaviorSelectionOrdinal: runtime.behaviorSelectionOrdinal,
      candidates: runtime.transitionOffenseParticipants(),
      excludedPlayerIds: [handlerBefore.playerId],
    })?.value ??
    null;
  if (receiver === null) throw new Error(`${behaviorId} requires one legal receiver.`);
  runtime.appendOrdinaryGap(behaviorId, duration, false);
  const start = runtime.decisionElapsedSeconds;
  const clockIndex = runtime.appendDecisionClock(duration);
  const resultIndexes = resolveTurnover(
    runtime,
    handlerBefore,
    defender,
    behaviorId === 'CREATIVE_PASS',
  );
  if (resultIndexes !== null) {
    runtime.addActionTrace({
      behaviorId,
      clockIndex,
      handlerBeforeId: handlerBefore.playerId,
      actorIds: [handlerBefore.playerId],
      targetIds: [receiver.playerId],
      durationSeconds: duration,
      startOffsetSeconds: start,
      resultCode: 'PASS_TURNOVER',
      resultIndexes,
    });
    runtime.behaviorSelectionOrdinal += 1;
    return runtime.periodRemaining === 0 ? 'PERIOD_END' : 'POSSESSION_CHANGE';
  }
  runtime.facts.push(
    buildModelBPassFactDraft({
      sourceEventIndexes: [clockIndex],
      passerId: handlerBefore.playerId,
      receiverId: receiver.playerId,
      behaviorId,
      possessionIndex: current(runtime.session).possession.possessionIndex,
      segmentIndex: current(runtime.session).possession.segmentIndex,
      sequence: runtime.passSequence,
    }),
  );
  runtime.passSequence += 1;
  runtime.changeHandler(receiver, clockIndex);
  runtime.pendingAssist = { passerId: handlerBefore.playerId, receiverId: receiver.playerId };
  if (behaviorId === 'CREATIVE_PASS' || behaviorId === 'HELDKICK') {
    const delta = Math.min(
      MODEL_B_PARAMETER_REGISTRY.creativePassOpportunityBonusMilli,
      MODEL_B_PARAMETER_REGISTRY.opportunityPerEventCapMilli,
    );
    runtime.opportunityDeltas.push(MODEL_B_PARAMETER_REGISTRY.creativePassOpportunityBonusMilli);
    runtime.facts.push(
      buildModelBCreationFactDraft({
        sourceEventIndexes: [clockIndex],
        creatorId: handlerBefore.playerId,
        beneficiaryId: receiver.playerId,
        behaviorId,
        opportunityQualityDelta: delta,
        defensiveResponse: 'NONE',
        behaviorSelectionOrdinal: runtime.behaviorSelectionOrdinal,
        ...runtime['coordinate'](),
        nextBehaviorId: null,
      }),
    );
  }
  runtime.addActionTrace({
    behaviorId,
    clockIndex,
    handlerBeforeId: handlerBefore.playerId,
    actorIds: [handlerBefore.playerId],
    targetIds: [receiver.playerId],
    durationSeconds: duration,
    startOffsetSeconds: start,
    resultCode: 'PASS_COMPLETED',
    resultIndexes: [],
  });
  runtime.behaviorSelectionOrdinal += 1;
  runtime.forceOffense = false;
  if (runtime.periodRemaining === 0) return 'PERIOD_END';
  return null;
}

function resolveCreation(
  runtime: SegmentRuntime,
  behaviorId: RunnerCreationBehavior,
  duration: number,
): ModelBSegmentResolution | null {
  const handlerBefore = runtime.handler;
  const defender = directDefender(runtime, handlerBefore);
  runtime.appendOrdinaryGap(behaviorId, duration, false);
  const start = runtime.decisionElapsedSeconds;
  const clockIndex = runtime.appendDecisionClock(duration);
  const resultIndexes: number[] = [];
  if (OFFENSIVE_FOUL_CREATION_BEHAVIORS.has(behaviorId)) {
    const foul = buildModelBOffensiveFoulResolution(runtime.session, {
      transitionEventOffset: runtime.prefix + runtime.payloads.length,
      playerId: handlerBefore.playerId,
      behaviorSelectionOrdinal: runtime.behaviorSelectionOrdinal,
      occurrenceProbabilityMilli: calculateOffensiveFoulProbabilityMilli(
        effectiveExecution(
          runtime.session,
          runtime.defenseSide,
          defender,
          'DEFENSIVE_CONTROL',
          'ON_BALL_PERIMETER_DEFENSE',
        ),
        effectiveExecution(
          runtime.session,
          runtime.offenseSide,
          handlerBefore,
          'OFFENSIVE_CONTROL',
          'BALL_SECURITY',
        ),
      ),
    });
    if (foul.occurred) {
      const first = runtime.payloads.length;
      runtime.payloads.push(...foul.eventPayloads);
      resultIndexes.push(...foul.eventPayloads.map((_, index) => first + index));
      runtime.addActionTrace({
        behaviorId,
        clockIndex,
        handlerBeforeId: handlerBefore.playerId,
        actorIds: [handlerBefore.playerId],
        targetIds: [defender.playerId],
        durationSeconds: duration,
        startOffsetSeconds: start,
        resultCode: 'OFFENSIVE_FOUL',
        resultIndexes,
      });
      runtime.behaviorSelectionOrdinal += 1;
      return runtime.periodRemaining === 0 ? 'PERIOD_END' : 'POSSESSION_CHANGE';
    }
  }
  const turnoverIndexes = resolveTurnover(runtime, handlerBefore, defender);
  if (turnoverIndexes !== null) {
    runtime.addActionTrace({
      behaviorId,
      clockIndex,
      handlerBeforeId: handlerBefore.playerId,
      actorIds: [handlerBefore.playerId],
      targetIds: [defender.playerId],
      durationSeconds: duration,
      startOffsetSeconds: start,
      resultCode: 'CREATION_TURNOVER',
      resultIndexes: turnoverIndexes,
    });
    runtime.behaviorSelectionOrdinal += 1;
    return runtime.periodRemaining === 0 ? 'PERIOD_END' : 'POSSESSION_CHANGE';
  }
  const attackerExecution = effectiveExecution(
    runtime.session,
    runtime.offenseSide,
    handlerBefore,
    CREATION_BLEND[behaviorId],
    'BALL_SECURITY',
  );
  const defenderExecution = effectiveExecution(
    runtime.session,
    runtime.defenseSide,
    defender,
    'DEFENSIVE_CONTROL',
    'ON_BALL_PERIMETER_DEFENSE',
  );
  const success =
    keyedDrawInt(
      {
        ...drawContext(runtime.session),
        drawKind: 'BEHAVIOR',
        localIndex: modelBCreationExecutionLocalIndex(runtime.behaviorSelectionOrdinal),
      },
      0,
      999,
    ) < calculateCreationProbabilityMilli(behaviorId, attackerExecution, defenderExecution);
  const delta = success
    ? MODEL_B_PARAMETER_REGISTRY.opportunityPerEventCapMilli
    : -MODEL_B_PARAMETER_REGISTRY.opportunityPerEventCapMilli;
  runtime.opportunityDeltas.push(
    success
      ? MODEL_B_PARAMETER_REGISTRY.creationRawBonusMilli
      : -MODEL_B_PARAMETER_REGISTRY.creationRawBonusMilli,
  );
  runtime.creationExecutionMilli = attackerExecution;
  const exit = success
    ? (selectModelBCreationExit({
        context: drawContext(runtime.session),
        behaviorSelectionOrdinal: runtime.behaviorSelectionOrdinal + 1,
        decisionPlayer: handlerBefore,
        safeFallbackBehaviorId: CREATION_SAFE_EXIT[behaviorId],
        creationBehaviorId: behaviorId,
      }).value.behavior.behaviorId as ModelBBehaviorId)
    : 'REORG';
  runtime.facts.push(
    buildModelBCreationFactDraft({
      sourceEventIndexes: [clockIndex],
      creatorId: handlerBefore.playerId,
      beneficiaryId: handlerBefore.playerId,
      behaviorId,
      opportunityQualityDelta: delta,
      defensiveResponse: runtime.turnoverRiskMilli > 0 ? 'DOUBLE_TEAM' : 'CONTESTED',
      behaviorSelectionOrdinal: runtime.behaviorSelectionOrdinal,
      ...runtime['coordinate'](),
      nextBehaviorId: exit,
    }),
  );
  runtime.forceNextBehavior = exit;
  runtime.addActionTrace({
    behaviorId,
    clockIndex,
    handlerBeforeId: handlerBefore.playerId,
    actorIds: [handlerBefore.playerId],
    targetIds: [defender.playerId],
    durationSeconds: duration,
    startOffsetSeconds: start,
    resultCode: success ? 'CREATION_SUCCESS' : 'CREATION_FAILED_REORGANIZE',
    resultIndexes,
  });
  runtime.behaviorSelectionOrdinal += 1;
  runtime.forceOffense = true;
  if (runtime.periodRemaining === 0) return 'PERIOD_END';
  return null;
}

function resolveOffBall(
  runtime: SegmentRuntime,
  behaviorId: RunnerOffBallBehavior,
  duration: number,
): ModelBSegmentResolution | null {
  const handlerBefore = runtime.handler;
  const defender = directDefender(runtime, handlerBefore);
  const actor =
    selectModelBActor({
      context: drawContext(runtime.session),
      behaviorId,
      behaviorSelectionOrdinal: runtime.behaviorSelectionOrdinal,
      candidates: runtime.transitionOffenseParticipants(),
      excludedPlayerIds: behaviorId === 'SCREEN' ? [handlerBefore.playerId] : [],
    })?.value ?? handlerBefore;
  runtime.appendOrdinaryGap(behaviorId, duration, false);
  const start = runtime.decisionElapsedSeconds;
  const clockIndex = runtime.appendDecisionClock(duration);
  const blend: ModelBExecutionBlend =
    behaviorId === 'SCREEN' ? 'SCREEN' : behaviorId === 'CUT' ? 'CUT' : 'DOUBLE_CREATE';
  const success =
    keyedDrawInt(
      {
        ...drawContext(runtime.session),
        drawKind: 'BEHAVIOR',
        localIndex: modelBOffBallExecutionLocalIndex(runtime.behaviorSelectionOrdinal),
      },
      0,
      999,
    ) <
    calculateBehaviorExecutionProbabilityMilli(
      behaviorId,
      effectiveExecution(runtime.session, runtime.offenseSide, actor, blend),
      effectiveExecution(
        runtime.session,
        runtime.defenseSide,
        defender,
        'DEFENSIVE_CONTROL',
        'ON_BALL_PERIMETER_DEFENSE',
      ),
    );
  const beneficiary =
    behaviorId === 'SCREEN'
      ? handlerBefore
      : (selectModelBReceiverOrBeneficiary({
          context: drawContext(runtime.session),
          behaviorId,
          behaviorSelectionOrdinal: runtime.behaviorSelectionOrdinal,
          candidates: runtime.transitionOffenseParticipants(),
          excludedPlayerIds: behaviorId === 'CUT' ? [] : [handlerBefore.playerId],
        })?.value ?? actor);
  const delta = success
    ? MODEL_B_PARAMETER_REGISTRY.opportunityPerEventCapMilli
    : -MODEL_B_PARAMETER_REGISTRY.opportunityPerEventCapMilli;
  runtime.opportunityDeltas.push(
    success
      ? MODEL_B_PARAMETER_REGISTRY.offBallRawBonusMilli
      : -MODEL_B_PARAMETER_REGISTRY.offBallRawBonusMilli,
  );
  runtime.creationExecutionMilli = effectiveExecution(
    runtime.session,
    runtime.offenseSide,
    actor,
    blend,
  );
  const nextBehaviorId: ModelBBehaviorId = success
    ? behaviorId === 'CUT'
      ? 'LAYUP'
      : 'SPOTUP'
    : 'REORG';
  runtime.facts.push(
    buildModelBCreationFactDraft({
      sourceEventIndexes: [clockIndex],
      creatorId: actor.playerId,
      beneficiaryId: beneficiary.playerId,
      behaviorId,
      opportunityQualityDelta: delta,
      defensiveResponse: 'CONTESTED',
      behaviorSelectionOrdinal: runtime.behaviorSelectionOrdinal,
      ...runtime['coordinate'](),
      nextBehaviorId,
    }),
  );
  runtime.pendingShooterId = success ? beneficiary.playerId : null;
  runtime.forceNextBehavior = nextBehaviorId;
  runtime.addActionTrace({
    behaviorId,
    clockIndex,
    handlerBeforeId: handlerBefore.playerId,
    actorIds: [actor.playerId],
    targetIds: [beneficiary.playerId, defender.playerId],
    durationSeconds: duration,
    startOffsetSeconds: start,
    resultCode: success ? 'OFF_BALL_SUCCESS' : 'OFF_BALL_FAILED_REORGANIZE',
    resultIndexes: [],
  });
  runtime.behaviorSelectionOrdinal += 1;
  runtime.forceOffense = true;
  if (runtime.periodRemaining === 0) return 'PERIOD_END';
  return null;
}

function resolveShot(
  runtime: SegmentRuntime,
  behaviorId: RunnerShotBehavior,
  duration: number,
): ModelBSegmentResolution {
  const handlerBefore = runtime.handler;
  const shooterCandidates =
    runtime.pendingShooterId === null
      ? runtime.transitionOffenseParticipants()
      : runtime
          .transitionOffenseParticipants()
          .filter(({ playerId }) => playerId === runtime.pendingShooterId);
  const shooter = selectedShooter(runtime.session, shooterCandidates, runtime.shotInstanceIndex);
  const defender = directDefender(runtime, shooter);
  const zone = SHOT_ZONE_BY_BEHAVIOR[behaviorId];
  runtime.appendOrdinaryGap(behaviorId, duration, true);
  const start = runtime.decisionElapsedSeconds;
  const clockIndex = runtime.appendDecisionClock(duration);
  const resultIndexes: number[] = [];
  const [offenseBlend, defenseBlend] = zoneBlends(zone);
  const opportunityQualityMilli = runtime.opportunityQuality();
  const makeProbabilityMilli = calculateShotProbabilityMilli({
    zone,
    offensiveExecutionMilli: effectiveExecution(
      runtime.session,
      runtime.offenseSide,
      shooter,
      offenseBlend,
      zone === 'INSIDE' ? 'CONTACT_FINISH' : 'OPEN_PERIMETER_SHOT',
      offenseTacticalContext(zone),
    ),
    defensiveExecutionMilli: clampFixedPoint(
      effectiveExecution(
        runtime.session,
        runtime.defenseSide,
        defender,
        defenseBlend,
        zone === 'INSIDE' ? 'PAINT_DEFENSE' : 'ON_BALL_PERIMETER_DEFENSE',
      ) + runtime.contestDefenseModifierMilli,
      0,
      100_000,
    ),
    opportunityQualityMilli,
  });
  const offensiveFoul =
    behaviorId === 'CONTACTFIN'
      ? buildModelBOffensiveFoulResolution(runtime.session, {
          transitionEventOffset: runtime.prefix + runtime.payloads.length,
          playerId: shooter.playerId,
          behaviorSelectionOrdinal: runtime.behaviorSelectionOrdinal,
          occurrenceProbabilityMilli: calculateOffensiveFoulProbabilityMilli(
            effectiveExecution(
              runtime.session,
              runtime.defenseSide,
              defender,
              'INSIDE_DEFENSIVE_CONTROL',
              'PAINT_DEFENSE',
            ),
            effectiveExecution(
              runtime.session,
              runtime.offenseSide,
              shooter,
              'OFFENSIVE_CONTROL',
              'BALL_SECURITY',
            ),
          ),
        })
      : null;
  if (offensiveFoul?.occurred) {
    const first = runtime.payloads.length;
    runtime.payloads.push(...offensiveFoul.eventPayloads);
    resultIndexes.push(...offensiveFoul.eventPayloads.map((_, index) => first + index));
    runtime.addActionTrace({
      behaviorId,
      clockIndex,
      handlerBeforeId: handlerBefore.playerId,
      actorIds: [shooter.playerId],
      targetIds: [defender.playerId],
      durationSeconds: duration,
      startOffsetSeconds: start,
      resultCode: 'OFFENSIVE_FOUL',
      resultIndexes,
      opportunityQualityMilli,
    });
    runtime.behaviorSelectionOrdinal += 1;
    return runtime.periodRemaining === 0 ? 'PERIOD_END' : 'POSSESSION_CHANGE';
  }
  // Draw SHOT provisionally only to determine the shooting-foul tail.  The later
  // materialization uses the same key and is therefore not a second RNG decision.
  const provisionalShot = buildModelBShotResolution(runtime.session, {
    transitionEventOffset: runtime.prefix + runtime.payloads.length + 1,
    shooterId: shooter.playerId,
    zone,
    shotInstanceIndex: runtime.shotInstanceIndex,
    makeProbabilityMilli,
  });
  const shootingFoul = buildModelBDefensiveFoulResolution(runtime.session, {
    transitionEventOffset: runtime.prefix + runtime.payloads.length,
    defenderId: defender.playerId,
    behaviorSelectionOrdinal: runtime.behaviorSelectionOrdinal,
    occurrenceProbabilityMilli: calculateDefensiveFoulProbabilityMilli({
      context: zone === 'INSIDE' ? 'INSIDE' : 'JUMP_SHOT',
      offensiveContactMilli: effectiveExecution(
        runtime.session,
        runtime.offenseSide,
        shooter,
        zone === 'INSIDE' ? 'INSIDE_CONTACT' : 'PERIMETER_CONTACT',
        zone === 'INSIDE' ? 'CONTACT_FINISH' : 'OPEN_PERIMETER_SHOT',
      ),
      defensiveControlMilli: effectiveExecution(
        runtime.session,
        runtime.defenseSide,
        defender,
        'DEFENSIVE_CONTROL',
        zone === 'INSIDE' ? 'PAINT_DEFENSE' : 'ON_BALL_PERIMETER_DEFENSE',
      ),
      actionMode: runtime.turnoverRiskMilli > 0 ? 'RISKY' : 'SAFE',
    }),
    shootingContext: { zone, made: provisionalShot.made },
  });
  if (shootingFoul.occurred) {
    const foulStart = runtime.payloads.length;
    runtime.payloads.push(...shootingFoul.eventPayloads);
    resultIndexes.push(...shootingFoul.eventPayloads.map((_, index) => foulStart + index));
  } else if (runtime.periodRemaining > 0) {
    const flight = runtime.appendPostReleaseClock(Math.min(1, runtime.periodRemaining));
    if (flight !== null) resultIndexes.push(flight);
  }
  const shotStart = runtime.payloads.length;
  const blockCandidate =
    zone === 'THREE_POINT'
      ? null
      : deriveModelBBlockHelpCandidate({
          currentLineup: current(runtime.session).lineups[sideKey(runtime.defenseSide)],
          candidates: runtime.defense,
          directDefenderId: defender.playerId,
        });
  const shot = buildModelBShotResolution(runtime.session, {
    transitionEventOffset: runtime.prefix + shotStart,
    shooterId: shooter.playerId,
    zone,
    shotInstanceIndex: runtime.shotInstanceIndex,
    makeProbabilityMilli,
    ...(runtime.pendingAssist?.receiverId === shooter.playerId
      ? {
          assistCandidate: {
            playerId: runtime.pendingAssist.passerId,
            attributionProbabilityMilli: calculateAttributionProbabilityMilli(
              'ASSIST',
              effectiveExecution(runtime.session, runtime.offenseSide, handlerBefore, 'CREATION'),
              effectiveExecution(runtime.session, runtime.defenseSide, defender, defenseBlend),
            ),
          },
        }
      : {}),
    ...(blockCandidate === null
      ? {}
      : {
          blockCandidate: {
            playerId: blockCandidate.playerId,
            attributionProbabilityMilli: calculateAttributionProbabilityMilli(
              'BLOCK',
              effectiveExecution(
                runtime.session,
                runtime.defenseSide,
                blockCandidate,
                'BLOCK',
                'PAINT_DEFENSE',
              ),
              effectiveExecution(runtime.session, runtime.offenseSide, shooter, offenseBlend),
            ),
          },
        }),
  });
  runtime.payloads.push(...shot.eventPayloads);
  resultIndexes.push(...shot.eventPayloads.map((_, index) => shotStart + index));
  runtime.shotInstanceIndex += 1;
  if (shootingFoul.freeThrowAttempts > 0) {
    const ftStart = runtime.payloads.length;
    const freeThrows = buildModelBFreeThrowResolution(runtime.session, {
      transitionEventOffset: runtime.prefix + ftStart,
      shooterId: shooter.playerId,
      attempts: shootingFoul.freeThrowAttempts as 1 | 2 | 3,
      shootingMilli: effectiveExecution(
        runtime.session,
        runtime.offenseSide,
        shooter,
        'MID_RANGE_OFFENSE',
      ),
      fatiguePenaltyMilli: 0,
    });
    runtime.payloads.push(...freeThrows.eventPayloads);
    resultIndexes.push(...freeThrows.eventPayloads.map((_, index) => ftStart + index));
    if (!freeThrows.lastAttemptMade && runtime.periodRemaining > 0) {
      const flight = runtime.appendPostReleaseClock(Math.min(1, runtime.periodRemaining));
      if (flight !== null) resultIndexes.push(flight);
      if (runtime.periodRemaining > 0) {
        const reboundStart = runtime.payloads.length;
        const rebound = buildRebound(runtime, shooter, defender, reboundStart);
        runtime.payloads.push(...rebound.eventPayloads);
        resultIndexes.push(reboundStart);
        runtime.addActionTrace({
          behaviorId,
          clockIndex,
          handlerBeforeId: handlerBefore.playerId,
          actorIds: [shooter.playerId],
          targetIds: [defender.playerId],
          durationSeconds: duration,
          startOffsetSeconds: start,
          resultCode:
            rebound.kind === 'OFFENSIVE'
              ? 'SHOOTING_FOUL_FINAL_FT_ORB'
              : 'SHOOTING_FOUL_FINAL_FT_DRB',
          resultIndexes,
          opportunityQualityMilli,
        });
        runtime.behaviorSelectionOrdinal += 1;
        return rebound.kind === 'OFFENSIVE' ? 'OFFENSIVE_REBOUND' : 'POSSESSION_CHANGE';
      }
    }
    runtime.addActionTrace({
      behaviorId,
      clockIndex,
      handlerBeforeId: handlerBefore.playerId,
      actorIds: [shooter.playerId],
      targetIds: [defender.playerId],
      durationSeconds: duration,
      startOffsetSeconds: start,
      resultCode: 'SHOOTING_FOUL_FREE_THROW_SEQUENCE',
      resultIndexes,
      opportunityQualityMilli,
    });
    runtime.behaviorSelectionOrdinal += 1;
    return runtime.periodRemaining === 0 ? 'PERIOD_END' : 'POSSESSION_CHANGE';
  }
  if (shot.made) {
    runtime.addActionTrace({
      behaviorId,
      clockIndex,
      handlerBeforeId: handlerBefore.playerId,
      actorIds: [shooter.playerId],
      targetIds: [defender.playerId],
      durationSeconds: duration,
      startOffsetSeconds: start,
      resultCode: 'MADE_FIELD_GOAL',
      resultIndexes,
      opportunityQualityMilli,
    });
    runtime.behaviorSelectionOrdinal += 1;
    return runtime.periodRemaining === 0 ? 'PERIOD_END' : 'POSSESSION_CHANGE';
  }
  if (runtime.periodRemaining === 0) {
    runtime.addActionTrace({
      behaviorId,
      clockIndex,
      handlerBeforeId: handlerBefore.playerId,
      actorIds: [shooter.playerId],
      targetIds: [defender.playerId],
      durationSeconds: duration,
      startOffsetSeconds: start,
      resultCode: 'BUZZER_MISS_NO_REBOUND',
      resultIndexes,
      opportunityQualityMilli,
    });
    runtime.behaviorSelectionOrdinal += 1;
    return 'PERIOD_END';
  }
  const reboundStart = runtime.payloads.length;
  const rebound = buildRebound(runtime, shooter, defender, reboundStart);
  runtime.payloads.push(...rebound.eventPayloads);
  resultIndexes.push(reboundStart);
  runtime.addActionTrace({
    behaviorId,
    clockIndex,
    handlerBeforeId: handlerBefore.playerId,
    actorIds: [shooter.playerId],
    targetIds: [defender.playerId],
    durationSeconds: duration,
    startOffsetSeconds: start,
    resultCode: rebound.kind === 'OFFENSIVE' ? 'MISSED_FIELD_GOAL_ORB' : 'MISSED_FIELD_GOAL_DRB',
    resultIndexes,
    opportunityQualityMilli,
  });
  runtime.behaviorSelectionOrdinal += 1;
  return rebound.kind === 'OFFENSIVE' ? 'OFFENSIVE_REBOUND' : 'POSSESSION_CHANGE';
}

function buildRebound(
  runtime: SegmentRuntime,
  shooter: MatchPlayerSnapshot,
  defender: MatchPlayerSnapshot,
  transitionEventOffset: number,
) {
  const rebound = buildModelBReboundResolution(runtime.session, {
    transitionEventOffset: runtime.prefix + transitionEventOffset,
    reboundInstanceIndex: runtime.reboundInstanceIndex,
    offensiveReboundProbabilityMilli: calculateOffensiveReboundProbabilityMilli(
      effectiveExecution(
        runtime.session,
        runtime.offenseSide,
        shooter,
        'PERSONAL_REBOUND',
        'CONTESTED_REBOUND',
      ),
      effectiveExecution(
        runtime.session,
        runtime.defenseSide,
        defender,
        'PERSONAL_REBOUND',
        'CONTESTED_REBOUND',
        'DEFENSIVE_REBOUND_EXECUTION',
      ),
    ),
    offensiveCandidates: runtime.offense.map((candidate) => ({
      player: candidate,
      personalReboundExecutionMilli: effectiveExecution(
        runtime.session,
        runtime.offenseSide,
        candidate,
        'PERSONAL_REBOUND',
        'CONTESTED_REBOUND',
      ),
    })),
    defensiveCandidates: runtime.defense.map((candidate) => ({
      player: candidate,
      personalReboundExecutionMilli: effectiveExecution(
        runtime.session,
        runtime.defenseSide,
        candidate,
        'PERSONAL_REBOUND',
        'CONTESTED_REBOUND',
        'DEFENSIVE_REBOUND_EXECUTION',
      ),
    })),
  });
  runtime.reboundInstanceIndex += 1;
  return rebound;
}

function resolveAdvance(
  runtime: SegmentRuntime,
  behaviorId: Extract<ModelBBehaviorId, 'ADV' | 'REORG'>,
  duration: number,
): ModelBSegmentResolution | null {
  const handlerBefore = runtime.handler;
  runtime.appendOrdinaryGap(behaviorId, duration, false);
  const start = runtime.decisionElapsedSeconds;
  const clockIndex = runtime.appendDecisionClock(duration);
  runtime.addActionTrace({
    behaviorId,
    clockIndex,
    handlerBeforeId: handlerBefore.playerId,
    actorIds: [handlerBefore.playerId],
    targetIds: [],
    durationSeconds: duration,
    startOffsetSeconds: start,
    resultCode:
      behaviorId === 'ADV' ? 'ADVANCE_CONTINUES_LIVE_BALL' : 'REORGANIZE_CONTINUES_LIVE_BALL',
    resultIndexes: [],
  });
  runtime.behaviorSelectionOrdinal += 1;
  runtime.forceOffense = false;
  if (runtime.periodRemaining === 0) return 'PERIOD_END';
  return null;
}

function chooseOffensiveBehavior(runtime: SegmentRuntime): ModelBBehaviorId {
  const terminal = (behaviorId: ModelBBehaviorId) => SHOT_BEHAVIORS.has(behaviorId);
  const forced = runtime.forceNextBehavior;
  if (forced !== null) {
    runtime.forceNextBehavior = null;
    if (actionFits(runtime, forced, terminal(forced))) return forced;
  }
  const legal = OFFENSIVE_BEHAVIORS.filter((behaviorId) =>
    actionFits(runtime, behaviorId, terminal(behaviorId)),
  );
  if (legal.length === 0) {
    throw new Error('The phase guard must leave at least one legal Model B offensive action.');
  }
  const controlled = runtime.currentVectorStep();
  if (controlled !== null) {
    if (!legal.includes(controlled.behaviorId)) {
      throw new Error(
        `Model B runner vector selected illegal ${controlled.behaviorId} at ordinal ${runtime.behaviorSelectionOrdinal}.`,
      );
    }
    return controlled.behaviorId;
  }
  return selectModelBBehavior({
    context: drawContext(runtime.session),
    behaviorSelectionOrdinal: runtime.behaviorSelectionOrdinal,
    decisionPlayer: runtime.handler,
    legalBehaviorIds: legal,
    safeFallbackBehaviorId: legal.includes('PASS') ? 'PASS' : legal[0]!,
  }).value.behavior.behaviorId as ModelBBehaviorId;
}

function chooseDefensiveBehavior(runtime: SegmentRuntime): ModelBBehaviorId | null {
  if (runtime.runnerVector !== null) return null;
  const defender = directDefender(runtime, runtime.handler);
  const legal = DEFENSIVE_BEHAVIORS.filter((behaviorId) => actionFits(runtime, behaviorId, false));
  if (legal.length === 0) return null;
  return selectModelBBehavior({
    context: drawContext(runtime.session),
    behaviorSelectionOrdinal: runtime.behaviorSelectionOrdinal,
    decisionPlayer: defender,
    legalBehaviorIds: legal,
    safeFallbackBehaviorId: legal.includes('CONTEST') ? 'CONTEST' : legal[0]!,
    currentLineup: current(runtime.session).lineups[sideKey(runtime.defenseSide)],
    eligibleDefenderIds: runtime.defense.map(({ playerId }) => playerId),
    onBallDefenderId: defender.playerId,
  }).value.behavior.behaviorId as ModelBBehaviorId;
}

function commitRuntime(
  runtime: SegmentRuntime,
  resolution: ModelBSegmentResolution,
): ModelBSession {
  return commitModelBActiveSegment(runtime.session, {
    eventPayloads: runtime.payloads,
    facts: runtime.facts,
    resolution,
  });
}

/** Advances one complete, atomic live-ball segment to a real basketball boundary. */
function runLiveSegment(
  session: ModelBSession,
  runnerVector: ModelBRunnerVector | null = null,
): ModelBSession {
  const runtime = new SegmentRuntime(session, runnerVector);
  if (runtime.periodRemaining < 1) return completeModelBPeriod(session);
  if (runtime.shotRemaining < 1) {
    throw new Error('A segment reaches shot-clock zero only through its committed decision clock.');
  }
  transitionEntry(runtime);
  for (let guard = 0; guard < 128; guard += 1) {
    if (runtime.periodRemaining === 0) return commitRuntime(runtime, 'PERIOD_END');
    if (runtime.shotRemaining === 0) {
      const sourceClock = runtime.payloads
        .map((payload) => payload.type)
        .lastIndexOf('CLOCK_ADVANCED');
      if (sourceClock < 0) throw new Error('A shot-clock violation requires its zeroing clock.');
      const turnoverIndex = runtime.payloads.length;
      runtime.payloads.push({
        type: 'TURNOVER',
        playerId: runtime.handler.playerId,
        turnoverKind: 'UNFORCED_DEAD_BALL',
      });
      runtime.facts.push({
        factKind: 'EXPLANATION',
        sourceEventIndexes: [sourceClock],
        intraTypeOrdinal: 0,
        payload: {
          type: 'SHOT_CLOCK_VIOLATION',
          handlerPlayerId: runtime.handler.playerId,
          ...runtime['coordinate'](),
          turnoverEventId: predictModelBEventId(
            session,
            runtime.prefix + turnoverIndex,
            'TURNOVER',
          ),
        },
      });
      return commitRuntime(runtime, 'POSSESSION_CHANGE');
    }
    if (phaseGuard(runtime)) continue;
    const chooseDefense =
      runtime.phase === 'HALF_COURT_NORMAL' &&
      !runtime.forceOffense &&
      runtime.forceNextBehavior === null;
    if (chooseDefense) {
      const defensive = chooseDefensiveBehavior(runtime) as
        'ONDEF' | 'PRESS' | 'STLTRY' | 'CONTEST' | 'HELPD' | 'DOUBLET' | null;
      if (defensive !== null) {
        const duration = runtime.durationFor(defensive, false);
        if (duration !== null) {
          const resolution = resolveDefense(runtime, defensive, duration);
          if (resolution !== null) return commitRuntime(runtime, resolution);
          continue;
        }
      }
    }
    const offensive = chooseOffensiveBehavior(runtime);
    const duration = runtime.durationFor(offensive, SHOT_BEHAVIORS.has(offensive));
    if (duration === null) {
      // The loop can only reach this branch after an internal forced action has become
      // illegal; re-run the guard rather than consuming an unexecuted result draw.
      runtime.forceNextBehavior = null;
      runtime.phase = 'LATE_CLOCK';
      continue;
    }
    let resolution: ModelBSegmentResolution | null;
    if (offensive === 'ADV' || offensive === 'REORG') {
      resolution = resolveAdvance(runtime, offensive, duration);
    } else if (PASS_BEHAVIORS.has(offensive)) {
      resolution = resolvePass(runtime, offensive as RunnerPassBehavior, duration);
    } else if (CREATION_BEHAVIORS.has(offensive)) {
      resolution = resolveCreation(runtime, offensive as RunnerCreationBehavior, duration);
    } else if (OFF_BALL_BEHAVIORS.has(offensive)) {
      resolution = resolveOffBall(runtime, offensive as RunnerOffBallBehavior, duration);
    } else if (SHOT_BEHAVIORS.has(offensive)) {
      resolution = resolveShot(runtime, offensive as RunnerShotBehavior, duration);
    } else {
      throw new Error(`Model B runner has no causal execution for ${offensive}.`);
    }
    if (resolution !== null) return commitRuntime(runtime, resolution);
    applyTransitionFallback(
      runtime,
      offensive === 'REORG' ? 'REORG_COMPLETED' : 'OFFENSE_COMPLETED',
    );
  }
  throw new Error('Model B active segment exceeded its deterministic action guard.');
}

/**
 * Executes one formal live segment from a deterministic vector.  This exists
 * for runner-object golden tests: selection/raw/outcome inputs are controlled,
 * while event, fact, anchor, transcript, and invariant production remain the
 * same `SegmentRuntime → runLiveSegment → commitModelBActiveSegment` path.
 */
export function runModelBRunnerVector(
  session: ModelBSession,
  runnerVector: ModelBRunnerVector,
): ModelBSession {
  if (runnerVector.offense.length === 0) {
    throw new Error('Model B runner vector requires at least one offensive decision.');
  }
  const anchor = current(session);
  if (anchor.status !== 'IN_PROGRESS' || anchor.periodClockSeconds < 1) {
    throw new Error('Model B runner vector requires an active live segment.');
  }
  return runLiveSegment(session, runnerVector);
}

/** Advances exactly one committed live segment or one automated/period control boundary. */
export function stepToNextControlBoundary(session: ModelBSession): ModelBSession {
  const anchor = current(session);
  if (anchor.status !== 'IN_PROGRESS') return session;
  const automated = resolveAutomatedBoundary(session);
  if (automated !== null) return automated;
  if (anchor.periodClockSeconds === 0) return completeModelBPeriod(session);
  return runLiveSegment(session);
}

export function runToEnd(session: ModelBSession, maximumSteps = 10_000): ModelBSession {
  let next = session;
  for (let steps = 0; current(next).status === 'IN_PROGRESS'; steps += 1) {
    if (steps >= maximumSteps) throw new Error(`Model B runToEnd exceeded ${maximumSteps} steps.`);
    next = stepToNextControlBoundary(next);
  }
  return next;
}

/**
 * Reconstructs the accepted authority object without re-running selectors or
 * keyed RNG. The identity and invariant checks are replay validation, not a
 * second simulation.
 */
export function replayMatch(
  input: ModelBMatchInput,
  authoritativeBundle: ModelBProtocolBundle,
  maximumSteps = 10_000,
): ModelBSession {
  const authority = MatchProtocolBundleSchema.parse(authoritativeBundle);
  if (canonicalizeV2(authority.input) !== canonicalizeV2(input)) {
    throw new Error('Model B replay input must equal the authoritative protocol input.');
  }
  if (!Number.isSafeInteger(maximumSteps) || maximumSteps < 1) {
    throw new Error('Model B replay maximumSteps must be a positive safe integer.');
  }
  const replayed: ModelBSession = Object.freeze({
    input: authority.input as ModelBMatchInput,
    anchors: authority.anchors,
    events: authority.result.events,
    facts: authority.result.facts,
    transcriptEntries: authority.result.transcript.entries,
  });
  assertModelBSessionInvariants(replayed);
  if (canonicalizeV2(finalizeModelBProtocolBundle(replayed)) !== canonicalizeV2(authority)) {
    throw new Error('Model B replay diverges from the authoritative protocol bundle.');
  }
  return replayed;
}

export function finalizeModelBProtocolBundle(session: ModelBSession): ModelBProtocolBundle {
  const finalAnchor = current(session);
  if (finalAnchor.status === 'IN_PROGRESS') {
    throw new Error('A Model B protocol bundle requires a completed session.');
  }
  const result = {
    matchId: session.input.matchId,
    matchInputHash: session.input.matchInputHash,
    matchKind: session.input.matchKind,
    recordScope: session.input.recordScope,
    finalAnchor,
    events: [...session.events],
    facts: [...session.facts],
    transcript: buildModelBTranscript(session),
    eventDigest: deriveEventDigest(session.input.matchId, session.events),
    terminationReason:
      finalAnchor.status === 'COMPLETED'
        ? ('COMPLETED' as const)
        : ('FORFEIT_INSUFFICIENT_PLAYERS' as const),
    matchResultId: finalAnchor.anchorHash,
  };
  result.matchResultId = deriveMatchResultId(result);
  return MatchProtocolBundleSchema.parse({
    input: session.input,
    anchors: [...session.anchors],
    result: MatchResultDraftSchema.parse(result),
  });
}
