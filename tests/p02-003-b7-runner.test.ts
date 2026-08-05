import { describe, expect, it } from 'vitest';
import {
  MatchProtocolBundleSchema,
  MODEL_B_BEHAVIOR_REGISTRY,
  MODEL_B_RUNNER_SELECTABLE_BEHAVIOR_IDS,
  calculateModelBTransitionFormationProbabilityMilli,
  createModelBSession,
  deriveModelBSubUint64,
  finalizeModelBProtocolBundle,
  replayMatch,
  runModelBSegmentPhaseMachine,
  runToEnd,
  stepToNextControlBoundary,
} from '../packages/domain/src/match/index.js';
import { makeP02MatchInput } from './helpers/p02-003-fixtures.js';

describe('P02-003 B7 headless runner identity', () => {
  it('executes every frozen selectable behavior in a real runner result chain', () => {
    const session = runToEnd(
      createModelBSession(makeP02MatchInput({ matchSeed: [7, 11, 13, 17] })),
    );
    const eventsById = new Map(session.events.map((event) => [event.eventId, event]));
    const traces = session.facts.filter(
      (fact) => (fact.payload as Record<string, unknown>).type === 'ACTION_TRACE',
    );
    const traceBehaviorIds = [
      ...new Set(traces.map((fact) => (fact.payload as Record<string, unknown>).behaviorId)),
    ]
      .filter((behaviorId): behaviorId is string => typeof behaviorId === 'string')
      .sort();

    expect(traceBehaviorIds).toEqual([...MODEL_B_RUNNER_SELECTABLE_BEHAVIOR_IDS].sort());
    for (const trace of traces) {
      const payload = trace.payload as Record<string, unknown>;
      expect(eventsById.get(trace.sourceEventIds[0]!)?.payload.type).toBe('CLOCK_ADVANCED');
      expect(payload.durationSeconds).toEqual(expect.any(Number));
      expect(payload.resultCode).toEqual(expect.any(String));
      expect(Array.isArray(payload.resultEventIds)).toBe(true);
      for (const eventId of payload.resultEventIds as readonly string[]) {
        expect(eventsById.has(eventId)).toBe(true);
      }
    }
    expect(
      session.facts.filter(
        (fact) => (fact.payload as Record<string, unknown>).type === 'DEFENSIVE_ACTION',
      ),
    ).not.toHaveLength(0);
    expect(
      session.facts.filter((fact) => (fact.payload as Record<string, unknown>).type === 'CREATION'),
    ).not.toHaveLength(0);
    const shotTraces = traces.filter((fact) => {
      const payload = fact.payload as Record<string, unknown>;
      return (
        typeof payload.behaviorId === 'string' &&
        [
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
        ].includes(payload.behaviorId)
      );
    });
    expect(
      shotTraces.every(
        (fact) =>
          typeof (fact.payload as Record<string, unknown>).opportunityQualityMilli === 'number',
      ),
    ).toBe(true);
    expect(
      shotTraces.some(
        (fact) => (fact.payload as Record<string, unknown>).opportunityQualityMilli !== 50_000,
      ),
    ).toBe(true);
  }, 120_000);

  it('runs V25 through the frozen phase guard without an invalid candidate or draw', () => {
    const max = (1n << 64n) - 1n;
    const phase = runModelBSegmentPhaseMachine({
      state: {
        phase: 'HALF_COURT_NORMAL',
        periodClockSeconds: 100,
        shotClockSeconds: 30,
        decisionElapsedSeconds: 0,
        normalTargetSeconds: 14,
        transitionWindowSeconds: 6,
        terminalReserveSeconds: 1,
        handlerPlayerId: 'H1',
      },
      plans: [
        {
          candidates: [
            { behaviorId: 'PASS', weight: 100 },
            { behaviorId: 'SPOTUP', weight: 100 },
          ],
          behaviorSelectionRawUint64: 0n,
          actionDurationRawUint64: 1n << 63n,
          ordinaryGapRawUint64: max,
          receiverId: 'H2',
          resultCode: 'PASS_SUCCESS',
        },
        {
          candidates: [{ behaviorId: 'REORG', weight: 100 }],
          behaviorSelectionRawUint64: 0n,
          actionDurationRawUint64: max,
          ordinaryGapRawUint64: null,
          receiverId: null,
          resultCode: 'NO_EFFECT',
        },
        {
          candidates: [{ behaviorId: 'PASS', weight: 100 }],
          behaviorSelectionRawUint64: 0n,
          actionDurationRawUint64: max,
          ordinaryGapRawUint64: null,
          receiverId: 'H3',
          resultCode: 'PASS_SUCCESS',
        },
        {
          candidates: [{ behaviorId: 'ADV', weight: 100 }],
          behaviorSelectionRawUint64: 0n,
          actionDurationRawUint64: max,
          ordinaryGapRawUint64: null,
          receiverId: null,
          resultCode: 'NO_EFFECT',
        },
        {
          candidates: [{ behaviorId: 'REORG', weight: 100 }],
          behaviorSelectionRawUint64: 0n,
          actionDurationRawUint64: max,
          ordinaryGapRawUint64: null,
          receiverId: null,
          resultCode: 'NO_EFFECT',
        },
        {
          candidates: [{ behaviorId: 'PASS', weight: 100 }],
          behaviorSelectionRawUint64: 0n,
          actionDurationRawUint64: max,
          ordinaryGapRawUint64: null,
          receiverId: 'H2',
          resultCode: 'PASS_SUCCESS',
        },
        {
          candidates: [{ behaviorId: 'ADV', weight: 100 }],
          behaviorSelectionRawUint64: 0n,
          actionDurationRawUint64: max,
          ordinaryGapRawUint64: null,
          receiverId: null,
          resultCode: 'NO_EFFECT',
        },
      ],
    });

    expect(phase.eventPayloads).toEqual([
      { type: 'CLOCK_ADVANCED', seconds: 11 },
      { type: 'CLOCK_ADVANCED', seconds: 2 },
      { type: 'CLOCK_ADVANCED', seconds: 1 },
      { type: 'CLOCK_ADVANCED', seconds: 2 },
      { type: 'CLOCK_ADVANCED', seconds: 3 },
      { type: 'CLOCK_ADVANCED', seconds: 3 },
      { type: 'CLOCK_ADVANCED', seconds: 2 },
      { type: 'CLOCK_ADVANCED', seconds: 3 },
      { type: 'CLOCK_ADVANCED', seconds: 3 },
      { type: 'TURNOVER', playerId: 'H2', turnoverKind: 'UNFORCED_DEAD_BALL' },
    ]);
    expect(phase).toMatchObject({
      phase: 'LATE_CLOCK',
      decisionElapsedSeconds: 30,
      shotClockSeconds: 0,
      handlerPlayerId: 'H2',
      behaviorSelectionOrdinal: 7,
    });
    expect(phase.eventPayloads.some(({ type }) => type === 'SHOT')).toBe(false);
    expect(phase.factDrafts.map((fact) => (fact.payload as Record<string, unknown>).type)).toEqual([
      'POSSESSION_HANDLER',
      'PASS',
      'POSSESSION_HANDLER',
      'ACTION_TRACE',
      'ACTION_TRACE',
      'PASS',
      'POSSESSION_HANDLER',
      'ACTION_TRACE',
      'ACTION_TRACE',
      'ACTION_TRACE',
      'PASS',
      'POSSESSION_HANDLER',
      'ACTION_TRACE',
      'ACTION_TRACE',
      'SHOT_CLOCK_VIOLATION',
    ]);
    expect(
      phase.factDrafts
        .filter((fact) => (fact.payload as Record<string, unknown>).type === 'POSSESSION_HANDLER')
        .map((fact) => (fact.payload as Record<string, unknown>).handlerPlayerId),
    ).toEqual(['H1', 'H2', 'H3', 'H2']);
    expect((phase.factDrafts.at(-1)!.payload as Record<string, unknown>).handlerPlayerId).toBe(
      'H2',
    );
  });

  it('freezes transition subvalue isolation and the accepted formation formula', () => {
    const root = 123456789n;
    expect(deriveModelBSubUint64(root, 'FALLBACK', '1')).toBe(
      deriveModelBSubUint64(root, 'FALLBACK', '1'),
    );
    expect(deriveModelBSubUint64(root, 'FALLBACK', '1')).not.toBe(
      deriveModelBSubUint64(root, 'FALLBACK', '2'),
    );
    expect(deriveModelBSubUint64(root, 'FALLBACK', '1')).not.toBe(
      deriveModelBSubUint64(root, 'FORMATION', '0'),
    );
    expect(
      calculateModelBTransitionFormationProbabilityMilli({
        offenseExecutionMilli: 65_950,
        defenseExecutionMilli: 69_000,
        sourceModifierMilli: 0,
        pace: 'BALANCED',
      }),
    ).toBe(229);
  });

  it('links PASS, defensive actions and transition fallback to later runner effects', () => {
    const sessions = [
      runToEnd(
        createModelBSession(
          makeP02MatchInput({ rootSeed: 'b7-causality-a', matchSeed: [7, 11, 13, 17] }),
        ),
      ),
      runToEnd(
        createModelBSession(
          makeP02MatchInput({ rootSeed: 'b7-causality-b', matchSeed: [19, 23, 29, 31] }),
        ),
      ),
    ];
    const facts = sessions.flatMap((session) => session.facts);
    const events = sessions.flatMap((session) => session.events);
    const eventById = new Map(events.map((event) => [event.eventId, event]));
    const payloadOf = (fact: (typeof facts)[number]) => fact.payload as Record<string, unknown>;

    for (const pass of facts.filter((fact) => payloadOf(fact).type === 'PASS')) {
      const payload = payloadOf(pass);
      expect(
        facts.some((fact) => {
          const handler = payloadOf(fact);
          return (
            handler.type === 'POSSESSION_HANDLER' &&
            handler.handlerPlayerId === payload.receiverId &&
            handler.period === (eventById.get(pass.sourceEventIds[0]!)?.period ?? -1) &&
            handler.possessionIndex ===
              (eventById.get(pass.sourceEventIds[0]!)?.possessionIndex ?? -1)
          );
        }),
      ).toBe(true);
    }

    const helpSources = new Set(
      facts
        .filter(
          (fact) =>
            payloadOf(fact).type === 'DEFENSIVE_ACTION' && payloadOf(fact).behaviorId === 'HELPD',
        )
        .flatMap((fact) => fact.sourceEventIds),
    );
    for (const sourceEventId of helpSources) {
      const sameSource = facts.filter((fact) => fact.sourceEventIds.includes(sourceEventId));
      expect(sameSource.filter((fact) => payloadOf(fact).type === 'DEFENSIVE_ACTION')).toHaveLength(
        1,
      );
      expect(sameSource.filter((fact) => payloadOf(fact).type === 'CREATION')).toHaveLength(0);
      expect(sameSource.filter((fact) => payloadOf(fact).type === 'ACTION_TRACE')).toHaveLength(1);
    }

    for (const trace of facts.filter(
      (fact) => payloadOf(fact).type === 'ACTION_TRACE' && payloadOf(fact).behaviorId === 'STLTRY',
    )) {
      expect(payloadOf(trace).resultEventIds).toEqual([]);
    }
    for (const steal of events.filter((event) => event.payload.type === 'STEAL')) {
      if (steal.payload.type !== 'STEAL') continue;
      const turnover = eventById.get(steal.payload.sourceEventId);
      expect(turnover?.payload).toMatchObject({
        type: 'TURNOVER',
        turnoverKind: 'PRESSURED_LIVE_BALL',
      });
    }

    const transitionContexts = facts.filter(
      (fact) => payloadOf(fact).type === 'TRANSITION_CONTEXT',
    );
    expect(transitionContexts.some((fact) => payloadOf(fact).formed === true)).toBe(true);
    expect(transitionContexts.some((fact) => payloadOf(fact).formed === false)).toBe(true);
    expect(
      facts.some(
        (fact) =>
          payloadOf(fact).type === 'ACTION_TRACE' && payloadOf(fact).transitionFallback === true,
      ),
    ).toBe(true);
  }, 120_000);

  it('does not turn a live-ball action into a same-side dead-ball boundary', () => {
    for (let seed = 0; seed < 32; seed += 1) {
      const session = stepToNextControlBoundary(
        createModelBSession(
          makeP02MatchInput({
            rootSeed: `b7-live-ball-boundary-${seed}`,
            matchSeed: [seed + 1, seed + 2, seed + 3, seed + 4],
          }),
        ),
      );
      const previous = session.anchors.at(-2)!;
      const next = session.anchors.at(-1)!;
      const transition = session.events.slice(previous.eventCursor, next.eventCursor);
      const sameSideContinuation =
        previous.possession.side === next.possession.side &&
        previous.possession.possessionIndex === next.possession.possessionIndex &&
        next.possession.segmentIndex === previous.possession.segmentIndex + 1;

      if (sameSideContinuation) {
        expect(
          transition.some(
            (event) =>
              (event.payload.type === 'FOUL' && event.payload.foulKind === 'PERSONAL') ||
              (event.payload.type === 'REBOUND' && event.payload.kind === 'OFFENSIVE'),
          ),
        ).toBe(true);
      }
    }
  });

  it('orchestrates the complete frozen selectable matrix rather than a runner-local subset', () => {
    expect(MODEL_B_RUNNER_SELECTABLE_BEHAVIOR_IDS).toEqual(
      MODEL_B_BEHAVIOR_REGISTRY.filter(({ selectable }) => selectable).map(
        ({ behaviorId }) => behaviorId,
      ),
    );
    expect(MODEL_B_RUNNER_SELECTABLE_BEHAVIOR_IDS).toHaveLength(34);
  });

  for (const matchKind of ['OFFICIAL', 'FRIENDLY', 'SCRIMMAGE'] as const) {
    it(`${matchKind}: step, runToEnd and replay are authoritative-object identical`, () => {
      const input = makeP02MatchInput({
        matchKind,
        matchSeed:
          matchKind === 'OFFICIAL'
            ? [31, 37, 41, 43]
            : matchKind === 'FRIENDLY'
              ? [47, 53, 59, 61]
              : [67, 71, 73, 79],
      });
      let stepped = createModelBSession(input);
      while (stepped.anchors.at(-1)!.status === 'IN_PROGRESS') {
        stepped = stepToNextControlBoundary(stepped);
      }
      const ran = runToEnd(createModelBSession(input));
      const bundle = finalizeModelBProtocolBundle(ran);
      const replayed = replayMatch(input, bundle);
      expect(stepped.events).toEqual(ran.events);
      expect(stepped.facts).toEqual(ran.facts);
      expect(stepped.anchors).toEqual(ran.anchors);
      expect(stepped.transcriptEntries).toEqual(ran.transcriptEntries);
      expect(ran).toEqual(replayed);
      expect(bundle).toEqual(finalizeModelBProtocolBundle(stepped));
      expect(bundle).toEqual(finalizeModelBProtocolBundle(replayed));
      expect(MatchProtocolBundleSchema.safeParse(bundle).success).toBe(true);
      expect(ran.events.some((event) => event.payload.type === 'SHOT')).toBe(true);
      expect(ran.events.some((event) => event.payload.type === 'TURNOVER')).toBe(true);
      expect(ran.facts.length).toBeGreaterThan(0);
      expect(new Set(ran.transcriptEntries.map(({ actor }) => actor))).toEqual(
        new Set(['ASSISTANT', 'OPPONENT', 'RULES']),
      );
    }, 120_000);
  }

  it('rejects a transcript/result identity that does not match the replayed protocol', () => {
    const input = makeP02MatchInput({ rootSeed: 'b7-authoritative-replay' });
    const bundle = finalizeModelBProtocolBundle(runToEnd(createModelBSession(input)));
    const tampered = structuredClone(bundle);
    tampered.result.matchResultId = bundle.result.finalAnchor.anchorHash;
    expect(MatchProtocolBundleSchema.safeParse(tampered).success).toBe(false);
    expect(() => replayMatch(input, tampered)).toThrow(/protocol|identity|diverge/i);

    const transcriptTampered = structuredClone(bundle);
    const automated = transcriptTampered.result.transcript.entries.find(
      ({ actor }) => actor === 'ASSISTANT' || actor === 'OPPONENT' || actor === 'RULES',
    );
    expect(automated).toBeDefined();
    automated!.previousTranscriptHash = bundle.result.transcript.transcriptHash;
    expect(MatchProtocolBundleSchema.safeParse(transcriptTampered).success).toBe(false);
    expect(() => replayMatch(input, transcriptTampered)).toThrow(
      /protocol|identity|diverge|hash|chain/i,
    );
  }, 120_000);
});
