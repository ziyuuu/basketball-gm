import type { CanonicalV2Value } from '../../core/canonical-v2.js';
import { compareUtf16CodeUnits } from '../../core/canonical-v2.js';
import {
  GENESIS_MATCH_ANCHOR_HASH,
  GENESIS_MATCH_TRANSCRIPT_HASH,
  MatchAnchorSchema,
  MatchEventSchema,
  MatchFactSchema,
  MatchInputSchema,
  MatchTranscriptEntrySchema,
  MatchTranscriptSchema,
  deriveEffectiveFragmentHash,
  deriveEventId,
  deriveFactId,
  deriveMatchAnchorHash,
  deriveMatchEventHash,
  deriveMatchFactHash,
  deriveTranscriptEntryHash,
  deriveTranscriptHash,
  type MatchAnchor,
  type MatchEvent,
  type MatchFact,
  type MatchInput,
  type MatchTranscript,
  type MatchTranscriptEntry,
} from '../schemas.js';
import { keyedDrawUnitInterval } from '../keyed-rng.js';
import { createEmptyModelBBoxScore, reduceModelBEventPayloads } from './box-score.js';
import {
  calculateLineupChemistryMilli,
  stableSortPlayersById,
  type MatchPlayerSnapshot,
} from './effective-values.js';

export type ModelBSession = Readonly<{
  input: MatchInput;
  anchors: readonly MatchAnchor[];
  events: readonly MatchEvent[];
  facts: readonly MatchFact[];
  transcriptEntries: readonly MatchTranscriptEntry[];
}>;

export type ModelBFactDraft = Readonly<{
  factKind: MatchFact['factKind'];
  sourceEventIndexes: readonly number[];
  payload: CanonicalV2Value;
}>;

export type ModelBTransitionDraft = Readonly<{
  eventPayloads: readonly MatchEvent['payload'][];
  facts?: readonly ModelBFactDraft[];
  nextPossession?: MatchAnchor['possession'];
  nextPeriod?: number;
  status?: MatchAnchor['status'];
  controlBoundaryKind?: NonNullable<MatchAnchor['controlBoundary']>['kind'];
  effectiveFragment?: MatchAnchor['effectiveFragment'];
  fatigueMilliByPlayer?: MatchAnchor['fatigueMilliByPlayer'];
  chemistryWeightedMilli?: MatchAnchor['chemistryWeightedMilli'];
  pendingSubstitutionEntryHashes?: readonly string[];
}>;

export type ModelBAutomatedDecisionDraft =
  | Readonly<{
      actor: 'ASSISTANT' | 'OPPONENT';
      policyId: string;
      policyInputHash: string;
      effectiveFragment: MatchAnchor['effectiveFragment'];
    }>
  | Readonly<{
      actor: 'RULES';
      ruleId: string;
      ruleInputHash: string;
      effectiveFragment: MatchAnchor['effectiveFragment'];
    }>;

function deepFreeze<T>(value: T): Readonly<T> {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
    Object.freeze(value);
  }
  return value as Readonly<T>;
}

function freezeSession(input: {
  input: MatchInput;
  anchors: MatchAnchor[];
  events: MatchEvent[];
  facts: MatchFact[];
  transcriptEntries: MatchTranscriptEntry[];
}): ModelBSession {
  return Object.freeze({
    input: input.input,
    anchors: Object.freeze(input.anchors),
    events: Object.freeze(input.events),
    facts: Object.freeze(input.facts),
    transcriptEntries: Object.freeze(input.transcriptEntries),
  });
}

function sidePlayers(input: MatchInput, side: 'HOME' | 'AWAY'): readonly MatchPlayerSnapshot[] {
  return side === 'HOME' ? input.homeTeam.players : input.awayTeam.players;
}

function lineupPlayers(
  input: MatchInput,
  side: 'HOME' | 'AWAY',
  lineup: MatchAnchor['lineups']['home'],
): MatchPlayerSnapshot[] {
  const playerById = new Map(sidePlayers(input, side).map((player) => [player.playerId, player]));
  return Object.values(lineup).map((playerId) => {
    const player = playerById.get(playerId);
    if (player === undefined)
      throw new Error(`Lineup player ${playerId} is not registered for ${side}.`);
    return player;
  });
}

