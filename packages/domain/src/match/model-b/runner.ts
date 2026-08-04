import { canonicalizeV2, compareUtf16CodeUnits } from '../../core/canonical-v2.js';
import { keyedDrawInt } from '../keyed-rng.js';
import {
  MatchProtocolBundleSchema,
  MatchResultDraftSchema,
  deriveEventDigest,
  deriveMatchResultId,
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
  buildModelBHelpDefenseResolution,
  buildModelBPassResolution,
  buildModelBReboundResolution,
  buildModelBShotResolution,
  buildModelBTurnoverResolution,
} from './basketball-results.js';
import {
  completeModelBPeriod,
  commitModelBActiveSegment,
  commitModelBRuleTransition,
  rebuildModelBShotClockSeconds,
} from './clock-rules.js';
import {
  calculateAbilityBlendMilli,
  modelBAbilityValues,
  type MatchPlayerSnapshot,
} from './effective-values.js';
import {
  calculateAttributionProbabilityMilli,
  calculateBehaviorExecutionProbabilityMilli,
  calculateCreationProbabilityMilli,
  calculateDefensiveFoulProbabilityMilli,
  calculateOffensiveReboundProbabilityMilli,
  calculateShotProbabilityMilli,
  calculateTurnoverProbabilityMilli,
} from './probabilities.js';
import {
  MODEL_B_BEHAVIOR_REGISTRY,
  MODEL_B_PARAMETER_REGISTRY,
  type ModelBBehaviorId,
} from './registries.js';
import {
  buildModelBTranscript,
  commitModelBAutomatedDecision,
  createModelBSession,
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

export const MODEL_B_RUNNER_SELECTABLE_BEHAVIOR_IDS = Object.freeze(
  MODEL_B_BEHAVIOR_REGISTRY.filter(({ selectable }) => selectable).map(
    ({ behaviorId }) => behaviorId as ModelBBehaviorId,
  ),
);
const RUNNER_OFFENSIVE_BEHAVIORS = Object.freeze(
  MODEL_B_RUNNER_SELECTABLE_BEHAVIOR_IDS.filter(
    (behaviorId) =>
      MODEL_B_BEHAVIOR_REGISTRY.find((entry) => entry.behaviorId === behaviorId)!.family !==
      'DEFENSE',
  ),
);
const RUNNER_DEFENSIVE_BEHAVIORS = Object.freeze(
  MODEL_B_RUNNER_SELECTABLE_BEHAVIOR_IDS.filter(
    (behaviorId) =>
      MODEL_B_BEHAVIOR_REGISTRY.find((entry) => entry.behaviorId === behaviorId)!.family ===
      'DEFENSE',
  ),
);
const PASS_BEHAVIORS = new Set<ModelBBehaviorId>([
  'PASS',
  'HPASS',
  'CREATIVE_PASS',
  'ASTOPP',
  'HELDKICK',
]);
const SHOT_ZONE_BY_BEHAVIOR: Readonly<
  Record<RunnerShotBehavior, 'INSIDE' | 'MID_RANGE' | 'THREE_POINT'>
> = {
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
const SHOT_BEHAVIORS = new Set<ModelBBehaviorId>(
  Object.keys(SHOT_ZONE_BY_BEHAVIOR) as RunnerShotBehavior[],
);
const CREATION_BEHAVIORS = new Set<ModelBBehaviorId>([
  'DRIVE',
  'SHAKE',
  'ISO',
  'STEP_BACK',
  'POSTUP',
  'HIGH_POST_CREATION',
]);
const OFF_BALL_BEHAVIORS = new Set<ModelBBehaviorId>(['SCREEN', 'CUT', 'DOUBLECREATE']);
const CREATION_SAFE_EXIT: Readonly<Record<RunnerCreationBehavior, ModelBBehaviorId>> = {
  DRIVE: 'LAYUP',
  SHAKE: 'SPOTUP',
  ISO: 'PULLUP',
  STEP_BACK: 'MID',
  POSTUP: 'HOOK',
  HIGH_POST_CREATION: 'HPASS',
};

function current(session: ModelBSession) {
  return session.anchors.at(-1)!;
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

function teamPlayers(session: ModelBSession, side: MatchSide): readonly MatchPlayerSnapshot[] {
  return side === 'HOME' ? session.input.homeTeam.players : session.input.awayTeam.players;
}

function eligiblePlayers(session: ModelBSession, side: MatchSide): readonly MatchPlayerSnapshot[] {
  const ids = new Set(
    eligibleModelBLineupPlayerIds(current(session), side, session.input.rules.foulOutLimit),
  );
  return teamPlayers(session, side).filter(({ playerId }) => ids.has(playerId));
}

function player(session: ModelBSession, side: MatchSide, playerId: string): MatchPlayerSnapshot {
  const found = teamPlayers(session, side).find((candidate) => candidate.playerId === playerId);
  if (found === undefined)
    throw new Error(`Model B runner cannot resolve ${playerId} for ${side}.`);
  return found;
}

/** Every live behavior consumes its frozen SEGMENT_DURATION draw. */
function behaviorSeconds(behaviorId: ModelBBehaviorId, session: ModelBSession): number {
  const behavior = MODEL_B_BEHAVIOR_REGISTRY.find((entry) => entry.behaviorId === behaviorId);
  if (behavior === undefined) throw new Error(`Unknown runner behavior ${behaviorId}.`);
  const available = Math.min(
    current(session).periodClockSeconds,
    rebuildModelBShotClockSeconds(current(session), session.events),
  );
  if (available < 1) throw new Error('A Model B behavior requires positive available clock time.');
  return keyedDrawInt(
    { ...drawContext(session), drawKind: 'SEGMENT_DURATION', localIndex: 0 },
    1,
    Math.min(behavior.maximumSeconds, available),
  );
}

function selectedShooter(
  session: ModelBSession,
  candidates: readonly MatchPlayerSnapshot[],
  shooterOrdinal: number,
): MatchPlayerSnapshot {
  const ordered = [...candidates].sort((left, right) =>
    compareUtf16CodeUnits(left.playerId, right.playerId),
  );
  if (ordered.length === 0) throw new Error('A field-goal behavior requires an eligible shooter.');
  return ordered[
    keyedDrawInt(
      { ...drawContext(session), drawKind: 'SHOOTER', localIndex: shooterOrdinal },
      0,
      ordered.length - 1,
    )
  ]!;
}

function drawOccurs(
  session: ModelBSession,
  drawKind: 'BEHAVIOR' | 'DEFENSIVE_ACTION',
  localIndex: number,
  probabilityMilli: number,
): boolean {
  return keyedDrawInt({ ...drawContext(session), drawKind, localIndex }, 0, 999) < probabilityMilli;
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

function handlerFact(session: ModelBSession, handlerPlayerId: string): ModelBFactDraft {
  const anchor = current(session);
  return {
    factKind: 'STATISTICAL',
    sourceEventIndexes: [0],
    payload: {
      type: 'POSSESSION_HANDLER',
      handlerPlayerId,
      period: anchor.period,
      possessionIndex: anchor.possession.possessionIndex,
      segmentIndex: anchor.possession.segmentIndex,
    },
  };
}

function resolutionForClock(
  session: ModelBSession,
  seconds: number,
  otherwise: 'SAME_SIDE_DEAD_BALL' | 'OFFENSIVE_REBOUND' | 'POSSESSION_CHANGE',
) {
  return seconds === current(session).periodClockSeconds ? 'PERIOD_END' : otherwise;
}

function creationFact(
  session: ModelBSession,
  behaviorId: Extract<
    ModelBBehaviorId,
    | 'DRIVE'
    | 'SHAKE'
    | 'ISO'
    | 'STEP_BACK'
    | 'POSTUP'
    | 'HIGH_POST_CREATION'
    | 'SCREEN'
    | 'CUT'
    | 'DOUBLECREATE'
    | 'CREATIVE_PASS'
    | 'HELDKICK'
  >,
  creatorId: string,
  beneficiaryId: string,
  nextBehaviorId: ModelBBehaviorId | null,
  success: boolean,
  defensiveResponse: 'NONE' | 'CONTESTED' | 'DOUBLE_TEAM' | 'COLLAPSED',
): ModelBFactDraft {
  const anchor = current(session);
  return buildModelBCreationFactDraft({
    sourceEventIndexes: [0],
    creatorId,
    beneficiaryId,
    behaviorId,
    opportunityQualityDelta: success ? 6_000 : -6_000,
    defensiveResponse,
    period: anchor.period,
    possessionIndex: anchor.possession.possessionIndex,
    segmentIndex: anchor.possession.segmentIndex,
    nextBehaviorId,
  });
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

/** Regenerates B6 policy/rule decisions rather than treating an empty transcript as authority. */
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
  if (
    initialRuleBoundary &&
    rulePlan !== null &&
    !session.transcriptEntries.some(({ actor }) => actor === 'RULES')
  ) {
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
      if (
        initialAssistantBoundary &&
        !session.transcriptEntries.some(({ actor }) => actor === 'ASSISTANT')
      ) {
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

function shotBlend(zone: 'INSIDE' | 'MID_RANGE' | 'THREE_POINT') {
  return zone === 'INSIDE'
    ? (['INSIDE_OFFENSE', 'INSIDE_SHOT_PROTECTION'] as const)
    : zone === 'MID_RANGE'
      ? (['MID_RANGE_OFFENSE', 'MID_RANGE_DEFENSE'] as const)
      : (['THREE_POINT_OFFENSE', 'THREE_POINT_DEFENSE'] as const);
}

function commitShot(
  session: ModelBSession,
  input: Readonly<{
    seconds: number;
    shooter: MatchPlayerSnapshot;
    defender: MatchPlayerSnapshot;
    defenseLineup: ModelBSession['anchors'][number]['lineups']['home'];
    offense: readonly MatchPlayerSnapshot[];
    defense: readonly MatchPlayerSnapshot[];
    zone: 'INSIDE' | 'MID_RANGE' | 'THREE_POINT';
    facts: readonly ModelBFactDraft[];
    assistCandidate?: Readonly<{ playerId: string; attributionProbabilityMilli: number }>;
  }>,
): ModelBSession {
  const prefix = pendingPossessionStartCount(session);
  const [offenseBlend, defenseBlend] = shotBlend(input.zone);
  const blockCandidate =
    input.zone === 'THREE_POINT'
      ? null
      : deriveModelBBlockHelpCandidate({
          currentLineup: input.defenseLineup,
          candidates: input.defense,
          directDefenderId: input.defender.playerId,
        });
  const shot = buildModelBShotResolution(session, {
    transitionEventOffset: prefix + 1,
    shooterId: input.shooter.playerId,
    zone: input.zone,
    shotInstanceIndex: 0,
    makeProbabilityMilli: calculateShotProbabilityMilli({
      zone: input.zone,
      offensiveExecutionMilli: calculateAbilityBlendMilli(input.shooter, offenseBlend),
      defensiveExecutionMilli: calculateAbilityBlendMilli(input.defender, defenseBlend),
      opportunityQualityMilli: 50_000,
    }),
    ...(blockCandidate === null
      ? {}
      : {
          blockCandidate: {
            playerId: blockCandidate.playerId,
            attributionProbabilityMilli: calculateAttributionProbabilityMilli(
              'BLOCK',
              calculateAbilityBlendMilli(blockCandidate, 'BLOCK'),
              calculateAbilityBlendMilli(input.shooter, offenseBlend),
            ),
          },
        }),
    ...(input.assistCandidate === undefined ? {} : { assistCandidate: input.assistCandidate }),
  });
  const payloads = [
    { type: 'CLOCK_ADVANCED' as const, seconds: input.seconds },
    ...shot.eventPayloads,
  ];
  const foul = buildModelBDefensiveFoulResolution(session, {
    transitionEventOffset: prefix + payloads.length,
    defenderId: input.defender.playerId,
    behaviorSelectionOrdinal: 1,
    occurrenceProbabilityMilli: calculateDefensiveFoulProbabilityMilli({
      context: input.zone === 'INSIDE' ? 'INSIDE' : 'JUMP_SHOT',
      offensiveContactMilli: calculateAbilityBlendMilli(
        input.shooter,
        input.zone === 'INSIDE' ? 'INSIDE_CONTACT' : 'PERIMETER_CONTACT',
      ),
      defensiveControlMilli: calculateAbilityBlendMilli(input.defender, 'DEFENSIVE_CONTROL'),
      actionMode: 'SAFE',
    }),
    shootingContext: { zone: input.zone, made: shot.made },
  });
  payloads.push(...foul.eventPayloads);
  if (foul.freeThrowAttempts > 0) {
    payloads.push(
      ...buildModelBFreeThrowResolution(session, {
        transitionEventOffset: prefix + payloads.length,
        shooterId: input.shooter.playerId,
        attempts: foul.freeThrowAttempts as 1 | 2 | 3,
        shootingMilli: modelBAbilityValues(input.shooter).shooting * 1_000,
        fatiguePenaltyMilli: 0,
      }).eventPayloads,
    );
  }
  if (shot.made || foul.freeThrowAttempts > 0) {
    return commitModelBActiveSegment(session, {
      eventPayloads: payloads,
      facts: input.facts,
      resolution: resolutionForClock(session, input.seconds, 'POSSESSION_CHANGE'),
    });
  }
  const rebound = buildModelBReboundResolution(session, {
    transitionEventOffset: prefix + payloads.length,
    reboundInstanceIndex: 0,
    offensiveReboundProbabilityMilli: calculateOffensiveReboundProbabilityMilli(
      calculateAbilityBlendMilli(input.shooter, 'PERSONAL_REBOUND'),
      calculateAbilityBlendMilli(input.defender, 'PERSONAL_REBOUND'),
    ),
    offensiveCandidates: input.offense.map((candidate) => ({
      player: candidate,
      personalReboundExecutionMilli: calculateAbilityBlendMilli(candidate, 'PERSONAL_REBOUND'),
    })),
    defensiveCandidates: input.defense.map((candidate) => ({
      player: candidate,
      personalReboundExecutionMilli: calculateAbilityBlendMilli(candidate, 'PERSONAL_REBOUND'),
    })),
  });
  return commitModelBActiveSegment(session, {
    eventPayloads: [...payloads, ...rebound.eventPayloads],
    facts: input.facts,
    resolution: resolutionForClock(
      session,
      input.seconds,
      rebound.kind === 'OFFENSIVE' ? 'OFFENSIVE_REBOUND' : 'POSSESSION_CHANGE',
    ),
  });
}

function commitPass(
  session: ModelBSession,
  input: Readonly<{
    behaviorId: Extract<
      ModelBBehaviorId,
      'PASS' | 'HPASS' | 'CREATIVE_PASS' | 'ASTOPP' | 'HELDKICK'
    >;
    seconds: number;
    handler: MatchPlayerSnapshot;
    defender: MatchPlayerSnapshot;
    defenseLineup: ModelBSession['anchors'][number]['lineups']['home'];
    offense: readonly MatchPlayerSnapshot[];
    defense: readonly MatchPlayerSnapshot[];
    extraFacts: readonly ModelBFactDraft[];
  }>,
): ModelBSession {
  const receiver = selectModelBReceiverOrBeneficiary({
    context: drawContext(session),
    behaviorId: input.behaviorId,
    behaviorSelectionOrdinal: 1,
    candidates: input.offense,
    excludedPlayerIds: [input.handler.playerId],
  });
  if (receiver === null) throw new Error(`${input.behaviorId} requires an eligible receiver.`);
  const prefix = pendingPossessionStartCount(session);
  const turnoverProbabilityMilli = calculateTurnoverProbabilityMilli({
    defensivePressureMilli: calculateAbilityBlendMilli(input.defender, 'DEFENSIVE_PRESSURE'),
    ballSecurityMilli: calculateAbilityBlendMilli(input.handler, 'BALL_SECURITY'),
    actionPressureMilli: input.behaviorId === 'CREATIVE_PASS' ? 4_000 : -3_000,
    pace: current(session).effectiveFragment.tactics[sideKey(current(session).possession.side)]
      .pace,
    teamExecutionModifierMilli: 0,
    ...(input.behaviorId === 'CREATIVE_PASS' ? { additionalRiskMilli: 50 } : {}),
  });
  const pass = buildModelBPassResolution(session, {
    transitionEventOffset: prefix,
    seconds: input.seconds,
    behaviorId: input.behaviorId,
    behaviorSelectionOrdinal: 1,
    passSequence: current(session).possession.segmentIndex,
    passerId: input.handler.playerId,
    receiverId: receiver.value.playerId,
    turnoverProbabilityMilli,
    pressuredClassificationProbabilityMilli: 500,
    stealAttributionProbabilityMilli: calculateAttributionProbabilityMilli(
      'STEAL',
      calculateAbilityBlendMilli(input.defender, 'STEAL'),
      calculateAbilityBlendMilli(input.handler, 'BALL_PROTECTION'),
    ),
  });
  const facts = [
    ...input.extraFacts,
    ...pass.facts.map((fact) => ({
      ...fact,
      sourceEventIndexes: fact.sourceEventIndexes.map((index) => index - prefix),
    })),
  ];
  if (pass.turnoverOccurred) {
    return commitModelBActiveSegment(session, {
      eventPayloads: pass.eventPayloads,
      facts,
      resolution: resolutionForClock(session, input.seconds, 'POSSESSION_CHANGE'),
    });
  }
  if (
    input.seconds + 1 > current(session).periodClockSeconds ||
    input.seconds + 1 > rebuildModelBShotClockSeconds(current(session), session.events)
  ) {
    return commitModelBActiveSegment(session, {
      eventPayloads: pass.eventPayloads,
      facts,
      resolution: resolutionForClock(session, input.seconds, 'SAME_SIDE_DEAD_BALL'),
    });
  }
  // The receiver is still selected through SHOOTER; a singleton candidate consumes the frozen draw.
  const shooter = selectedShooter(session, [receiver.value], 0);
  const zone: 'MID_RANGE' | 'THREE_POINT' =
    input.behaviorId === 'HELDKICK' ? 'THREE_POINT' : 'MID_RANGE';
  const shot = buildModelBShotResolution(session, {
    transitionEventOffset: prefix + pass.eventPayloads.length + 1,
    shooterId: shooter.playerId,
    zone,
    shotInstanceIndex: 1,
    makeProbabilityMilli: calculateShotProbabilityMilli({
      zone,
      offensiveExecutionMilli: calculateAbilityBlendMilli(
        shooter,
        zone === 'THREE_POINT' ? 'THREE_POINT_OFFENSE' : 'MID_RANGE_OFFENSE',
      ),
      defensiveExecutionMilli: calculateAbilityBlendMilli(
        input.defender,
        zone === 'THREE_POINT' ? 'THREE_POINT_DEFENSE' : 'MID_RANGE_DEFENSE',
      ),
      opportunityQualityMilli: 50_000,
    }),
    assistCandidate: {
      playerId: input.handler.playerId,
      attributionProbabilityMilli: calculateAttributionProbabilityMilli(
        'ASSIST',
        calculateAbilityBlendMilli(input.handler, 'CREATION'),
        calculateAbilityBlendMilli(input.defender, 'MID_RANGE_DEFENSE'),
      ),
    },
  });
  const payloads = [
    ...pass.eventPayloads,
    { type: 'CLOCK_ADVANCED' as const, seconds: 1 },
    ...shot.eventPayloads,
  ];
  if (shot.made)
    return commitModelBActiveSegment(session, {
      eventPayloads: payloads,
      facts,
      resolution: resolutionForClock(session, input.seconds + 1, 'POSSESSION_CHANGE'),
    });
  const rebound = buildModelBReboundResolution(session, {
    transitionEventOffset: prefix + payloads.length,
    reboundInstanceIndex: 0,
    offensiveReboundProbabilityMilli: calculateOffensiveReboundProbabilityMilli(
      calculateAbilityBlendMilli(shooter, 'PERSONAL_REBOUND'),
      calculateAbilityBlendMilli(input.defender, 'PERSONAL_REBOUND'),
    ),
    offensiveCandidates: input.offense.map((candidate) => ({
      player: candidate,
      personalReboundExecutionMilli: calculateAbilityBlendMilli(candidate, 'PERSONAL_REBOUND'),
    })),
    defensiveCandidates: input.defense.map((candidate) => ({
      player: candidate,
      personalReboundExecutionMilli: calculateAbilityBlendMilli(candidate, 'PERSONAL_REBOUND'),
    })),
  });
  return commitModelBActiveSegment(session, {
    eventPayloads: [...payloads, ...rebound.eventPayloads],
    facts,
    resolution: resolutionForClock(
      session,
      input.seconds + 1,
      rebound.kind === 'OFFENSIVE' ? 'OFFENSIVE_REBOUND' : 'POSSESSION_CHANGE',
    ),
  });
}

/** Advances exactly one committed live segment or an automated/period control boundary. */
export function stepToNextControlBoundary(session: ModelBSession): ModelBSession {
  const anchor = current(session);
  if (anchor.status !== 'IN_PROGRESS') return session;
  const automated = resolveAutomatedBoundary(session);
  if (automated !== null) return automated;
  if (anchor.periodClockSeconds === 0) return completeModelBPeriod(session);
  const shotClock = rebuildModelBShotClockSeconds(anchor, session.events);
  if (shotClock < 1)
    throw new Error('An in-progress Model B segment requires a positive shot clock.');

  const offenseSide = anchor.possession.side;
  const defenseSide = oppositeSide(offenseSide);
  const offense = eligiblePlayers(session, offenseSide);
  const defense = eligiblePlayers(session, defenseSide);
  const handler = selectModelBHandler({
    context: drawContext(session),
    handlerInstanceIndex: 0,
    candidates: offense,
  }).value;
  const defenseLineup = anchor.lineups[sideKey(defenseSide)];
  const onBallDefenderId = resolveModelBDirectOpponent({
    actorPlayerId: handler.playerId,
    actorLineup: anchor.lineups[sideKey(offenseSide)],
    opponentLineup: defenseLineup,
    eligibleOpponentIds: defense.map(({ playerId }) => playerId),
  });
  if (onBallDefenderId === null)
    throw new Error('An active possession requires an eligible defender.');
  const defender = player(session, defenseSide, onBallDefenderId);

  const defensiveBehavior = selectModelBBehavior({
    context: drawContext(session),
    behaviorSelectionOrdinal: 0,
    decisionPlayer: defender,
    legalBehaviorIds: RUNNER_DEFENSIVE_BEHAVIORS,
    safeFallbackBehaviorId: 'CONTEST',
    currentLineup: defenseLineup,
    eligibleDefenderIds: defense.map(({ playerId }) => playerId),
    onBallDefenderId,
  }).value.behavior.behaviorId;
  if (defensiveBehavior === 'HELPD') {
    const helper = selectModelBHelpDefender({
      context: drawContext(session),
      behaviorSelectionOrdinal: 0,
      currentLineup: defenseLineup,
      candidates: defense,
      onBallDefenderId,
    });
    if (helper !== null) {
      const result = buildModelBHelpDefenseResolution(session, {
        transitionEventOffset: 0,
        seconds: behaviorSeconds('HELPD', session),
        behaviorSelectionOrdinal: 0,
        successProbabilityMilli: calculateBehaviorExecutionProbabilityMilli(
          'HELPD',
          calculateAbilityBlendMilli(helper.value, 'HELP_DEFENSE'),
          calculateAbilityBlendMilli(handler, 'CREATION'),
        ),
        offenseSide,
        defenseSide,
        handlerId: handler.playerId,
        onBallDefenderId,
        helperId: helper.value.playerId,
      });
      return commitModelBActiveSegment(session, {
        eventPayloads: result.eventPayloads,
        facts: result.facts,
        resolution: resolutionForClock(
          session,
          behaviorSeconds('HELPD', session),
          'SAME_SIDE_DEAD_BALL',
        ),
      });
    }
  }
  if (defensiveBehavior === 'PRESS' || defensiveBehavior === 'DOUBLET') {
    const seconds = behaviorSeconds(defensiveBehavior, session);
    const supporting =
      defensiveBehavior === 'DOUBLET'
        ? (selectModelBDoubleTeamActors(
            defense.filter(({ playerId }) => playerId !== onBallDefenderId),
          )?.map(({ playerId }) => playerId) ?? [])
        : [];
    const success = drawOccurs(
      session,
      'DEFENSIVE_ACTION',
      modelBDefenseExecutionLocalIndex(0),
      calculateBehaviorExecutionProbabilityMilli(
        defensiveBehavior,
        calculateAbilityBlendMilli(
          defender,
          defensiveBehavior === 'PRESS' ? 'PRESS' : 'DOUBLE_TEAM',
        ),
        calculateAbilityBlendMilli(handler, 'BALL_SECURITY'),
      ),
    );
    return commitModelBActiveSegment(session, {
      eventPayloads: [{ type: 'CLOCK_ADVANCED', seconds }],
      facts: [
        buildModelBDefensiveActionFactDraft({
          sourceEventIndexes: [0],
          behaviorId: defensiveBehavior,
          offenseSide,
          defenseSide,
          handlerId: handler.playerId,
          primaryDefenderId: onBallDefenderId,
          supportingDefenderIds: supporting,
          result: success ? 'SUCCESS' : 'FAILED_BREAKDOWN',
          opportunityQualityDelta: success ? -6_000 : 6_000,
          breakdownOpportunity: !success,
          period: anchor.period,
          possessionIndex: anchor.possession.possessionIndex,
          segmentIndex: anchor.possession.segmentIndex,
        }),
      ],
      resolution: resolutionForClock(session, seconds, 'SAME_SIDE_DEAD_BALL'),
    });
  }
  if (defensiveBehavior === 'STLTRY') {
    const seconds = behaviorSeconds('STLTRY', session);
    const turnover = buildModelBTurnoverResolution(session, {
      transitionEventOffset: pendingPossessionStartCount(session) + 1,
      handlerPlayerId: handler.playerId,
      behaviorSelectionOrdinal: 0,
      occurrenceProbabilityMilli: calculateTurnoverProbabilityMilli({
        defensivePressureMilli: calculateAbilityBlendMilli(defender, 'DEFENSIVE_PRESSURE'),
        ballSecurityMilli: calculateAbilityBlendMilli(handler, 'BALL_SECURITY'),
        actionPressureMilli: 4_000,
        pace: anchor.effectiveFragment.tactics[sideKey(offenseSide)].pace,
        teamExecutionModifierMilli: 0,
      }),
      pressuredClassificationProbabilityMilli: 1_000,
      stealCandidate: {
        playerId: defender.playerId,
        attributionProbabilityMilli: calculateAttributionProbabilityMilli(
          'STEAL',
          calculateAbilityBlendMilli(defender, 'STEAL'),
          calculateAbilityBlendMilli(handler, 'BALL_PROTECTION'),
        ),
      },
    });
    return commitModelBActiveSegment(session, {
      eventPayloads: [{ type: 'CLOCK_ADVANCED', seconds }, ...turnover.eventPayloads],
      facts: [handlerFact(session, handler.playerId)],
      resolution: resolutionForClock(
        session,
        seconds,
        turnover.occurred ? 'POSSESSION_CHANGE' : 'SAME_SIDE_DEAD_BALL',
      ),
    });
  }

  const selection = selectModelBBehavior({
    context: drawContext(session),
    behaviorSelectionOrdinal: 1,
    decisionPlayer: handler,
    legalBehaviorIds: RUNNER_OFFENSIVE_BEHAVIORS,
    safeFallbackBehaviorId: 'PASS',
  }).value.behavior.behaviorId as ModelBBehaviorId;
  const seconds = behaviorSeconds(selection, session);
  if (selection === 'ADV' || selection === 'REORG') {
    return commitModelBActiveSegment(session, {
      eventPayloads: [{ type: 'CLOCK_ADVANCED', seconds }],
      facts: [handlerFact(session, handler.playerId)],
      resolution: seconds === anchor.periodClockSeconds ? 'PERIOD_END' : 'SAME_SIDE_DEAD_BALL',
    });
  }
  if (PASS_BEHAVIORS.has(selection)) {
    const extraFacts =
      selection === 'CREATIVE_PASS' || selection === 'HELDKICK'
        ? [
            creationFact(
              session,
              selection,
              handler.playerId,
              handler.playerId,
              null,
              true,
              defensiveBehavior === 'DOUBLET' ? 'DOUBLE_TEAM' : 'CONTESTED',
            ),
          ]
        : [];
    return commitPass(session, {
      behaviorId: selection as Extract<
        ModelBBehaviorId,
        'PASS' | 'HPASS' | 'CREATIVE_PASS' | 'ASTOPP' | 'HELDKICK'
      >,
      seconds,
      handler,
      defender,
      defenseLineup,
      offense,
      defense,
      extraFacts,
    });
  }
  if (CREATION_BEHAVIORS.has(selection) || OFF_BALL_BEHAVIORS.has(selection)) {
    const behavior = selection as RunnerCreationBehavior | RunnerOffBallBehavior;
    const actor = OFF_BALL_BEHAVIORS.has(behavior)
      ? (selectModelBActor({
          context: drawContext(session),
          behaviorId: behavior,
          behaviorSelectionOrdinal: 1,
          candidates: offense,
          excludedPlayerIds: [handler.playerId],
        })?.value ?? handler)
      : handler;
    const success = CREATION_BEHAVIORS.has(behavior)
      ? drawOccurs(
          session,
          'BEHAVIOR',
          modelBCreationExecutionLocalIndex(1),
          calculateCreationProbabilityMilli(
            behavior as RunnerCreationBehavior,
            calculateAbilityBlendMilli(actor, 'CREATION'),
            calculateAbilityBlendMilli(defender, 'DEFENSIVE_CONTROL'),
          ),
        )
      : drawOccurs(
          session,
          'BEHAVIOR',
          modelBOffBallExecutionLocalIndex(1),
          calculateBehaviorExecutionProbabilityMilli(
            behavior as RunnerOffBallBehavior,
            calculateAbilityBlendMilli(
              actor,
              behavior === 'SCREEN' ? 'SCREEN' : behavior === 'CUT' ? 'CUT' : 'DOUBLE_CREATE',
            ),
            calculateAbilityBlendMilli(defender, 'DEFENSIVE_CONTROL'),
          ),
        );
    const exit = CREATION_BEHAVIORS.has(behavior)
      ? selectModelBCreationExit({
          context: drawContext(session),
          behaviorSelectionOrdinal: 2,
          decisionPlayer: actor,
          safeFallbackBehaviorId: CREATION_SAFE_EXIT[behavior as RunnerCreationBehavior],
          creationBehaviorId: behavior as RunnerCreationBehavior,
        })
      : null;
    const nextBehavior =
      (exit?.value.behavior.behaviorId as ModelBBehaviorId | undefined) ??
      (behavior === 'CUT' ? 'LAYUP' : 'SPOTUP');
    const beneficiary = selectedShooter(session, offense, 0);
    const facts = [
      creationFact(
        session,
        behavior,
        actor.playerId,
        beneficiary.playerId,
        nextBehavior,
        success,
        defensiveBehavior === 'DOUBLET'
          ? 'DOUBLE_TEAM'
          : defensiveBehavior === 'HELPD'
            ? 'COLLAPSED'
            : 'CONTESTED',
      ),
    ];
    if (!success)
      return commitModelBActiveSegment(session, {
        eventPayloads: [{ type: 'CLOCK_ADVANCED', seconds }],
        facts,
        resolution: seconds === anchor.periodClockSeconds ? 'PERIOD_END' : 'SAME_SIDE_DEAD_BALL',
      });
    if (PASS_BEHAVIORS.has(nextBehavior))
      return commitPass(session, {
        behaviorId: nextBehavior as Extract<
          ModelBBehaviorId,
          'PASS' | 'HPASS' | 'CREATIVE_PASS' | 'ASTOPP' | 'HELDKICK'
        >,
        seconds,
        handler: actor,
        defender,
        defenseLineup,
        offense,
        defense,
        extraFacts: facts,
      });
    return commitShot(session, {
      seconds,
      shooter: beneficiary,
      defender,
      defenseLineup,
      offense,
      defense,
      zone: SHOT_ZONE_BY_BEHAVIOR[nextBehavior as RunnerShotBehavior] ?? 'MID_RANGE',
      facts,
    });
  }
  if (!SHOT_BEHAVIORS.has(selection))
    throw new Error(`Runner has no terminal semantics for ${selection}.`);
  const shooter = selectedShooter(session, offense, 0);
  return commitShot(session, {
    seconds,
    shooter,
    defender,
    defenseLineup,
    offense,
    defense,
    zone: SHOT_ZONE_BY_BEHAVIOR[selection as RunnerShotBehavior],
    facts: [handlerFact(session, handler.playerId)],
  });
}

export function runToEnd(session: ModelBSession, maximumSteps = 10_000): ModelBSession {
  let next = session;
  for (let steps = 0; current(next).status === 'IN_PROGRESS'; steps += 1) {
    if (steps >= maximumSteps) throw new Error(`Model B runToEnd exceeded ${maximumSteps} steps.`);
    next = stepToNextControlBoundary(next);
  }
  return next;
}

/** Re-executes production policies and rejects any divergence from the authority bundle. */
export function replayMatch(
  input: ModelBMatchInput,
  authoritativeBundle: ModelBProtocolBundle,
  maximumSteps = 10_000,
): ModelBSession {
  const authority = MatchProtocolBundleSchema.parse(authoritativeBundle);
  if (canonicalizeV2(authority.input) !== canonicalizeV2(input))
    throw new Error('Model B replay input must equal the authoritative protocol input.');
  const replayed = runToEnd(createModelBSession(input), maximumSteps);
  if (canonicalizeV2(finalizeModelBProtocolBundle(replayed)) !== canonicalizeV2(authority))
    throw new Error('Model B replay diverges from the authoritative protocol bundle.');
  return replayed;
}

export function finalizeModelBProtocolBundle(session: ModelBSession): ModelBProtocolBundle {
  const finalAnchor = current(session);
  if (finalAnchor.status === 'IN_PROGRESS')
    throw new Error('A Model B protocol bundle requires a completed session.');
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
