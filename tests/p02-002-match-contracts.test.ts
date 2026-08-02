import {
  deriveEffectiveFragmentHash,
  deriveEventDigest,
  deriveEventId,
  deriveFactId,
  deriveGameId,
  deriveMatchAnchorHash,
  deriveMatchEventHash,
  deriveMatchFactHash,
  deriveMatchId,
  deriveMatchInputHash,
  deriveMatchResultId,
  deriveTranscriptEntryHash,
  deriveTranscriptHash,
  deriveMatchCommandPayloadHash,
  GENESIS_MATCH_ANCHOR_HASH,
  GENESIS_MATCH_TRANSCRIPT_HASH,
  MatchAnchorSchema,
  MatchCommandSchema,
  MatchEventSchema,
  MatchFactSchema,
  MatchInputSchema,
  MatchProtocolBundleSchema,
  MatchResultDraftSchema,
  MatchTranscriptEntrySchema,
  MatchTranscriptSchema,
  type MatchAnchor,
  type MatchEvent,
  type MatchFact,
  type MatchInput,
  type MatchResultDraft,
  type MatchTranscript,
  type MatchTranscriptEntry,
} from '@sunny-court/domain/match';
import { idHash } from '@sunny-court/domain/core';
import { describe, expect, it } from 'vitest';

const positions = ['PG', 'SG', 'SF', 'PF', 'C'] as const;