function makeAnchor(input: Omit<MatchAnchor, 'anchorHash' | 'effectiveFragmentHash'>): MatchAnchor {
  const withFragmentHash = {
    ...input,
    effectiveFragmentHash: deriveEffectiveFragmentHash({
      matchId: input.matchId,
      previousAnchorHash: input.previousAnchorHash,
      controlBoundary: input.controlBoundary,
      fragment: input.effectiveFragment,
    }),
    anchorHash: GENESIS_MATCH_ANCHOR_HASH,
  } as MatchAnchor;
  const anchor = {
    ...withFragmentHash,
    anchorHash: deriveMatchAnchorHash(withFragmentHash),
  };
  return deepFreeze(MatchAnchorSchema.parse(anchor));
}

export function createModelBSession(rawInput: MatchInput): ModelBSession {
  const input = MatchInputSchema.parse(rawInput);
  const openingSide =
    keyedDrawUnitInterval({
      matchSeed: input.matchSeed,
      period: 1,
      possessionIndex: 0,
      segmentIndex: 0,
      drawKind: 'BALL_HANDLER',
      localIndex: 0,
    }) < 0.5
      ? 'HOME'
      : 'AWAY';
  const lineups = {
    home: { ...input.homeTeam.startingLineup },
    away: { ...input.awayTeam.startingLineup },
  };
  const roles = {
    home: { ...input.homeTeam.roles },
    away: { ...input.awayTeam.roles },
  };
  const tactics = {
    home: { ...input.homeTeam.tactics },
    away: { ...input.awayTeam.tactics },
  };
  const controlBoundary = {
    kind: 'MATCH_START' as const,
    period: 1,
    possessionIndex: 0,
    segmentIndex: 0,
  };
  const effectiveFragment = { tactics, roles, lineups, effects: [] };
  const fatigueMilliByPlayer = Object.fromEntries(
    stableSortPlayersById([...input.homeTeam.players, ...input.awayTeam.players]).map((player) => [
      player.playerId,
      player.fatigueMilli,
    ]),
  );
  const anchor = makeAnchor({
    matchId: input.matchId,
    previousAnchorHash: GENESIS_MATCH_ANCHOR_HASH,
    period: 1,
    periodClockSeconds: input.rules.regularPeriodSeconds,
    score: { home: 0, away: 0 },
    possession: { side: openingSide, possessionIndex: 0, segmentIndex: 0 },
    eventCursor: 0,
    transcriptCursor: 0,
    localRevision: 0,
    lineups,
    roles,
    pendingSubstitutionEntryHashes: [],
    fatigueMilliByPlayer,
    chemistryWeightedMilli: {
      home: calculateLineupChemistryMilli(lineupPlayers(input, 'HOME', lineups.home), roles.home),
      away: calculateLineupChemistryMilli(lineupPlayers(input, 'AWAY', lineups.away), roles.away),
    },
    boxScore: createEmptyModelBBoxScore(input),
    effectiveFragment,
    controlBoundary,
    status: 'IN_PROGRESS',
  });
  return freezeSession({
    input: deepFreeze(input),
    anchors: [anchor],
    events: [],
    facts: [],
    transcriptEntries: [],
  });
}

export function buildModelBTranscript(session: ModelBSession): MatchTranscript {
  const transcript = {
    matchId: session.input.matchId,
    genesisAnchorHash: session.anchors[0]?.anchorHash ?? GENESIS_MATCH_ANCHOR_HASH,
    entries: [...session.transcriptEntries],
    transcriptHash: GENESIS_MATCH_TRANSCRIPT_HASH,
  } as MatchTranscript;
  transcript.transcriptHash = deriveTranscriptHash(transcript);
  return MatchTranscriptSchema.parse(transcript);
}

function assertBoundaryMatchesAnchor(anchor: MatchAnchor): void {
  const boundary = anchor.controlBoundary;
  if (
    boundary !== null &&
    (boundary.period !== anchor.period ||
      boundary.possessionIndex !== anchor.possession.possessionIndex ||
      boundary.segmentIndex !== anchor.possession.segmentIndex)
  ) {
    throw new Error(
      'A control boundary must use its Anchor period/possession/segment coordinates.',
    );
  }
}

