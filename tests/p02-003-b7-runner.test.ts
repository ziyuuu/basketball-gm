import { describe, expect, it } from 'vitest';
import {
  MatchProtocolBundleSchema,
  MODEL_B_BEHAVIOR_REGISTRY,
  MODEL_B_RUNNER_SELECTABLE_BEHAVIOR_IDS,
  calculateModelBTransitionFallbackProbabilityMilli,
  calculateModelBTransitionFormationProbabilityMilli,
  commitModelBActiveSegment,
  createModelBSession,
  deriveModelBSubUint64,
  finalizeModelBProtocolBundle,
  predictModelBEventId,
  replayMatch,
  runModelBRunnerVector,
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

  it('keeps the pure V25 phase projection as supplementary arithmetic coverage', () => {
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

  it('runs V25 through the formal runner object chain without executing an invalid candidate or LATE gap draw', () => {
    const max = (1n << 64n) - 1n;
    const input = makeP02MatchInput({
      matchSeed: [67, 68, 69, 70],
      homePlayerIds: Array.from({ length: 12 }, (_, index) => `H${index + 1}`),
    });
    const initial = createModelBSession(input);
    expect(initial.anchors.at(-1)!.possession.side).toBe('HOME');

    const completed = runModelBRunnerVector(initial, {
      offense: [
        {
          behaviorId: 'PASS',
          actionDurationRawUint64: 1n << 63n,
          ordinaryGapRawUint64: max,
          receiverPlayerId: 'H2',
          turnoverMode: 'FORCE_NONE',
        },
        {
          behaviorId: 'REORG',
          actionDurationRawUint64: max,
          ordinaryGapRawUint64: null,
          receiverPlayerId: null,
          turnoverMode: 'FORCE_NONE',
        },
        {
          behaviorId: 'PASS',
          actionDurationRawUint64: max,
          ordinaryGapRawUint64: null,
          receiverPlayerId: 'H3',
          turnoverMode: 'FORCE_NONE',
        },
        {
          behaviorId: 'ADV',
          actionDurationRawUint64: max,
          ordinaryGapRawUint64: null,
          receiverPlayerId: null,
          turnoverMode: 'FORCE_NONE',
        },
        {
          behaviorId: 'REORG',
          actionDurationRawUint64: max,
          ordinaryGapRawUint64: null,
          receiverPlayerId: null,
          turnoverMode: 'FORCE_NONE',
        },
        {
          behaviorId: 'PASS',
          actionDurationRawUint64: max,
          ordinaryGapRawUint64: null,
          receiverPlayerId: 'H2',
          turnoverMode: 'FORCE_NONE',
        },
        {
          behaviorId: 'ADV',
          actionDurationRawUint64: max,
          ordinaryGapRawUint64: null,
          receiverPlayerId: null,
          turnoverMode: 'FORCE_NONE',
        },
        // This action is deliberately valid in isolation, but the runner must
        // stop at the H2 shot-clock violation before it can select or draw it.
        {
          behaviorId: 'SPOTUP',
          actionDurationRawUint64: max,
          ordinaryGapRawUint64: null,
          receiverPlayerId: null,
          turnoverMode: 'KEYED',
        },
      ],
    });

    expect(completed.events.map(({ payload }) => payload)).toEqual([
      { type: 'POSSESSION_STARTED', side: 'HOME' },
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
      { type: 'POSSESSION_ENDED', side: 'HOME' },
    ]);
    expect(completed.anchors).toHaveLength(2);
    expect(completed.anchors.at(-1)).toMatchObject({
      period: 1,
      periodClockSeconds: 570,
      possession: { side: 'AWAY', possessionIndex: 1, segmentIndex: 0 },
      status: 'IN_PROGRESS',
    });

    const payloadOf = (fact: (typeof completed.facts)[number]) =>
      fact.payload as Record<string, unknown>;
    const traces = completed.facts.filter((fact) => payloadOf(fact).type === 'ACTION_TRACE');
    expect(traces.map((fact) => payloadOf(fact).behaviorId)).toEqual([
      'PASS',
      'REORG',
      'PASS',
      'ADV',
      'REORG',
      'PASS',
      'ADV',
    ]);
    expect(traces.at(0)!.payload).toMatchObject({ phase: 'HALF_COURT_NORMAL' });
    expect(traces.slice(1).every((fact) => payloadOf(fact).phase === 'LATE_CLOCK')).toBe(true);
    expect(traces.some((fact) => payloadOf(fact).behaviorId === 'SPOTUP')).toBe(false);
    expect(completed.events.some(({ payload }) => payload.type === 'SHOT')).toBe(false);

    const handlers = completed.facts
      .filter((fact) => payloadOf(fact).type === 'POSSESSION_HANDLER')
      .map((fact) => payloadOf(fact).handlerPlayerId);
    expect(handlers).toEqual(['H1', 'H2', 'H3', 'H2']);
    expect(
      completed.facts.find((fact) => payloadOf(fact).type === 'SHOT_CLOCK_VIOLATION')?.payload,
    ).toMatchObject({ handlerPlayerId: 'H2' });
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
    expect(
      calculateModelBTransitionFallbackProbabilityMilli({
        offenseExecutionMilli: 65_950,
        defenseExecutionMilli: 40_000,
        elapsedTransitionDecisionSeconds: 4,
        transitionWindowSeconds: 6,
        completedTransitionOffenseActions: 1,
      }),
    ).toBe(296);
    expect(
      calculateModelBTransitionFallbackProbabilityMilli({
        offenseExecutionMilli: 65_950,
        defenseExecutionMilli: 80_000,
        elapsedTransitionDecisionSeconds: 4,
        transitionWindowSeconds: 6,
        completedTransitionOffenseActions: 1,
      }),
    ).toBe(456);
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
    const anchorByHash = new Map(
      sessions.flatMap((session) =>
        session.anchors.map((anchor) => [anchor.anchorHash, anchor] as const),
      ),
    );
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

    const stealTraces = facts.filter(
      (fact) => payloadOf(fact).type === 'ACTION_TRACE' && payloadOf(fact).behaviorId === 'STLTRY',
    );
    for (const trace of stealTraces) {
      // STLTRY only arms a candidate.  It must not fabricate a turnover before
      // TURNOVER_OCCURRENCE resolves, so an empty immediate result list is valid.
      expect(payloadOf(trace).resultEventIds).toEqual([]);
    }
    for (const steal of events.filter((event) => event.payload.type === 'STEAL')) {
      if (steal.payload.type !== 'STEAL') continue;
      const turnover = eventById.get(steal.payload.sourceEventId);
      expect(turnover?.payload).toMatchObject({
        type: 'TURNOVER',
        turnoverKind: 'PRESSURED_LIVE_BALL',
      });
      expect(
        stealTraces.some((trace) => {
          const tracePayload = payloadOf(trace);
          const traceClock = eventById.get(trace.sourceEventIds[0]!);
          return (
            Array.isArray(tracePayload.actorIds) &&
            tracePayload.actorIds.includes(steal.payload.playerId) &&
            traceClock?.period === steal.period &&
            traceClock?.possessionIndex === steal.possessionIndex
          );
        }),
      ).toBe(true);
      const turnoverIndex = events.findIndex((event) => event.eventId === turnover?.eventId);
      expect(events[turnoverIndex + 1]?.payload).toMatchObject({
        type: 'STEAL',
        playerId: steal.payload.playerId,
      });
      expect(events[turnoverIndex + 2]?.payload).toMatchObject({
        type: 'POSSESSION_ENDED',
      });
      const turnoverAnchor = anchorByHash.get(turnover?.previousAnchorHash ?? '');
      const endedPossession = events[turnoverIndex + 2];
      expect(endedPossession?.payload).toMatchObject({
        type: 'POSSESSION_ENDED',
        side: turnoverAnchor?.possession.side,
      });
      const nextAnchor = anchorByHash.get(endedPossession?.nextAnchorHash ?? '');
      expect(nextAnchor?.possession.side).toBe(
        turnoverAnchor?.possession.side === 'HOME' ? 'AWAY' : 'HOME',
      );
    }

    const transitionContexts = facts.filter(
      (fact) => payloadOf(fact).type === 'TRANSITION_CONTEXT',
    );
    const transitionTraces = facts.filter(
      (fact) =>
        payloadOf(fact).type === 'ACTION_TRACE' && payloadOf(fact).behaviorId === 'TRANSITIOND',
    );
    // A context alone is not proof that transition defense ran: the runner must
    // select and materialize TRANSITIOND after the originating rebound/turnover.
    expect(transitionTraces).not.toHaveLength(0);
    expect(transitionTraces).toHaveLength(transitionContexts.length);
    expect(
      transitionTraces.some((fact) => payloadOf(fact).resultCode === 'TRANSITION_FORMED'),
    ).toBe(true);
    expect(
      transitionTraces.some((fact) => payloadOf(fact).resultCode === 'TRANSITION_STOPPED'),
    ).toBe(true);
    expect(transitionContexts.some((fact) => payloadOf(fact).formed === true)).toBe(true);
    expect(transitionContexts.some((fact) => payloadOf(fact).formed === false)).toBe(true);
    for (const context of transitionContexts) {
      const payload = payloadOf(context);
      const supporterIds = payload.supporterIds as readonly string[];
      const retreaterIds = payload.retreaterIds as readonly string[];
      expect(Array.isArray(supporterIds)).toBe(true);
      expect(Array.isArray(retreaterIds)).toBe(true);
      expect(supporterIds).toHaveLength(2);
      expect(retreaterIds).toHaveLength(3);
      expect(new Set(supporterIds).size).toBe(supporterIds.length);
      expect(new Set(retreaterIds).size).toBe(retreaterIds.length);
      expect(supporterIds).not.toContain(payload.controllerId);
      const trace = transitionTraces.find((candidate) =>
        candidate.sourceEventIds.includes(context.sourceEventIds[0]!),
      );
      expect(trace).toBeDefined();
      expect(payloadOf(trace!).actorIds).toEqual([...retreaterIds].sort());
      expect(payloadOf(trace!).targetIds).toEqual([payload.controllerId]);
    }
    expect(
      facts.some(
        (fact) =>
          payloadOf(fact).type === 'ACTION_TRACE' && payloadOf(fact).transitionFallback === true,
      ),
    ).toBe(true);

    const transitionReorganizations = facts.filter((fact) => {
      const payload = payloadOf(fact);
      return (
        payload.type === 'ACTION_TRACE' &&
        payload.phase === 'TRANSITION' &&
        payload.behaviorId === 'REORG'
      );
    });
    // This is a runner-object regression, rather than a helper probe: every
    // REORG that actually completed during TRANSITION must leave that phase.
    expect(transitionReorganizations).not.toHaveLength(0);
    for (const trace of transitionReorganizations) {
      expect(payloadOf(trace)).toMatchObject({
        transitionFallback: true,
        transitionFallbackReason: 'REORG_COMPLETED',
      });
    }
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

  it('keeps a credited pressured turnover as the transition control origin', () => {
    const initial = createModelBSession(makeP02MatchInput());
    // commitModelBActiveSegment prefixes POSSESSION_STARTED, so the controlled
    // TURNOVER is transition event offset 2: START -> CLOCK -> TURNOVER.
    const turnoverEventId = predictModelBEventId(initial, 2, 'TURNOVER');
    const afterCreditedSteal = commitModelBActiveSegment(initial, {
      eventPayloads: [
        { type: 'CLOCK_ADVANCED', seconds: 1 },
        {
          type: 'TURNOVER',
          playerId: 'HOME-01',
          turnoverKind: 'PRESSURED_LIVE_BALL',
        },
        { type: 'STEAL', playerId: 'AWAY-01', sourceEventId: turnoverEventId },
      ],
      resolution: 'POSSESSION_CHANGE',
    });
    const completed = runToEnd(afterCreditedSteal);
    const contexts = completed.facts.filter((fact) => {
      const payload = fact.payload as Record<string, unknown>;
      return payload.type === 'TRANSITION_CONTEXT' && payload.originEventId === turnoverEventId;
    });

    expect(contexts).toHaveLength(1);
    expect(contexts[0]!.payload).toMatchObject({
      origin: 'PRESSURED_LIVE_BALL',
      originEventId: turnoverEventId,
      controllerId: 'AWAY-01',
    });
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
