import { canonicalizeV2 } from '../../core/index.js';
import type { CanonicalV2Value } from '../../core/index.js';
import type { MatchEvent, MatchFact } from '../schemas.js';
import { MODEL_B_BEHAVIOR_MATRIX_IDS, MODEL_B_PARAMETER_REGISTRY } from './registries.js';
import { MODEL_B_PASS_BEHAVIOR_IDS } from './behavior-selection.js';
import { reduceModelBEventPayloads } from './box-score.js';
import type { ModelBSession } from './session.js';

function sameCanonical(left: unknown, right: unknown): boolean {
  return canonicalizeV2(left as CanonicalV2Value) === canonicalizeV2(right as CanonicalV2Value);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function assertInteger(value: unknown, label: string, minimum = 0): asserts value is number {
  if (!Number.isSafeInteger(value) || (value as number) < minimum) {
    throw new Error(`${label} must be a safe integer greater than or equal to ${minimum}.`);
  }
}

/** Validates the causal event rules that must be closed inside one atomic transition. */
export function assertModelBTransitionBasketballCausality(
  transitionEvents: readonly MatchEvent[],
): void {
  const byId = new Map(transitionEvents.map((event) => [event.eventId, event]));
  const pendingMakes: Array<{
    playerId: string;
    points: 1 | 2 | 3;
    sourceEventId: string;
  }> = [];
  const attributionSources = {
    ASSIST: new Set<string>(),
    STEAL: new Set<string>(),
    BLOCK: new Set<string>(),
  };
  let pendingReboundSource: MatchEvent | null = null;

  for (const event of transitionEvents) {
    const payload = event.payload;
    if (payload.type === 'SHOT') {
      pendingReboundSource = payload.made ? null : event;
      if (payload.made) {
        pendingMakes.push({
          playerId: payload.shooterId,
          points: payload.zone === 'THREE_POINT' ? 3 : 2,
          sourceEventId: event.eventId,
        });
      }
    } else if (payload.type === 'FREE_THROW') {
      pendingReboundSource = payload.made ? null : event;
      if (payload.made) {
        pendingMakes.push({ playerId: payload.shooterId, points: 1, sourceEventId: event.eventId });
      }
    } else if (payload.type === 'REBOUND') {
      if (pendingReboundSource === null) {
        throw new Error('REBOUND must consume one preceding missed SHOT/FREE_THROW.');
      }
      pendingReboundSource = null;
    } else if (payload.type === 'SCORE') {
      const makeIndex = pendingMakes.findIndex(
        (make) => make.playerId === payload.playerId && make.points === payload.points,
      );
      if (makeIndex < 0) throw new Error('Every SCORE must consume one preceding made shot event.');
      pendingMakes.splice(makeIndex, 1);
    } else if (payload.type === 'ASSIST' || payload.type === 'STEAL' || payload.type === 'BLOCK') {
      const source = byId.get(payload.sourceEventId);
      if (source === undefined) {
        throw new Error(`${payload.type} must reference a source event in the same transition.`);
      }
      if (source.cursor >= event.cursor) {
        throw new Error(`${payload.type} must follow its source event in the same transition.`);
      }
      const used = attributionSources[payload.type];
      if (used.has(source.eventId)) {
        throw new Error(`A source event may produce at most one ${payload.type} attribution.`);
      }
      used.add(source.eventId);
      if (
        payload.type === 'ASSIST' &&
        !(
          source.payload.type === 'SHOT' &&
          source.payload.made &&
          source.payload.shooterId !== payload.playerId
        )
      ) {
        throw new Error('ASSIST must reference another player’s made field goal.');
      }
      if (
        payload.type === 'STEAL' &&
        !(
          source.payload.type === 'TURNOVER' &&
          source.payload.turnoverKind === 'PRESSURED_LIVE_BALL'
        )
      ) {
        throw new Error('STEAL must reference a PRESSURED_LIVE_BALL turnover.');
      }
      if (
        payload.type === 'BLOCK' &&
        !(
          source.payload.type === 'SHOT' &&
          !source.payload.made &&
          source.payload.zone !== 'THREE_POINT'
        )
      ) {
        throw new Error('BLOCK must reference a missed inside or mid-range SHOT.');
      }
    }
  }
  if (pendingMakes.length > 0) {
    throw new Error('Every made SHOT/FREE_THROW must produce exactly one SCORE event.');
  }

  const offensiveFouls = new Map<string, number>();
  const offensiveFoulTurnovers = new Map<string, number>();
  for (const event of transitionEvents) {
    if (event.payload.type === 'FOUL' && event.payload.foulKind === 'OFFENSIVE') {
      offensiveFouls.set(
        event.payload.playerId,
        (offensiveFouls.get(event.payload.playerId) ?? 0) + 1,
      );
    } else if (
      event.payload.type === 'TURNOVER' &&
      event.payload.turnoverKind === 'OFFENSIVE_FOUL'
    ) {
      offensiveFoulTurnovers.set(
        event.payload.playerId,
        (offensiveFoulTurnovers.get(event.payload.playerId) ?? 0) + 1,
      );
    }
  }
  for (const playerId of new Set([...offensiveFouls.keys(), ...offensiveFoulTurnovers.keys()])) {
    if (offensiveFouls.get(playerId) !== 1 || offensiveFoulTurnovers.get(playerId) !== 1) {
      throw new Error('An offensive foul must pair with exactly one OFFENSIVE_FOUL turnover.');
    }
  }
}

const AUTONOMOUS_ASSIST_BREAK_BEHAVIORS = new Set([
  'DRIVE',
  'SHAKE',
  'ISO',
  'STEP_BACK',
  'POSTUP',
  'HIGH_POST_CREATION',
]);

function assertAssistFactCausality(
  session: ModelBSession,
  assistEvents: readonly MatchEvent[],
): void {
  if (!assistEvents.some(({ eventType }) => eventType === 'ASSIST')) return;
  const eventsById = new Map(session.events.map((event) => [event.eventId, event]));
  for (const assistEvent of assistEvents) {
    if (assistEvent.payload.type !== 'ASSIST') continue;
    const shot = eventsById.get(assistEvent.payload.sourceEventId);
    if (shot === undefined || shot.payload.type !== 'SHOT' || !shot.payload.made) {
      throw new Error('ASSIST must bind a committed made SHOT.');
    }
    const shooterId = shot.payload.shooterId;
    const eligiblePasses = session.facts.flatMap((fact) => {
      const payload = asRecord(fact.payload);
      if (payload?.type !== 'PASS') return [];
      const source = eventsById.get(fact.sourceEventIds[0]!);
      if (
        source === undefined ||
        source.period !== shot.period ||
        source.possessionIndex !== shot.possessionIndex ||
        source.cursor >= shot.cursor
      ) {
        return [];
      }
      return [{ fact, payload, source }];
    });
    eligiblePasses.sort(
      (left, right) =>
        right.source.cursor - left.source.cursor ||
        right.fact.localFactSequence - left.fact.localFactSequence,
    );
    const lastPass = eligiblePasses[0];
    if (
      lastPass === undefined ||
      lastPass.payload.passerId !== assistEvent.payload.playerId ||
      lastPass.payload.receiverId !== shooterId
    ) {
      throw new Error('ASSIST must belong to the last legal pass received by the shooter.');
    }
    const autonomousCreation = session.facts.some((fact) => {
      const payload = asRecord(fact.payload);
      if (
        payload?.type !== 'CREATION' ||
        payload.creatorId !== shooterId ||
        typeof payload.behaviorId !== 'string' ||
        !AUTONOMOUS_ASSIST_BREAK_BEHAVIORS.has(payload.behaviorId)
      ) {
        return false;
      }
      const source = eventsById.get(fact.sourceEventIds[0]!);
      return (
        source !== undefined &&
        source.period === shot.period &&
        source.possessionIndex === shot.possessionIndex &&
        source.cursor > lastPass.source.cursor &&
        source.cursor < shot.cursor
      );
    });
    if (autonomousCreation) {
      throw new Error('An autonomous shooter creation clears the preceding assist candidate.');
    }
  }
}

function sourceEventForFact(
  fact: MatchFact,
  eventsById: ReadonlyMap<string, MatchEvent>,
): MatchEvent {
  const source = eventsById.get(fact.sourceEventIds[0]!);
  if (source === undefined) throw new Error('A Model B fact references an unknown source event.');
  return source;
}

function sourceEventsForFact(
  fact: MatchFact,
  eventsById: ReadonlyMap<string, MatchEvent>,
): readonly MatchEvent[] {
  return fact.sourceEventIds.map((eventId) => {
    const source = eventsById.get(eventId);
    if (source === undefined) throw new Error('A Model B fact references an unknown source event.');
    return source;
  });
}

function assertFactCoordinates(payload: Record<string, unknown>, source: MatchEvent): void {
  if (
    payload.period !== source.period ||
    payload.possessionIndex !== source.possessionIndex ||
    payload.segmentIndex !== source.segmentIndex
  ) {
    throw new Error('A structured Model B fact must match its source event coordinates.');
  }
}

function assertStructuredFacts(
  session: ModelBSession,
  facts: readonly MatchFact[],
  validatePassDensity: boolean,
  sourceEventPool: readonly MatchEvent[] = session.events,
  anchorPool: ModelBSession['anchors'] = session.anchors,
): void {
  const eventsById = new Map(sourceEventPool.map((event) => [event.eventId, event]));
  const anchorsByHash = new Map(anchorPool.map((anchor) => [anchor.anchorHash, anchor]));
  const passSequences = new Map<string, number[]>();
  const creationSourceIds = new Set<string>();
  const passSourceIds = new Set<string>();
  const handlerSourceIds = new Set<string>();
  const teamReboundSourceIds = new Set<string>();
  for (const fact of facts) {
    const payload = asRecord(fact.payload);
    if (payload === null || typeof payload.type !== 'string') continue;
    const source = sourceEventForFact(fact, eventsById);
    const sources = sourceEventsForFact(fact, eventsById);
    const previousAnchor = anchorsByHash.get(source.previousAnchorHash);
    if (previousAnchor === undefined) throw new Error('A fact source must bind a session Anchor.');
    const possessionSide = previousAnchor.possession.side;
    const possessionIds = new Set(
      possessionSide === 'HOME'
        ? session.input.homeTeam.registeredRosterIds
        : session.input.awayTeam.registeredRosterIds,
    );
    if (payload.type === 'CREATION') {
      if (
        fact.factKind !== 'EXPLANATION' ||
        typeof payload.creatorId !== 'string' ||
        typeof payload.beneficiaryId !== 'string' ||
        !possessionIds.has(payload.creatorId) ||
        !possessionIds.has(payload.beneficiaryId)
      ) {
        throw new Error('CreationFact participants must belong to the possession side.');
      }
      if (
        typeof payload.behaviorId !== 'string' ||
        !MODEL_B_BEHAVIOR_MATRIX_IDS.includes(
          payload.behaviorId as (typeof MODEL_B_BEHAVIOR_MATRIX_IDS)[number],
        )
      ) {
        throw new Error('CreationFact must use a registered behavior ID.');
      }
      assertInteger(
        payload.opportunityQualityDelta,
        'CreationFact opportunity delta',
        -MODEL_B_PARAMETER_REGISTRY.opportunityPerEventCapMilli,
      );
      if (
        Math.abs(payload.opportunityQualityDelta) >
        MODEL_B_PARAMETER_REGISTRY.opportunityPerEventCapMilli
      ) {
        throw new Error('CreationFact opportunity delta must use the per-event ±6 cap.');
      }
      if (
        !['NONE', 'CONTESTED', 'DOUBLE_TEAM', 'COLLAPSED'].includes(
          payload.defensiveResponse as string,
        )
      ) {
        throw new Error('CreationFact defensive response is invalid.');
      }
      if (
        payload.nextBehaviorId !== null &&
        (typeof payload.nextBehaviorId !== 'string' ||
          !MODEL_B_BEHAVIOR_MATRIX_IDS.includes(
            payload.nextBehaviorId as (typeof MODEL_B_BEHAVIOR_MATRIX_IDS)[number],
          ))
      ) {
        throw new Error('CreationFact next behavior must be registered or null.');
      }
      if (sources.some((candidate) => candidate.payload.type !== 'CLOCK_ADVANCED')) {
        throw new Error('CreationFact must source its committed behavior clock event.');
      }
      for (const candidate of sources) {
        assertFactCoordinates(payload, candidate);
        if (creationSourceIds.has(candidate.eventId)) {
          throw new Error('One behavior source may produce at most one CreationFact.');
        }
        creationSourceIds.add(candidate.eventId);
      }
    } else if (payload.type === 'PASS') {
      if (
        fact.factKind !== 'EXPLANATION' ||
        typeof payload.passerId !== 'string' ||
        typeof payload.receiverId !== 'string' ||
        payload.passerId === payload.receiverId
      ) {
        throw new Error('PASS fact requires distinct passer and receiver IDs.');
      }
      if (!possessionIds.has(payload.passerId) || !possessionIds.has(payload.receiverId)) {
        throw new Error('PASS fact participants must belong to the possession side.');
      }
      if (
        typeof payload.behaviorId !== 'string' ||
        !MODEL_B_PASS_BEHAVIOR_IDS.includes(
          payload.behaviorId as (typeof MODEL_B_PASS_BEHAVIOR_IDS)[number],
        )
      ) {
        throw new Error('PASS fact must identify one PASS-family behavior.');
      }
      assertInteger(payload.sequence, 'PASS fact sequence');
      if (sources.length !== 1 || source.payload.type !== 'CLOCK_ADVANCED') {
        throw new Error('A successful PASS fact must source its CLOCK_ADVANCED event.');
      }
      if (passSourceIds.has(source.eventId)) {
        throw new Error('One successful PASS source may produce at most one PASS fact.');
      }
      passSourceIds.add(source.eventId);
      if (
        payload.possessionIndex !== source.possessionIndex ||
        payload.segmentIndex !== source.segmentIndex
      ) {
        throw new Error('A PASS fact must match its source event possession coordinates.');
      }
      const key = `${source.period}:${source.possessionIndex}`;
      const sequences = passSequences.get(key) ?? [];
      sequences.push(payload.sequence);
      passSequences.set(key, sequences);
    } else if (payload.type === 'POSSESSION_HANDLER') {
      if (fact.factKind !== 'STATISTICAL' || typeof payload.handlerPlayerId !== 'string') {
        throw new Error('PossessionHandlerFact requires a handler player ID.');
      }
      if (!possessionIds.has(payload.handlerPlayerId)) {
        throw new Error('PossessionHandlerFact handler must belong to the possession side.');
      }
      if (
        sources.length !== 1 ||
        !['POSSESSION_STARTED', 'CLOCK_ADVANCED'].includes(source.eventType)
      ) {
        throw new Error('PossessionHandlerFact must source a possession/clock event.');
      }
      if (handlerSourceIds.has(source.eventId)) {
        throw new Error('One handler selection may produce at most one PossessionHandlerFact.');
      }
      handlerSourceIds.add(source.eventId);
      assertFactCoordinates(payload, source);
    } else if (payload.type === 'TEAM_REBOUND') {
      if (
        fact.factKind !== 'EXPLANATION' ||
        sources.length !== 1 ||
        payload.reason !== 'UNCONTROLLED_OUT_OF_BOUNDS' ||
        !['HOME', 'AWAY'].includes(payload.awardedSide as string) ||
        payload.awardedSide === possessionSide ||
        source.payload.type !== 'SHOT' ||
        source.payload.made
      ) {
        throw new Error('Team rebound fact must source an uncontrolled missed SHOT.');
      }
      if (teamReboundSourceIds.has(source.eventId)) {
        throw new Error('One missed SHOT may produce at most one team rebound fact.');
      }
      teamReboundSourceIds.add(source.eventId);
      assertFactCoordinates(payload, source);
    }
  }
  if (validatePassDensity) {
    for (const sequences of passSequences.values()) {
      sequences.sort((left, right) => left - right);
      if (sequences.some((value, index) => value !== index)) {
        throw new Error('PASS fact sequences must be dense within each possession.');
      }
    }
  }
}

/** Validates newly materialized B5 facts before an immutable transition is returned. */
export function assertModelBTransitionBasketballFacts(
  session: ModelBSession,
  transitionEvents: readonly MatchEvent[],
  transitionFacts: readonly MatchFact[],
): void {
  if (transitionFacts.length > 0) {
    assertStructuredFacts(
      session,
      transitionFacts,
      false,
      transitionEvents,
      session.anchors.slice(-2),
    );
  }
  assertAssistFactCausality(session, transitionEvents);
}

function assertPlayerScoringIdentity(session: ModelBSession): void {
  for (const anchor of session.anchors) {
    for (const [side, team] of [
      ['home', anchor.boxScore.home],
      ['away', anchor.boxScore.away],
    ] as const) {
      let teamPoints = 0;
      for (const player of team.players) {
        const expectedPoints =
          2 * (player.fieldGoalsMade - player.threePointersMade) +
          3 * player.threePointersMade +
          player.freeThrowsMade;
        if (player.points !== expectedPoints) {
          throw new Error('Player points must equal field-goal and free-throw event totals.');
        }
        teamPoints += player.points;
      }
      if (anchor.score[side] !== teamPoints) {
        throw new Error('Anchor team score must equal the sum of its player points.');
      }
    }
  }
}

/** Replays event reductions and validates all B5 event/fact/stat causality. */
export function assertModelBBasketballInvariants(session: ModelBSession): void {
  const eventsByTransition = new Map<string, MatchEvent[]>();
  for (const event of session.events) {
    const key = `${event.previousAnchorHash}:${event.nextAnchorHash}`;
    const events = eventsByTransition.get(key) ?? [];
    events.push(event);
    eventsByTransition.set(key, events);
  }
  for (let index = 0; index < session.anchors.length - 1; index += 1) {
    const previousAnchor = session.anchors[index]!;
    const nextAnchor = session.anchors[index + 1]!;
    const events =
      eventsByTransition.get(`${previousAnchor.anchorHash}:${nextAnchor.anchorHash}`) ?? [];
    assertModelBTransitionBasketballCausality(events);
    const reduced = reduceModelBEventPayloads(
      previousAnchor,
      events.map(({ payload }) => payload),
      session.input.rules.foulOutLimit,
    );
    if (!sameCanonical(reduced.score, nextAnchor.score)) {
      throw new Error('Anchor score must be the exact reduction of committed events.');
    }
    if (!sameCanonical(reduced.boxScore, nextAnchor.boxScore)) {
      throw new Error('Anchor box score must be the exact reduction of committed events.');
    }
    if (
      nextAnchor.period === previousAnchor.period &&
      reduced.periodClockSeconds !== nextAnchor.periodClockSeconds
    ) {
      throw new Error('Anchor period clock must be the exact reduction of committed events.');
    }
  }
  assertPlayerScoringIdentity(session);
  assertStructuredFacts(session, session.facts, true);
  assertAssistFactCausality(session, session.events);
}