function requireExactIds(
  actual: readonly string[],
  expected: ReadonlySet<string>,
  label: string,
): void {
  if (actual.length !== expected.size || actual.some((value) => !expected.has(value))) {
    throw new Error(`${label} must contain exactly the registered participant IDs.`);
  }
}

export function assertModelBSessionInvariants(session: ModelBSession): void {
  if (session.anchors.length === 0) throw new Error('A Model B session requires a genesis Anchor.');
  const homeIds = new Set(session.input.homeTeam.players.map(({ playerId }) => playerId));
  const awayIds = new Set(session.input.awayTeam.players.map(({ playerId }) => playerId));
  const allIds = new Set([...homeIds, ...awayIds]);
  const anchorIndexByHash = new Map<string, number>();
  for (const [index, anchor] of session.anchors.entries()) {
    MatchAnchorSchema.parse(anchor);
    assertBoundaryMatchesAnchor(anchor);
    const expectedPrevious =
      index === 0 ? GENESIS_MATCH_ANCHOR_HASH : session.anchors[index - 1]?.anchorHash;
    if (anchor.previousAnchorHash !== expectedPrevious) {
      throw new Error('Model B Anchor chain is not contiguous.');
    }
    if (anchorIndexByHash.has(anchor.anchorHash)) {
      throw new Error('Model B Anchor hashes must be unique.');
    }
    anchorIndexByHash.set(anchor.anchorHash, index);
    requireExactIds(
      anchor.boxScore.home.players.map(({ playerId }) => playerId),
      homeIds,
      'Home box score',
    );
    requireExactIds(
      anchor.boxScore.away.players.map(({ playerId }) => playerId),
      awayIds,
      'Away box score',
    );
    requireExactIds(Object.keys(anchor.fatigueMilliByPlayer), allIds, 'Fatigue map');
    if (Object.values(anchor.lineups.home).some((playerId) => !homeIds.has(playerId))) {
      throw new Error('Home lineup contains a player outside the immutable MatchInput.');
    }
    if (Object.values(anchor.lineups.away).some((playerId) => !awayIds.has(playerId))) {
      throw new Error('Away lineup contains a player outside the immutable MatchInput.');
    }
  }
  const eventsByTransition = new Map<string, MatchEvent[]>();
  const nextLocalSequence = new Map<string, number>();
  for (const [index, event] of session.events.entries()) {
    MatchEventSchema.parse(event);
    if (event.cursor !== index) throw new Error('Model B event cursor is not dense.');
    const previousIndex = anchorIndexByHash.get(event.previousAnchorHash);
    const nextIndex = anchorIndexByHash.get(event.nextAnchorHash);
    if (previousIndex === undefined || nextIndex !== previousIndex + 1) {
      throw new Error('A Model B event must bind one adjacent Anchor transition.');
    }
    const previousAnchor = session.anchors[previousIndex]!;
    const nextAnchor = session.anchors[nextIndex]!;
    if (
      event.period !== previousAnchor.period ||
      event.possessionIndex !== previousAnchor.possession.possessionIndex ||
      event.segmentIndex !== previousAnchor.possession.segmentIndex
    ) {
      throw new Error('A Model B event coordinate must equal its previous Anchor coordinate.');
    }
    if (event.cursor < previousAnchor.eventCursor || event.cursor >= nextAnchor.eventCursor) {
      throw new Error('A Model B event cursor must lie inside its adjacent Anchor cursor range.');
    }
    const segmentKey = `${event.period}:${event.possessionIndex}:${event.segmentIndex}`;
    const expectedLocalSequence = nextLocalSequence.get(segmentKey) ?? 0;
    if (event.localEventSequence !== expectedLocalSequence) {
      throw new Error('Model B local event sequence must be dense within a segment.');
    }
    nextLocalSequence.set(segmentKey, expectedLocalSequence + 1);
    const transitionKey = `${event.previousAnchorHash}:${event.nextAnchorHash}`;
    const transitionEvents = eventsByTransition.get(transitionKey) ?? [];
    transitionEvents.push(event);
    eventsByTransition.set(transitionKey, transitionEvents);
  }
  for (let index = 0; index < session.anchors.length - 1; index += 1) {
    const previousAnchor = session.anchors[index]!;
    const nextAnchor = session.anchors[index + 1]!;
    const transitionEvents =
      eventsByTransition.get(`${previousAnchor.anchorHash}:${nextAnchor.anchorHash}`) ?? [];
    if (transitionEvents.length !== nextAnchor.eventCursor - previousAnchor.eventCursor) {
      throw new Error('Adjacent Model B Anchor cursors must equal their transition event count.');
    }
    for (const [offset, event] of transitionEvents.entries()) {
      if (event.cursor !== previousAnchor.eventCursor + offset) {
        throw new Error('A Model B Anchor transition must densely cover its cursor range.');
      }
    }
  }
  const eventIds = new Set(session.events.map(({ eventId }) => eventId));
  for (const fact of session.facts) {
    MatchFactSchema.parse(fact);
    if (fact.sourceEventIds.some((eventId) => !eventIds.has(eventId))) {
      throw new Error('Model B fact references an event outside this session.');
    }
  }
  const finalAnchor = session.anchors.at(-1)!;
  if (
    finalAnchor.eventCursor !== session.events.length ||
    finalAnchor.transcriptCursor !== session.transcriptEntries.length
  ) {
    throw new Error('Model B final Anchor cursors do not match committed arrays.');
  }
  const transcript = buildModelBTranscript(session);
  for (const entry of transcript.entries) {
    const previousIndex = anchorIndexByHash.get(entry.previousAnchorHash);
    const nextIndex = anchorIndexByHash.get(entry.nextAnchorHash);
    if (previousIndex === undefined || nextIndex !== previousIndex + 1) {
      throw new Error('A Model B transcript entry must bind one adjacent Anchor transition.');
    }
    const previousAnchor = session.anchors[previousIndex]!;
    const nextAnchor = session.anchors[nextIndex]!;
    if (
      previousAnchor.localRevision !== entry.localRevisionBefore ||
      nextAnchor.localRevision !== entry.localRevisionAfter ||
      nextAnchor.transcriptCursor !== previousAnchor.transcriptCursor + 1 ||
      nextAnchor.effectiveFragmentHash !== entry.effectiveFragmentHash
    ) {
      throw new Error('A Model B transcript entry does not match its adjacent Anchor identities.');
    }
  }
}