function makePlayer(playerId: string, index: number) {
  return {
    playerId,
    primaryPosition: positions[index % positions.length]!,
    secondaryPosition: positions[(index + 1) % positions.length]!,
    abilities: {
      finishing: 60,
      shooting: 61,
      ballHandling: 62,
      playmaking: 63,
      perimeterDefense: 64,
      interiorDefense: 65,
      rebounding: 66,
      athleticism: 67,
      stamina: 68,
      tacticalUnderstanding: 69,
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
    fatigueMilli: 100,
    chemistryMilli: 200,
  };
}

function makeTeam(teamId: string, playerIds: readonly string[]) {
  return {
    teamId,
    registeredRosterIds: [...playerIds],
    players: playerIds.map(makePlayer),
    startingLineup: {
      PG: playerIds[0]!,
      SG: playerIds[1]!,
      SF: playerIds[2]!,
      PF: playerIds[3]!,
      C: playerIds[4]!,
    },
    roles: {
      primaryOrganizer: playerIds[0]!,
      offensiveHub: playerIds[1]!,
      defensiveCaptain: playerIds[2]!,
    },
    tactics: {
      pace: 'BALANCED' as const,
      offensiveFocus: 'BALANCED' as const,
      defensiveFocus: 'BALANCED' as const,
    },
    rotationPreset: 'BALANCED' as const,
  };
}

function makeInput(
  matchKind: 'OFFICIAL' | 'FRIENDLY' | 'SCRIMMAGE' = 'OFFICIAL',
  fixtureSuffix = 'default',
): MatchInput {
  const gameIdentity = {
    rootSeed: `p02-002-contract-fixture:${fixtureSuffix}`,
    newGameDescriptor: { schoolId: `fixture-school:${fixtureSuffix}`, startingSeason: 1 },
    rulesVersion: 'p02-rules-v1',
    contentHashes: { playerContent: idHash('fixture-content-v1', 'players') },
  };
  const gameId = deriveGameId(gameIdentity);
  const base = {
    gameIdentity,
    gameId,
    matchId: idHash('placeholder-match-id'),
    absoluteWeek: 1,
    slotIdentity:
      matchKind === 'SCRIMMAGE'
        ? `scrimmage-slot:${fixtureSuffix}`
        : `opponent-or-schedule:${fixtureSuffix}`,
    rules: { regularPeriodSeconds: 600, overtimePeriodSeconds: 300, foulOutLimit: 5 },
    matchSeed: [1, 2, 3, 4] as [number, number, number, number],
    controlStrategy: matchKind === 'SCRIMMAGE' ? ('INSTANT' as const) : ('FULL_COACH' as const),
    matchInputHash: idHash('placeholder-input-hash'),
  };

  const raw =
    matchKind === 'SCRIMMAGE'
      ? (() => {
          const sourceRosterIds = Array.from(
            { length: 12 },
            (_, index) => `scrimmage-${index + 1}`,
          );
          return {
            ...base,
            matchKind: 'SCRIMMAGE' as const,
            recordScope: 'SCRIMMAGE_OBSERVATION' as const,
            sourceTeamId: 'fixture-school',
            sourceRosterIds,
            homeTeam: makeTeam('fixture-school', sourceRosterIds.slice(0, 6)),
            awayTeam: makeTeam('fixture-school', sourceRosterIds.slice(6)),
          };
        })()
      : {
          ...base,
          matchKind,
          recordScope:
            matchKind === 'OFFICIAL' ? ('OFFICIAL_CAREER' as const) : ('FRIENDLY_ARCHIVE' as const),
          homeTeam: makeTeam(
            'home-school',
            Array.from({ length: 12 }, (_, index) => `home-${index + 1}`),
          ),
          awayTeam: makeTeam(
            'away-school',
            Array.from({ length: 12 }, (_, index) => `away-${index + 1}`),
          ),
        };
  raw.matchId = deriveMatchId(raw as MatchInput);
  raw.matchInputHash = deriveMatchInputHash(raw as MatchInput);
  return MatchInputSchema.parse(raw);
}

function makeFragment(input: MatchInput, homePace = input.homeTeam.tactics.pace) {
  return {
    tactics: {
      home: { ...input.homeTeam.tactics, pace: homePace },
      away: input.awayTeam.tactics,
    },
    roles: { home: input.homeTeam.roles, away: input.awayTeam.roles },
    lineups: { home: input.homeTeam.startingLineup, away: input.awayTeam.startingLineup },
    effects: [],
  };
}

function makeAnchor(
  input: MatchInput,
  options: Readonly<{
    previousAnchorHash?: string;
    localRevision?: number;
    eventCursor?: number;
    transcriptCursor?: number;
    fragment?: ReturnType<typeof makeFragment>;
    status?: 'IN_PROGRESS' | 'COMPLETED' | 'FORFEIT_INSUFFICIENT_PLAYERS';
  }> = {},
): MatchAnchor {
  const fragment = options.fragment ?? makeFragment(input);
  const controlBoundary = {
    kind: 'MATCH_START' as const,
    period: 1,
    possessionIndex: 0,
    segmentIndex: 0,
  };
  const raw = {
    matchId: input.matchId,
    previousAnchorHash: options.previousAnchorHash ?? GENESIS_MATCH_ANCHOR_HASH,
    anchorHash: idHash('placeholder-anchor-hash'),
    period: 1,
    periodClockSeconds: 600,
    score: { home: 0, away: 0 },
    possession: { side: 'HOME' as const, possessionIndex: 0, segmentIndex: 0 },
    eventCursor: options.eventCursor ?? 0,
    transcriptCursor: options.transcriptCursor ?? 0,
    localRevision: options.localRevision ?? 0,
    lineups: fragment.lineups,
    roles: fragment.roles,
    pendingSubstitutionEntryHashes: [],
    fatigueMilliByPlayer: {},
    chemistryWeightedMilli: { home: 200, away: 200 },
    boxScore: { home: { players: [] }, away: { players: [] } },
    effectiveFragment: fragment,
    effectiveFragmentHash: idHash('placeholder-fragment-hash'),
    controlBoundary,
    status: options.status ?? 'IN_PROGRESS',
  };
  raw.effectiveFragmentHash = deriveEffectiveFragmentHash({
    matchId: raw.matchId,
    previousAnchorHash: raw.previousAnchorHash,
    controlBoundary: raw.controlBoundary,
    fragment: raw.effectiveFragment,
  });
  raw.anchorHash = deriveMatchAnchorHash(raw as MatchAnchor);
  return MatchAnchorSchema.parse(raw);
}

function makeEvent(
  input: MatchInput,
  previousAnchor: MatchAnchor,
  nextAnchor: MatchAnchor,
  options: Readonly<{
    cursor?: number;
    localEventSequence?: number;
    eventType?: MatchEvent['eventType'];
    payload?: MatchEvent['payload'];
  }> = {},
): MatchEvent {
  const raw = {
    matchId: input.matchId,
    eventId: idHash('placeholder-event-id'),
    eventHash: idHash('placeholder-event-hash'),
    cursor: options.cursor ?? 0,
    period: 1,
    possessionIndex: 0,
    segmentIndex: 0,
    localEventSequence: options.localEventSequence ?? 0,
    eventType: options.eventType ?? ('MATCH_COMPLETED' as const),
    previousAnchorHash: previousAnchor.anchorHash,
    nextAnchorHash: nextAnchor.anchorHash,
    payload: options.payload ?? {
      type: 'MATCH_COMPLETED' as const,
      terminationReason: 'COMPLETED' as const,
    },
  };
  raw.eventId = deriveEventId(raw as MatchEvent);
  raw.eventHash = deriveMatchEventHash(raw as MatchEvent);
  return MatchEventSchema.parse(raw);
}

function makeFact(input: MatchInput, event: MatchEvent): MatchFact {
  const raw = {
    matchId: input.matchId,
    factId: idHash('placeholder-fact-id'),
    factHash: idHash('placeholder-fact-hash'),
    factKind: 'EXPLANATION' as const,
    sourceEventIds: [event.eventId],
    localFactSequence: 0,
    payload: { message: 'fixture fact' },
  };
  raw.factId = deriveFactId(raw as MatchFact);
  raw.factHash = deriveMatchFactHash(raw as MatchFact);
  return MatchFactSchema.parse(raw);
}

function makeTranscriptEntry(
  input: MatchInput,
  previousAnchor: MatchAnchor,
  nextAnchor: MatchAnchor,
): MatchTranscriptEntry {
  const command = MatchCommandSchema.parse({
    kind: 'SET_MATCH_TACTICS',
    tactics: nextAnchor.effectiveFragment.tactics.home,
  });
  const raw = {
    matchId: input.matchId,
    previousAnchorHash: previousAnchor.anchorHash,
    nextAnchorHash: nextAnchor.anchorHash,
    controlBoundary: previousAnchor.controlBoundary!,
    localRevisionBefore: previousAnchor.localRevision,
    localRevisionAfter: nextAnchor.localRevision,
    effectiveFromSegmentKey: {
      period: previousAnchor.possession.possessionIndex + 1,
      possessionIndex: previousAnchor.possession.possessionIndex,
      segmentIndex: previousAnchor.possession.segmentIndex,
    },
    effectiveFragment: nextAnchor.effectiveFragment,
    effectiveFragmentHash: nextAnchor.effectiveFragmentHash,
    previousTranscriptHash: GENESIS_MATCH_TRANSCRIPT_HASH,
    transcriptEntryHash: idHash('placeholder-transcript-entry-hash'),
    actor: 'PLAYER' as const,
    decisionIdentity: {
      kind: 'PLAYER_COMMAND' as const,
      commandPayloadHash: deriveMatchCommandPayloadHash(command),
    },
    command,
  };
  raw.effectiveFromSegmentKey.period = raw.controlBoundary.period;
  raw.transcriptEntryHash = deriveTranscriptEntryHash(raw as MatchTranscriptEntry);
  return MatchTranscriptEntrySchema.parse(raw);
}

function makeValidBundle(fixtureSuffix = 'default') {
  const input = makeInput('OFFICIAL', fixtureSuffix);
  const firstAnchor = makeAnchor(input);
  const nextFragment = makeFragment(input, 'FAST');
  const acceptedCommandAnchor = makeAnchor(input, {
    previousAnchorHash: firstAnchor.anchorHash,
    localRevision: 1,
    eventCursor: 0,
    transcriptCursor: 1,
    fragment: nextFragment,
  });
  const finalAnchor = makeAnchor(input, {
    previousAnchorHash: acceptedCommandAnchor.anchorHash,
    localRevision: 1,
    eventCursor: 2,
    transcriptCursor: 1,
    fragment: nextFragment,
    status: 'COMPLETED',
  });
  const events = [
    makeEvent(input, acceptedCommandAnchor, finalAnchor, {
      eventType: 'CLOCK_ADVANCED',
      payload: { type: 'CLOCK_ADVANCED', seconds: 1 },
    }),
    makeEvent(input, acceptedCommandAnchor, finalAnchor, {
      cursor: 1,
      localEventSequence: 1,
    }),
  ];
  const fact = makeFact(input, events[1]!);
  const entry = makeTranscriptEntry(input, firstAnchor, acceptedCommandAnchor);
  const transcriptRaw = {
    matchId: input.matchId,
    genesisAnchorHash: firstAnchor.anchorHash,
    entries: [entry],
    transcriptHash: idHash('placeholder-transcript-hash'),
  };
  transcriptRaw.transcriptHash = deriveTranscriptHash(transcriptRaw as MatchTranscript);
  const transcript = MatchTranscriptSchema.parse(transcriptRaw);
  const resultRaw = {
    matchId: input.matchId,
    matchInputHash: input.matchInputHash,
    matchKind: input.matchKind,
    recordScope: input.recordScope,
    finalAnchor,
    events,
    facts: [fact],
    transcript,
    eventDigest: deriveEventDigest(input.matchId, events),
    terminationReason: 'COMPLETED' as const,
    matchResultId: idHash('placeholder-result-id'),
  };
  resultRaw.matchResultId = deriveMatchResultId(resultRaw as MatchResultDraft);
  const result = MatchResultDraftSchema.parse(resultRaw);
  return {
    input,
    anchors: [firstAnchor, acceptedCommandAnchor, finalAnchor],
    result,
  };
}

function rehashFirstEventAndResult(bundle: ReturnType<typeof makeValidBundle>): void {
  const event = bundle.result.events[0]!;
  const previousEventId = event.eventId;
  event.eventId = deriveEventId(event);
  event.eventHash = deriveMatchEventHash(event);

  for (const fact of bundle.result.facts) {
    fact.sourceEventIds = fact.sourceEventIds.map((eventId) =>
      eventId === previousEventId ? event.eventId : eventId,
    );
    fact.factId = deriveFactId(fact);
    fact.factHash = deriveMatchFactHash(fact);
  }

  bundle.result.eventDigest = deriveEventDigest(bundle.result.matchId, bundle.result.events);
  bundle.result.matchResultId = deriveMatchResultId(bundle.result);
}

describe('P02-002 closed MatchInput contracts', () => {
  it('requires the exact official/friendly 12-player roster, five starter slots, and no duplicates', () => {
    const input = makeInput('OFFICIAL');
    expect(input.homeTeam.registeredRosterIds).toHaveLength(12);
    expect(Object.keys(input.homeTeam.startingLineup)).toEqual(['PG', 'SG', 'SF', 'PF', 'C']);

    const legacySized = structuredClone(input);
    legacySized.homeTeam.registeredRosterIds.push('legacy-22nd-player');
    expect(MatchInputSchema.safeParse(legacySized).success).toBe(false);

    const duplicatePlayer = structuredClone(input);
    duplicatePlayer.homeTeam.players[11]!.playerId = duplicatePlayer.homeTeam.players[0]!.playerId;
    expect(MatchInputSchema.safeParse(duplicatePlayer).success).toBe(false);
  });

  it('allows only the three match-kind/record-scope pairs and models scrimmage as one 12-player 6-vs-6 split', () => {
    expect(makeInput('FRIENDLY').recordScope).toBe('FRIENDLY_ARCHIVE');
    const scrimmage = makeInput('SCRIMMAGE');
    expect(scrimmage.homeTeam.teamId).toBe(scrimmage.sourceTeamId);
    expect(scrimmage.awayTeam.teamId).toBe(scrimmage.sourceTeamId);
    expect(scrimmage.homeTeam.players).toHaveLength(6);
    expect(scrimmage.awayTeam.players).toHaveLength(6);
    expect(
      new Set([
        ...scrimmage.homeTeam.registeredRosterIds,
        ...scrimmage.awayTeam.registeredRosterIds,
      ]),
    ).toEqual(new Set(scrimmage.sourceRosterIds));

    const invalidScrimmageControl = structuredClone(scrimmage);
    invalidScrimmageControl.controlStrategy = 'FULL_COACH';
    invalidScrimmageControl.matchInputHash = deriveMatchInputHash(invalidScrimmageControl);
    expect(MatchInputSchema.safeParse(invalidScrimmageControl).success).toBe(false);

    const invalidPair = structuredClone(makeInput('OFFICIAL')) as Record<string, unknown>;
    invalidPair.recordScope = 'FRIENDLY_ARCHIVE';
    expect(MatchInputSchema.safeParse(invalidPair).success).toBe(false);
  });

  it('derives immutable game, match, and input identities rather than accepting caller values', () => {
    const input = makeInput();
    expect(input.gameId).toBe(deriveGameId(input.gameIdentity));
    expect(input.matchId).toBe(deriveMatchId(input));
    expect(input.matchInputHash).toBe(deriveMatchInputHash(input));

    const swapped = structuredClone(input);
    swapped.matchId = makeInput('FRIENDLY').matchId;
    swapped.matchInputHash = deriveMatchInputHash(swapped);
    expect(MatchInputSchema.safeParse(swapped).success).toBe(false);
  });

  it('exposes a closed MatchCommand contract without a match-running command', () => {
    expect(
      MatchCommandSchema.safeParse({
        kind: 'SET_MATCH_TACTICS',
        tactics: makeInput().homeTeam.tactics,
      }).success,
    ).toBe(true);
    expect(MatchCommandSchema.safeParse({ kind: 'RUN_MATCH' }).success).toBe(false);
  });
});

describe('P02-002 closed match identity chain', () => {
  it('accepts a fully bound protocol fixture without running a match resolver', () => {
    const bundle = makeValidBundle();
    expect(MatchProtocolBundleSchema.safeParse(bundle).success).toBe(true);
  });

  it('rejects swapped anchors/events and malformed transcript mutations at their validated layers', () => {
    const bundle = makeValidBundle();
    const otherBundle = makeValidBundle('other-match');

    const swappedAnchor = structuredClone(bundle);
    swappedAnchor.anchors[1] = otherBundle.anchors[1];
    expect(MatchProtocolBundleSchema.safeParse(swappedAnchor).success).toBe(false);

    const swappedEvent = structuredClone(bundle);
    swappedEvent.result.events[0] = otherBundle.result.events[0];
    swappedEvent.result.eventDigest = deriveEventDigest(
      swappedEvent.result.matchId,
      swappedEvent.result.events,
    );
    swappedEvent.result.matchResultId = deriveMatchResultId(swappedEvent.result);
    expect(MatchProtocolBundleSchema.safeParse(swappedEvent).success).toBe(false);

    const swappedActor = structuredClone(bundle);
    swappedActor.result.transcript.entries[0]!.actor = 'ASSISTANT';
    swappedActor.result.transcript.transcriptHash = deriveTranscriptHash(
      swappedActor.result.transcript,
    );
    swappedActor.result.matchResultId = deriveMatchResultId(swappedActor.result);
    expect(MatchProtocolBundleSchema.safeParse(swappedActor).success).toBe(false);

    const swappedRevision = structuredClone(bundle);
    swappedRevision.result.transcript.entries[0]!.localRevisionAfter = 2;
    swappedRevision.result.transcript.transcriptHash = deriveTranscriptHash(
      swappedRevision.result.transcript,
    );
    swappedRevision.result.matchResultId = deriveMatchResultId(swappedRevision.result);
    expect(MatchProtocolBundleSchema.safeParse(swappedRevision).success).toBe(false);

    const swappedBoundary = structuredClone(bundle);
    swappedBoundary.result.transcript.entries[0]!.controlBoundary.kind = 'DEAD_BALL';
    swappedBoundary.result.transcript.transcriptHash = deriveTranscriptHash(
      swappedBoundary.result.transcript,
    );
    swappedBoundary.result.matchResultId = deriveMatchResultId(swappedBoundary.result);
    expect(MatchProtocolBundleSchema.safeParse(swappedBoundary).success).toBe(false);

    const swappedFragment = structuredClone(bundle);
    swappedFragment.result.transcript.entries[0]!.effectiveFragment.tactics.home.pace = 'SLOW';
    swappedFragment.result.transcript.transcriptHash = deriveTranscriptHash(
      swappedFragment.result.transcript,
    );
    swappedFragment.result.matchResultId = deriveMatchResultId(swappedFragment.result);
    expect(MatchProtocolBundleSchema.safeParse(swappedFragment).success).toBe(false);
  });

  it('rejects a valid but different result classification after the result identity is recomputed', () => {
    const mismatchedClassification = structuredClone(makeValidBundle());
    mismatchedClassification.result.matchKind = 'FRIENDLY';
    mismatchedClassification.result.recordScope = 'FRIENDLY_ARCHIVE';
    mismatchedClassification.result.matchResultId = deriveMatchResultId(
      mismatchedClassification.result,
    );

    expect(MatchResultDraftSchema.safeParse(mismatchedClassification.result).success).toBe(true);
    expect(MatchProtocolBundleSchema.safeParse(mismatchedClassification).success).toBe(false);
  });

  it('rejects rehashed event coordinates and local sequence that disagree with the Anchor/cursor chain', () => {
    const mutations: readonly ((event: MatchEvent) => void)[] = [
      (event) => {
        event.period += 1;
      },
      (event) => {
        event.possessionIndex += 1;
      },
      (event) => {
        event.segmentIndex += 1;
      },
      (event) => {
        event.localEventSequence += 1;
      },
    ];

    for (const mutate of mutations) {
      const inconsistentEvent = structuredClone(makeValidBundle());
      mutate(inconsistentEvent.result.events[0]!);
      rehashFirstEventAndResult(inconsistentEvent);

      expect(MatchEventSchema.safeParse(inconsistentEvent.result.events[0]).success).toBe(true);
      expect(MatchResultDraftSchema.safeParse(inconsistentEvent.result).success).toBe(true);
      expect(MatchProtocolBundleSchema.safeParse(inconsistentEvent).success).toBe(false);
    }
  });

  it('rejects a rehashed event that skips an intermediate Anchor in the cursor chain', () => {
    const skippedAnchor = structuredClone(makeValidBundle());
    skippedAnchor.result.events[0]!.previousAnchorHash = skippedAnchor.anchors[0]!.anchorHash;
    rehashFirstEventAndResult(skippedAnchor);

    expect(MatchEventSchema.safeParse(skippedAnchor.result.events[0]).success).toBe(true);
    expect(MatchResultDraftSchema.safeParse(skippedAnchor.result).success).toBe(true);
    expect(MatchProtocolBundleSchema.safeParse(skippedAnchor).success).toBe(false);
  });

  it('rejects rehashed event attribution outside the registered roster or on the wrong team', () => {
    const registeredHomeShooter = structuredClone(makeValidBundle());
    const registeredHomeShooterEvent = registeredHomeShooter.result.events[0]!;
    registeredHomeShooterEvent.eventType = 'SHOT';
    registeredHomeShooterEvent.payload = {
      type: 'SHOT',
      shooterId: registeredHomeShooter.input.homeTeam.registeredRosterIds[0]!,
      zone: 'THREE_POINT',
      made: false,
    };
    rehashFirstEventAndResult(registeredHomeShooter);
    expect(MatchProtocolBundleSchema.safeParse(registeredHomeShooter).success).toBe(true);

    const outsideRoster = structuredClone(makeValidBundle());
    const outsideRosterEvent = outsideRoster.result.events[0]!;
    outsideRosterEvent.eventType = 'SHOT';
    outsideRosterEvent.payload = {
      type: 'SHOT',
      shooterId: 'not-registered-for-this-match',
      zone: 'THREE_POINT',
      made: false,
    };
    rehashFirstEventAndResult(outsideRoster);
    expect(MatchEventSchema.safeParse(outsideRosterEvent).success).toBe(true);
    expect(MatchResultDraftSchema.safeParse(outsideRoster.result).success).toBe(true);
    expect(MatchProtocolBundleSchema.safeParse(outsideRoster).success).toBe(false);

    const wrongTeam = structuredClone(makeValidBundle());
    const wrongTeamEvent = wrongTeam.result.events[0]!;
    wrongTeamEvent.eventType = 'SCORE';
    wrongTeamEvent.payload = {
      type: 'SCORE',
      side: 'HOME',
      playerId: wrongTeam.input.awayTeam.registeredRosterIds[0]!,
      points: 2,
    };
    rehashFirstEventAndResult(wrongTeam);
    expect(MatchEventSchema.safeParse(wrongTeamEvent).success).toBe(true);
    expect(MatchResultDraftSchema.safeParse(wrongTeam.result).success).toBe(true);
    expect(MatchProtocolBundleSchema.safeParse(wrongTeam).success).toBe(false);
  });
});
