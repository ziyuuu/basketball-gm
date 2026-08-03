import { describe, expect, it } from 'vitest';

import {
  MatchAnchorSchema,
  MatchEventSchema,
  MatchFactSchema,
  MODEL_B_RULES_CONTENT_HASH,
  assertModelBSessionInvariants,
  buildModelBTranscript,
  commitModelBAutomatedDecision,
  commitModelBTransition,
  createModelBSession,
  deriveMatchEventHash,
} from '../packages/domain/src/match/index.js';
import { makeP02MatchInput } from './helpers/p02-003-fixtures.js';

describe('P02-003 B2 atomic MatchSession skeleton', () => {
  it('creates a deterministic genesis Anchor with zero event-derived score and stats', () => {
    const input = makeP02MatchInput();
    const first = createModelBSession(input);
    const second = createModelBSession(input);
    expect(first).toEqual(second);
    expect(first.anchors).toHaveLength(1);
    expect(() => MatchAnchorSchema.parse(first.anchors[0])).not.toThrow();
    expect(first.anchors[0]).toMatchObject({
      score: { home: 0, away: 0 },
      eventCursor: 0,
      transcriptCursor: 0,
      localRevision: 0,
      status: 'IN_PROGRESS',
    });
    expect(first.anchors[0]!.boxScore.home.players).toHaveLength(12);
    expect(first.anchors[0]!.boxScore.away.players).toHaveLength(12);
    expect(first.anchors[0]!.boxScore.home.players.every(({ points }) => points === 0)).toBe(true);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.anchors[0])).toBe(true);
  });

  it('commits event identities, facts, score, clock and box score as one atomic transition', () => {
    const session = createModelBSession(makeP02MatchInput());
    const anchor = session.anchors[0]!;
    const side = anchor.possession.side;
    const team = side === 'HOME' ? session.input.homeTeam : session.input.awayTeam;
    const shooterId = team.startingLineup.PG;
    const next = commitModelBTransition(session, {
      eventPayloads: [
        { type: 'POSSESSION_STARTED', side },
        { type: 'CLOCK_ADVANCED', seconds: 5 },
        { type: 'SHOT', shooterId, zone: 'THREE_POINT', made: true },
        { type: 'SCORE', side, playerId: shooterId, points: 3 },
      ],
      facts: [
        {
          factKind: 'STATISTICAL',
          sourceEventIndexes: [1],
          payload: {
            type: 'POSSESSION_HANDLER',
            handlerPlayerId: shooterId,
            period: 1,
            possessionIndex: 0,
            segmentIndex: 0,
          },
        },
      ],
    });
    expect(next.anchors).toHaveLength(2);
    expect(next.events).toHaveLength(4);
    expect(next.facts).toHaveLength(1);
    expect(next.events.every((event) => MatchEventSchema.safeParse(event).success)).toBe(true);
    expect(next.facts.every((fact) => MatchFactSchema.safeParse(fact).success)).toBe(true);
    expect(next.events.map(({ cursor }) => cursor)).toEqual([0, 1, 2, 3]);
    expect(next.events.map(({ localEventSequence }) => localEventSequence)).toEqual([0, 1, 2, 3]);
    expect(
      next.events.every(({ previousAnchorHash }) => previousAnchorHash === anchor.anchorHash),
    ).toBe(true);
    expect(
      next.events.every(({ nextAnchorHash }) => nextAnchorHash === next.anchors.at(-1)!.anchorHash),
    ).toBe(true);
    const final = next.anchors.at(-1)!;
    expect(final.score[side === 'HOME' ? 'home' : 'away']).toBe(3);
    expect(final.periodClockSeconds).toBe(595);
    const shooter = final.boxScore[side === 'HOME' ? 'home' : 'away'].players.find(
      ({ playerId }) => playerId === shooterId,
    )!;
    expect(shooter).toMatchObject({
      secondsPlayed: 5,
      points: 3,
      fieldGoalsMade: 1,
      fieldGoalsAttempted: 1,
      threePointersMade: 1,
      threePointersAttempted: 1,
    });
    expect(next.facts[0]!.sourceEventIds).toEqual([next.events[1]!.eventId]);
  });

  it('constructs a closed automated transcript transition without consuming events', () => {
    const session = createModelBSession(makeP02MatchInput());
    const previous = session.anchors.at(-1)!;
    const fragment = {
      ...previous.effectiveFragment,
      tactics: {
        ...previous.effectiveFragment.tactics,
        away: { ...previous.effectiveFragment.tactics.away, pace: 'FAST' as const },
      },
    };
    const next = commitModelBAutomatedDecision(session, {
      actor: 'OPPONENT',
      policyId: 'model-b-opponent-baseline-v1',
      policyInputHash: MODEL_B_RULES_CONTENT_HASH,
      effectiveFragment: fragment,
    });
    expect(next.events).toHaveLength(0);
    expect(next.anchors).toHaveLength(2);
    expect(next.transcriptEntries).toHaveLength(1);
    expect(next.anchors.at(-1)).toMatchObject({ transcriptCursor: 1, localRevision: 1 });
    expect(buildModelBTranscript(next).entries).toEqual(next.transcriptEntries);
  });

  it('discards an illegal event draft without mutating committed session state', () => {
    const session = createModelBSession(makeP02MatchInput());
    const snapshot = JSON.stringify(session);
    expect(() =>
      commitModelBTransition(session, {
        eventPayloads: [
          { type: 'TURNOVER', playerId: 'NOT-REGISTERED', turnoverKind: 'UNFORCED_DEAD_BALL' },
        ],
      }),
    ).toThrow(/not registered/);
    expect(JSON.stringify(session)).toBe(snapshot);
    expect(session.events).toHaveLength(0);
    expect(session.anchors).toHaveLength(1);
  });

  it('discards facts with invalid local event references without partial commit', () => {
    const session = createModelBSession(makeP02MatchInput());
    const snapshot = JSON.stringify(session);
    expect(() =>
      commitModelBTransition(session, {
        eventPayloads: [{ type: 'CLOCK_ADVANCED', seconds: 1 }],
        facts: [{ factKind: 'EXPLANATION', sourceEventIndexes: [1], payload: { type: 'INVALID' } }],
      }),
    ).toThrow(/source event index/);
    expect(JSON.stringify(session)).toBe(snapshot);
  });

  it('does not expose any direct score or box-score patch in a transition', () => {
    const session = createModelBSession(makeP02MatchInput());
    const next = commitModelBTransition(session, {
      eventPayloads: [{ type: 'CLOCK_ADVANCED', seconds: 1 }],
    });
    expect(next.anchors.at(-1)!.score).toEqual({ home: 0, away: 0 });
    expect(next.anchors.at(-1)!.boxScore.home.players.every(({ points }) => points === 0)).toBe(
      true,
    );
  });

  it('rejects a session whose otherwise valid event points across a non-adjacent Anchor', () => {
    const start = createModelBSession(makeP02MatchInput());
    const first = commitModelBTransition(start, {
      eventPayloads: [{ type: 'CLOCK_ADVANCED', seconds: 1 }],
    });
    const second = commitModelBTransition(first, {
      eventPayloads: [{ type: 'CLOCK_ADVANCED', seconds: 1 }],
      nextPossession: {
        ...first.anchors.at(-1)!.possession,
        segmentIndex: first.anchors.at(-1)!.possession.segmentIndex + 1,
      },
    });
    const movedEvent = {
      ...second.events[1]!,
      previousAnchorHash: second.anchors[0]!.anchorHash,
    };
    movedEvent.eventHash = deriveMatchEventHash(movedEvent);
    const broken = {
      ...second,
      events: [second.events[0]!, movedEvent],
    };
    expect(() => assertModelBSessionInvariants(broken)).toThrow();
  });
});