function assertModelBSessionTail(session: ModelBSession): void {
  const anchor = session.anchors.at(-1);
  if (anchor === undefined) throw new Error('A Model B session requires a current Anchor.');
  MatchAnchorSchema.parse(anchor);
  assertBoundaryMatchesAnchor(anchor);
  if (
    anchor.eventCursor !== session.events.length ||
    anchor.transcriptCursor !== session.transcriptEntries.length
  ) {
    throw new Error('Model B current Anchor cursors do not match committed arrays.');
  }
  if (session.events.at(-1)?.cursor !== session.events.length - 1 && session.events.length > 0) {
    throw new Error('Model B event tail cursor is not dense.');
  }
}

function buildTransitionEvent(
  previousAnchor: MatchAnchor,
  nextAnchorHash: string,
  cursor: number,
  localEventSequence: number,
  payload: MatchEvent['payload'],
): MatchEvent {
  const event = {
    matchId: previousAnchor.matchId,
    eventId: GENESIS_MATCH_ANCHOR_HASH,
    eventHash: GENESIS_MATCH_ANCHOR_HASH,
    cursor,
    period: previousAnchor.period,
    possessionIndex: previousAnchor.possession.possessionIndex,
    segmentIndex: previousAnchor.possession.segmentIndex,
    localEventSequence,
    eventType: payload.type,
    previousAnchorHash: previousAnchor.anchorHash,
    nextAnchorHash,
    payload,
  } as MatchEvent;
  event.eventId = deriveEventId(event);
  event.eventHash = deriveMatchEventHash(event);
  return deepFreeze(MatchEventSchema.parse(event));
}

function buildTransitionFacts(
  session: ModelBSession,
  transitionEvents: readonly MatchEvent[],
  drafts: readonly ModelBFactDraft[],
): MatchFact[] {
  return drafts.map((draft, draftIndex) => {
    const sourceEventIds = [...new Set(draft.sourceEventIndexes)].map((eventIndex) => {
      const event = transitionEvents[eventIndex];
      if (event === undefined) throw new Error(`Fact source event index ${eventIndex} is invalid.`);
      return event.eventId;
    });
    sourceEventIds.sort(compareUtf16CodeUnits);
    if (sourceEventIds.length === 0)
      throw new Error('A Model B fact requires at least one source event.');
    const fact = {
      matchId: session.input.matchId,
      factId: GENESIS_MATCH_ANCHOR_HASH,
      factHash: GENESIS_MATCH_ANCHOR_HASH,
      factKind: draft.factKind,
      sourceEventIds,
      localFactSequence: session.facts.length + draftIndex,
      payload: draft.payload,
    } as MatchFact;
    fact.factId = deriveFactId(fact);
    fact.factHash = deriveMatchFactHash(fact);
    return deepFreeze(MatchFactSchema.parse(fact));
  });
}

