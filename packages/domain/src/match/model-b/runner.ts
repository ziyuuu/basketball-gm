import { canonicalizeV2 } from '../../core/canonical-v2.js';
import {
  MatchProtocolBundleSchema,
  MatchResultDraftSchema,
  deriveEventDigest,
  deriveMatchResultId,
} from '../schemas.js';
import {
  deriveModelBBlockHelpCandidate,
  resolveModelBDirectOpponent,
  selectModelBBehavior,
  selectModelBHandler,
  selectModelBHelpDefender,
  selectModelBReceiverOrBeneficiary,
  type ModelBDrawContext,
} from './behavior-selection.js';
import {
  buildModelBCreationFactDraft,
  buildModelBDefensiveFoulResolution,
  buildModelBFreeThrowResolution,
  buildModelBHelpDefenseResolution,
  buildModelBPassResolution,
  buildModelBReboundResolution,
  buildModelBShotResolution,
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
import { MODEL_B_BEHAVIOR_REGISTRY, type ModelBBehaviorId } from './registries.js';
import {
  buildModelBTranscript,
  createModelBSession,
  type ModelBFactDraft,
  type ModelBMatchInput,
  type ModelBSession,
} from './session.js';
import { buildModelBFoulOutBoundaryPlan, eligibleModelBLineupPlayerIds } from './state-rules.js';

/** The frozen P02-002 protocol envelope; Model B adds no parallel bundle shape. */
export type ModelBProtocolBundle = ReturnType<typeof MatchProtocolBundleSchema.parse>;
type MatchSide = ModelBSession['anchors'][number]['possession']['side'];

const RUNNER_OFFENSIVE_BEHAVIORS = Object.freeze([
  'PASS',
  'DRIVE',
  'MID',
  'LAYUP',
  'THREE',
] as const satisfies readonly ModelBBehaviorId[]);

const SHOT_ZONE_BY_BEHAVIOR = Object.freeze({
  MID: 'MID_RANGE',
  LAYUP: 'INSIDE',
  THREE: 'THREE_POINT',
} as const);

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

function behaviorSeconds(behaviorId: ModelBBehaviorId, session: ModelBSession): number {
  const behavior = MODEL_B_BEHAVIOR_REGISTRY.find((entry) => entry.behaviorId === behaviorId);
  if (behavior === undefined) throw new Error(`Unknown runner behavior ${behaviorId}.`);
  const anchor = current(session);
  return Math.min(
    behavior.maximumSeconds,
    anchor.periodClockSeconds,
    rebuildModelBShotClockSeconds(anchor, session.events),
  );
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

function resolveBoundaryForfeit(session: ModelBSession): ModelBSession | null {
  const anchor = current(session);
  if (anchor.controlBoundary?.kind !== 'DEAD_BALL') return null;
  const plan = buildModelBFoulOutBoundaryPlan(session);
  if (plan.eventPayloads.length === 0) return null;
  return commitModelBRuleTransition(session, {
    eventPayloads: plan.eventPayloads,
    status: plan.status,
    controlBoundaryKind: plan.status === 'IN_PROGRESS' ? 'DEAD_BALL' : 'MATCH_COMPLETE',
  });
}

/** Advances exactly one committed live segment or period-completion boundary. */
export function stepToNextControlBoundary(session: ModelBSession): ModelBSession {
  const anchor = current(session);
  if (anchor.status !== 'IN_PROGRESS') return session;
  const forcedBoundary = resolveBoundaryForfeit(session);
  if (forcedBoundary !== null) return forcedBoundary;
  if (anchor.periodClockSeconds === 0) return completeModelBPeriod(session);

  const shotClock = rebuildModelBShotClockSeconds(anchor, session.events);
  if (shotClock < 1)
    throw new Error('An in-progress Model B segment requires a positive shot clock.');
  if (anchor.periodClockSeconds <= shotClock && anchor.periodClockSeconds < 2) {
    return commitModelBActiveSegment(session, {
      eventPayloads: [{ type: 'CLOCK_ADVANCED', seconds: anchor.periodClockSeconds }],
      resolution: 'PERIOD_END',
    });
  }

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
  const onBallDefender = player(session, defenseSide, onBallDefenderId);

  // Defense has its own semantic selection ordinal. HELPD commits its R1 Fact before the
  // offense continues; CONTEST is represented by the defender used in the later shot formula.
  const defenseBehavior = selectModelBBehavior({
    context: drawContext(session),
    behaviorSelectionOrdinal: 0,
    decisionPlayer: onBallDefender,
    legalBehaviorIds: ['HELPD', 'CONTEST'],
    safeFallbackBehaviorId: 'CONTEST',
    currentLineup: defenseLineup,
    eligibleDefenderIds: defense.map(({ playerId }) => playerId),
    onBallDefenderId,
  }).value.behavior.behaviorId;
  if (defenseBehavior === 'HELPD' && anchor.possession.segmentIndex === 0) {
    const helper = selectModelBHelpDefender({
      context: drawContext(session),
      behaviorSelectionOrdinal: 0,
      currentLineup: defenseLineup,
      candidates: defense,
      onBallDefenderId,
    });
    if (helper !== null) {
      const seconds = behaviorSeconds('HELPD', session);
      if (seconds > 0 && seconds < anchor.periodClockSeconds) {
        const resolution = buildModelBHelpDefenseResolution(session, {
          transitionEventOffset: 0,
          seconds,
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
          eventPayloads: resolution.eventPayloads,
          facts: resolution.facts,
          resolution: 'SAME_SIDE_DEAD_BALL',
        });
      }
    }
  }

  const selection = selectModelBBehavior({
    context: drawContext(session),
    behaviorSelectionOrdinal: 1,
    decisionPlayer: handler,
    legalBehaviorIds: RUNNER_OFFENSIVE_BEHAVIORS,
    safeFallbackBehaviorId: 'PASS',
  }).value.behavior.behaviorId as (typeof RUNNER_OFFENSIVE_BEHAVIORS)[number];
  const seconds = behaviorSeconds(selection, session);
  if (seconds < 1) throw new Error('A selected Model B behavior must consume positive time.');
  const reachesPeriodEnd = seconds === anchor.periodClockSeconds;
  if (reachesPeriodEnd) {
    return commitModelBActiveSegment(session, {
      eventPayloads: [{ type: 'CLOCK_ADVANCED', seconds }],
      facts: [handlerFact(session, handler.playerId)],
      resolution: 'PERIOD_END',
    });
  }

  if (selection === 'PASS') {
    const receiver = selectModelBReceiverOrBeneficiary({
      context: drawContext(session),
      behaviorId: selection,
      behaviorSelectionOrdinal: 1,
      candidates: offense,
      excludedPlayerIds: [handler.playerId],
    });
    if (receiver === null) throw new Error('A PASS behavior requires an eligible receiver.');
    const turnoverProbabilityMilli = calculateTurnoverProbabilityMilli({
      defensivePressureMilli: calculateAbilityBlendMilli(onBallDefender, 'DEFENSIVE_PRESSURE'),
      ballSecurityMilli: calculateAbilityBlendMilli(handler, 'BALL_SECURITY'),
      actionPressureMilli: -3_000,
      pace: anchor.effectiveFragment.tactics[sideKey(offenseSide)].pace,
      teamExecutionModifierMilli: 0,
    });
    const prefixCount = pendingPossessionStartCount(session);
    const resolution = buildModelBPassResolution(session, {
      transitionEventOffset: prefixCount,
      seconds,
      behaviorId: selection,
      behaviorSelectionOrdinal: 1,
      passSequence: anchor.possession.segmentIndex,
      passerId: handler.playerId,
      receiverId: receiver.value.playerId,
      turnoverProbabilityMilli,
      pressuredClassificationProbabilityMilli: 500,
      stealAttributionProbabilityMilli: calculateAttributionProbabilityMilli(
        'STEAL',
        calculateAbilityBlendMilli(onBallDefender, 'STEAL'),
        calculateAbilityBlendMilli(handler, 'BALL_PROTECTION'),
      ),
    });
    const facts = resolution.facts.map((fact) => ({
      ...fact,
      sourceEventIndexes: fact.sourceEventIndexes.map((index) => index - prefixCount),
    }));
    if (!resolution.turnoverOccurred && seconds + 1 < anchor.periodClockSeconds) {
      // Assist causality is deliberately local to one committed segment.  A successful pass
      // therefore resolves its immediate receiver shot atomically instead of carrying an
      // implicit handler across a later segment.
      const shot = buildModelBShotResolution(session, {
        transitionEventOffset: prefixCount + resolution.eventPayloads.length + 1,
        shooterId: receiver.value.playerId,
        zone: 'MID_RANGE',
        shotInstanceIndex: 1,
        makeProbabilityMilli: calculateShotProbabilityMilli({
          zone: 'MID_RANGE',
          offensiveExecutionMilli: calculateAbilityBlendMilli(receiver.value, 'MID_RANGE_OFFENSE'),
          defensiveExecutionMilli: calculateAbilityBlendMilli(onBallDefender, 'MID_RANGE_DEFENSE'),
          opportunityQualityMilli: 50_000,
        }),
        assistCandidate: {
          playerId: handler.playerId,
          attributionProbabilityMilli: calculateAttributionProbabilityMilli(
            'ASSIST',
            calculateAbilityBlendMilli(handler, 'CREATION'),
            calculateAbilityBlendMilli(onBallDefender, 'MID_RANGE_DEFENSE'),
          ),
        },
      });
      const payloads = [
        ...resolution.eventPayloads,
        { type: 'CLOCK_ADVANCED' as const, seconds: 1 },
        ...shot.eventPayloads,
      ];
      if (shot.made) {
        return commitModelBActiveSegment(session, {
          eventPayloads: payloads,
          facts,
          resolution: 'POSSESSION_CHANGE',
        });
      }
      const rebound = buildModelBReboundResolution(session, {
        transitionEventOffset: payloads.length,
        reboundInstanceIndex: 0,
        offensiveReboundProbabilityMilli: calculateOffensiveReboundProbabilityMilli(
          calculateAbilityBlendMilli(receiver.value, 'PERSONAL_REBOUND'),
          calculateAbilityBlendMilli(onBallDefender, 'PERSONAL_REBOUND'),
        ),
        offensiveCandidates: offense.map((candidate) => ({
          player: candidate,
          personalReboundExecutionMilli: calculateAbilityBlendMilli(candidate, 'PERSONAL_REBOUND'),
        })),
        defensiveCandidates: defense.map((candidate) => ({
          player: candidate,
          personalReboundExecutionMilli: calculateAbilityBlendMilli(candidate, 'PERSONAL_REBOUND'),
        })),
      });
      return commitModelBActiveSegment(session, {
        eventPayloads: [...payloads, ...rebound.eventPayloads],
        facts,
        resolution: rebound.kind === 'OFFENSIVE' ? 'OFFENSIVE_REBOUND' : 'POSSESSION_CHANGE',
      });
    }
    return commitModelBActiveSegment(session, {
      eventPayloads: resolution.eventPayloads,
      facts,
      resolution: resolution.turnoverOccurred ? 'POSSESSION_CHANGE' : 'SAME_SIDE_DEAD_BALL',
    });
  }

  if (selection === 'DRIVE') {
    const creationProbabilityMilli = calculateCreationProbabilityMilli(
      'DRIVE',
      calculateAbilityBlendMilli(handler, 'DRIVE_CREATION'),
      calculateAbilityBlendMilli(onBallDefender, 'DEFENSIVE_CONTROL'),
    );
    const anchorBefore = current(session);
    return commitModelBActiveSegment(session, {
      eventPayloads: [{ type: 'CLOCK_ADVANCED', seconds }],
      facts: [
        buildModelBCreationFactDraft({
          sourceEventIndexes: [0],
          creatorId: handler.playerId,
          beneficiaryId: handler.playerId,
          behaviorId: 'DRIVE',
          opportunityQualityDelta: creationProbabilityMilli >= 500 ? 1_000 : -1_000,
          defensiveResponse: defenseBehavior === 'CONTEST' ? 'CONTESTED' : 'NONE',
          period: anchorBefore.period,
          possessionIndex: anchorBefore.possession.possessionIndex,
          segmentIndex: anchorBefore.possession.segmentIndex,
          nextBehaviorId: 'LAYUP',
        }),
      ],
      resolution: 'SAME_SIDE_DEAD_BALL',
    });
  }

  const zone = SHOT_ZONE_BY_BEHAVIOR[selection];
  const offenseBlend =
    zone === 'INSIDE'
      ? 'INSIDE_OFFENSE'
      : zone === 'MID_RANGE'
        ? 'MID_RANGE_OFFENSE'
        : 'THREE_POINT_OFFENSE';
  const defenseBlend =
    zone === 'INSIDE'
      ? 'INSIDE_SHOT_PROTECTION'
      : zone === 'MID_RANGE'
        ? 'MID_RANGE_DEFENSE'
        : 'THREE_POINT_DEFENSE';
  const blockCandidate =
    zone === 'THREE_POINT'
      ? null
      : deriveModelBBlockHelpCandidate({
          currentLineup: defenseLineup,
          candidates: defense,
          directDefenderId: onBallDefenderId,
        });
  const shot = buildModelBShotResolution(session, {
    transitionEventOffset: pendingPossessionStartCount(session) + 1,
    shooterId: handler.playerId,
    zone,
    shotInstanceIndex: 1,
    makeProbabilityMilli: calculateShotProbabilityMilli({
      zone,
      offensiveExecutionMilli: calculateAbilityBlendMilli(handler, offenseBlend),
      defensiveExecutionMilli: calculateAbilityBlendMilli(onBallDefender, defenseBlend),
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
              calculateAbilityBlendMilli(handler, offenseBlend),
            ),
          },
        }),
  });
  const payloads = [{ type: 'CLOCK_ADVANCED' as const, seconds }, ...shot.eventPayloads];
  if (shot.made) {
    const foul = buildModelBDefensiveFoulResolution(session, {
      transitionEventOffset: payloads.length,
      defenderId: onBallDefenderId,
      behaviorSelectionOrdinal: 1,
      occurrenceProbabilityMilli: calculateDefensiveFoulProbabilityMilli({
        context: zone === 'INSIDE' ? 'INSIDE' : 'JUMP_SHOT',
        offensiveContactMilli: calculateAbilityBlendMilli(
          handler,
          zone === 'INSIDE' ? 'INSIDE_CONTACT' : 'PERIMETER_CONTACT',
        ),
        defensiveControlMilli: calculateAbilityBlendMilli(onBallDefender, 'DEFENSIVE_CONTROL'),
        actionMode: 'SAFE',
      }),
      shootingContext: { zone, made: true },
    });
    payloads.push(...foul.eventPayloads);
    if (foul.freeThrowAttempts > 0) {
      payloads.push(
        ...buildModelBFreeThrowResolution(session, {
          transitionEventOffset: payloads.length,
          shooterId: handler.playerId,
          attempts: foul.freeThrowAttempts as 1 | 2 | 3,
          shootingMilli: modelBAbilityValues(handler).shooting * 1_000,
          fatiguePenaltyMilli: 0,
        }).eventPayloads,
      );
    }
    return commitModelBActiveSegment(session, {
      eventPayloads: payloads,
      facts: [handlerFact(session, handler.playerId)],
      resolution: 'POSSESSION_CHANGE',
    });
  }
  const rebound = buildModelBReboundResolution(session, {
    transitionEventOffset: payloads.length,
    reboundInstanceIndex: 0,
    offensiveReboundProbabilityMilli: calculateOffensiveReboundProbabilityMilli(
      calculateAbilityBlendMilli(handler, 'PERSONAL_REBOUND'),
      calculateAbilityBlendMilli(onBallDefender, 'PERSONAL_REBOUND'),
    ),
    offensiveCandidates: offense.map((candidate) => ({
      player: candidate,
      personalReboundExecutionMilli: calculateAbilityBlendMilli(candidate, 'PERSONAL_REBOUND'),
    })),
    defensiveCandidates: defense.map((candidate) => ({
      player: candidate,
      personalReboundExecutionMilli: calculateAbilityBlendMilli(candidate, 'PERSONAL_REBOUND'),
    })),
  });
  return commitModelBActiveSegment(session, {
    eventPayloads: [...payloads, ...rebound.eventPayloads],
    facts: [handlerFact(session, handler.playerId)],
    resolution: rebound.kind === 'OFFENSIVE' ? 'OFFENSIVE_REBOUND' : 'POSSESSION_CHANGE',
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

/** Re-executes an exact frozen protocol and rejects any divergent authoritative object. */
export function replayMatch(
  input: ModelBMatchInput,
  authoritativeBundle: ModelBProtocolBundle,
  maximumSteps = 10_000,
): ModelBSession {
  const authority = MatchProtocolBundleSchema.parse(authoritativeBundle);
  if (canonicalizeV2(authority.input) !== canonicalizeV2(input)) {
    throw new Error('Model B replay input must equal the authoritative protocol input.');
  }
  const replayed = runToEnd(createModelBSession(input), maximumSteps);
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
  const transcript = buildModelBTranscript(session);
  const terminationReason: 'COMPLETED' | 'FORFEIT_INSUFFICIENT_PLAYERS' =
    finalAnchor.status === 'COMPLETED' ? 'COMPLETED' : 'FORFEIT_INSUFFICIENT_PLAYERS';
  const result = {
    matchId: session.input.matchId,
    matchInputHash: session.input.matchInputHash,
    matchKind: session.input.matchKind,
    recordScope: session.input.recordScope,
    finalAnchor,
    events: [...session.events],
    facts: [...session.facts],
    transcript,
    eventDigest: deriveEventDigest(session.input.matchId, session.events),
    terminationReason,
    matchResultId: finalAnchor.anchorHash,
  };
  result.matchResultId = deriveMatchResultId(result);
  const parsedResult = MatchResultDraftSchema.parse(result);
  return MatchProtocolBundleSchema.parse({
    input: session.input,
    anchors: [...session.anchors],
    result: parsedResult,
  });
}