export function commitModelBTransition(
  session: ModelBSession,
  draft: ModelBTransitionDraft,
): ModelBSession {
  assertModelBSessionTail(session);
  if (draft.eventPayloads.length === 0) {
    throw new Error('An event transition must contain at least one event payload.');
  }
  const previousAnchor = session.anchors.at(-1)!;
  if (previousAnchor.status !== 'IN_PROGRESS') {
    throw new Error('A completed Model B session cannot commit another event transition.');
  }
  const reduced = reduceModelBEventPayloads(
    previousAnchor,
    draft.eventPayloads,
    session.input.rules.foulOutLimit,
  );
  const nextPeriod = draft.nextPeriod ?? previousAnchor.period;
  if (nextPeriod < previousAnchor.period || nextPeriod > previousAnchor.period + 1) {
    throw new Error(
      'A Model B transition may only remain in period or advance exactly one period.',
    );
  }
  if (nextPeriod > previousAnchor.period && reduced.periodClockSeconds !== 0) {
    throw new Error('A Model B period may only advance after its clock reaches zero.');
  }
  if (
    nextPeriod > previousAnchor.period &&
    !draft.eventPayloads.some(
      (payload) => payload.type === 'PERIOD_COMPLETED' && payload.period === previousAnchor.period,
    )
  ) {
    throw new Error('Advancing a period requires its PERIOD_COMPLETED event.');
  }
  const nextPossession = draft.nextPossession ?? { ...previousAnchor.possession };
  const status = draft.status ?? previousAnchor.status;
  if (
    status !== 'IN_PROGRESS' &&
    !draft.eventPayloads.some(
      (payload) =>
        payload.type === 'MATCH_COMPLETED' &&
        payload.terminationReason ===
          (status === 'COMPLETED' ? 'COMPLETED' : 'FORFEIT_INSUFFICIENT_PLAYERS'),
    )
  ) {
    throw new Error('A terminal Anchor requires its matching MATCH_COMPLETED event.');
  }
  const periodClockSeconds =
    nextPeriod === previousAnchor.period
      ? reduced.periodClockSeconds
      : nextPeriod <= 4
        ? session.input.rules.regularPeriodSeconds
        : session.input.rules.overtimePeriodSeconds;
  const controlBoundary = {
    kind:
      draft.controlBoundaryKind ??
      (status === 'IN_PROGRESS'
        ? nextPeriod === previousAnchor.period
          ? 'DEAD_BALL'
          : 'PERIOD_BREAK'
        : 'MATCH_COMPLETE'),
    period: nextPeriod,
    possessionIndex: nextPossession.possessionIndex,
    segmentIndex: nextPossession.segmentIndex,
  };
  const baseFragment = draft.effectiveFragment ?? previousAnchor.effectiveFragment;
  const effectiveFragment = {
    ...baseFragment,
    tactics: {
      home: { ...baseFragment.tactics.home },
      away: { ...baseFragment.tactics.away },
    },
    lineups: reduced.lineups,
    roles: reduced.roles,
    effects: [...baseFragment.effects],
  };
  const nextAnchor = makeAnchor({
    ...previousAnchor,
    previousAnchorHash: previousAnchor.anchorHash,
    period: nextPeriod,
    periodClockSeconds,
    score: reduced.score,
    possession: nextPossession,
    eventCursor: previousAnchor.eventCursor + draft.eventPayloads.length,
    lineups: reduced.lineups,
    roles: reduced.roles,
    pendingSubstitutionEntryHashes: [
      ...(draft.pendingSubstitutionEntryHashes ?? previousAnchor.pendingSubstitutionEntryHashes),
    ],
    fatigueMilliByPlayer: {
      ...(draft.fatigueMilliByPlayer ?? previousAnchor.fatigueMilliByPlayer),
    },
    chemistryWeightedMilli: {
      ...(draft.chemistryWeightedMilli ?? previousAnchor.chemistryWeightedMilli),
    },
    boxScore: reduced.boxScore,
    effectiveFragment,
    controlBoundary,
    status,
  });
  const existingInSegment = session.events.filter(
    (event) =>
      event.period === previousAnchor.period &&
      event.possessionIndex === previousAnchor.possession.possessionIndex &&
      event.segmentIndex === previousAnchor.possession.segmentIndex,
  ).length;
  const transitionEvents = draft.eventPayloads.map((payload, index) =>
    buildTransitionEvent(
      previousAnchor,
      nextAnchor.anchorHash,
      previousAnchor.eventCursor + index,
      existingInSegment + index,
      payload,
    ),
  );
  const transitionFacts = buildTransitionFacts(session, transitionEvents, draft.facts ?? []);
  const nextSession = freezeSession({
    input: session.input,
    anchors: [...session.anchors, nextAnchor],
    events: [...session.events, ...transitionEvents],
    facts: [...session.facts, ...transitionFacts],
    transcriptEntries: [...session.transcriptEntries],
  });
  assertModelBSessionTail(nextSession);
  return nextSession;
}

export function commitModelBAutomatedDecision(
  session: ModelBSession,
  draft: ModelBAutomatedDecisionDraft,
): ModelBSession {
  assertModelBSessionTail(session);
  const previousAnchor = session.anchors.at(-1)!;
  if (previousAnchor.status !== 'IN_PROGRESS' || previousAnchor.controlBoundary === null) {
    throw new Error('Automated decisions require an in-progress control boundary.');
  }
  const effectiveFragment = {
    ...draft.effectiveFragment,
    effects: [...draft.effectiveFragment.effects],
  };
  const nextAnchor = makeAnchor({
    ...previousAnchor,
    previousAnchorHash: previousAnchor.anchorHash,
    transcriptCursor: previousAnchor.transcriptCursor + 1,
    localRevision: previousAnchor.localRevision + 1,
    lineups: effectiveFragment.lineups,
    roles: effectiveFragment.roles,
    effectiveFragment,
  });
  const base = {
    matchId: session.input.matchId,
    previousAnchorHash: previousAnchor.anchorHash,
    nextAnchorHash: nextAnchor.anchorHash,
    controlBoundary: previousAnchor.controlBoundary,
    localRevisionBefore: previousAnchor.localRevision,
    localRevisionAfter: nextAnchor.localRevision,
    effectiveFromSegmentKey: {
      period: previousAnchor.controlBoundary.period,
      possessionIndex: previousAnchor.controlBoundary.possessionIndex,
      segmentIndex: previousAnchor.controlBoundary.segmentIndex,
    },
    effectiveFragment,
    effectiveFragmentHash: nextAnchor.effectiveFragmentHash,
    previousTranscriptHash:
      session.transcriptEntries.at(-1)?.transcriptEntryHash ?? GENESIS_MATCH_TRANSCRIPT_HASH,
    transcriptEntryHash: GENESIS_MATCH_TRANSCRIPT_HASH,
    command: null,
  };
  const entry = (
    draft.actor === 'RULES'
      ? {
          ...base,
          actor: 'RULES' as const,
          decisionIdentity: {
            kind: 'RULES_DECISION' as const,
            ruleId: draft.ruleId,
            ruleInputHash: draft.ruleInputHash,
          },
        }
      : {
          ...base,
          actor: draft.actor,
          decisionIdentity: {
            kind: 'AUTOMATED_POLICY' as const,
            policyId: draft.policyId,
            policyInputHash: draft.policyInputHash,
          },
        }
  ) as MatchTranscriptEntry;
  entry.transcriptEntryHash = deriveTranscriptEntryHash(entry);
  const parsedEntry = deepFreeze(MatchTranscriptEntrySchema.parse(entry));
  const nextSession = freezeSession({
    input: session.input,
    anchors: [...session.anchors, nextAnchor],
    events: [...session.events],
    facts: [...session.facts],
    transcriptEntries: [...session.transcriptEntries, parsedEntry],
  });
  assertModelBSessionTail(nextSession);
  return nextSession;
}
