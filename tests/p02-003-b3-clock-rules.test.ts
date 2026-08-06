import { describe, expect, it } from 'vitest';

import {
  ModelBWatchdogError,
  assertModelBWatchdog,
  commitModelBActiveSegment,
  commitModelBShotClockViolation,
  completeModelBPeriod,
  createModelBSession,
  deriveEventId,
  deriveFactId,
  deriveMatchAnchorHash,
  deriveMatchEventHash,
  deriveMatchFactHash,
  keyedDrawUnitInterval,
  rebuildModelBShotClockSeconds,
  type ModelBSession,
} from '../packages/domain/src/match/index.js';
import { makeP02MatchInput } from './helpers/p02-003-fixtures.js';

function playerForCurrentSide(session: ModelBSession, side: 'OFFENSE' | 'DEFENSE' = 'OFFENSE') {
  const anchor = session.anchors.at(-1)!;
  const actualSide =
    side === 'OFFENSE'
      ? anchor.possession.side
      : anchor.possession.side === 'HOME'
        ? 'AWAY'
        : 'HOME';
  const lineup = actualSide === 'HOME' ? anchor.lineups.home : anchor.lineups.away;
  return lineup.PG;
}

function runCurrentPeriodToZero(session: ModelBSession): ModelBSession {
  let current = session;
  while (current.anchors.at(-1)!.periodClockSeconds > 0) {
    const anchor = current.anchors.at(-1)!;
    const shotClock = rebuildModelBShotClockSeconds(anchor, current.events);
    const seconds = Math.min(anchor.periodClockSeconds, shotClock);
    const reachesPeriodEnd = seconds === anchor.periodClockSeconds;
    current = commitModelBActiveSegment(current, {
      eventPayloads: reachesPeriodEnd
        ? [
            { type: 'CLOCK_ADVANCED', seconds },
            {
              type: 'SHOT',
              shooterId: playerForCurrentSide(current),
              zone: 'MID_RANGE',
              made: false,
            },
          ]
        : [
            { type: 'CLOCK_ADVANCED', seconds },
            {
              type: 'TURNOVER',
              playerId: playerForCurrentSide(current),
              turnoverKind: 'UNFORCED_DEAD_BALL',
            },
          ],
      resolution: reachesPeriodEnd ? 'PERIOD_END' : 'POSSESSION_CHANGE',
    });
  }
  return current;
}

describe('P02-003 B3 clock and possession rules', () => {
  it('binds the Physical genesis and every Event, Fact and Anchor identity to one coordinate chain', () => {
    let session = createModelBSession(makeP02MatchInput({ rootSeed: 'b3-r1-identity' }));
    const genesis = session.anchors[0]!;
    expect(
      session.input.homeTeam.players.every(
        (player) => player.snapshotVersion === 'P02_MATCH_PLAYER_PHYSICAL_V1',
      ),
    ).toBe(true);
    expect(
      session.input.awayTeam.players.every(
        (player) => player.snapshotVersion === 'P02_MATCH_PLAYER_PHYSICAL_V1',
      ),
    ).toBe(true);
    expect(genesis.anchorHash).toBe(deriveMatchAnchorHash(genesis));
    expect(genesis.eventCursor).toBe(0);

    const handler = playerForCurrentSide(session);
    session = commitModelBActiveSegment(session, {
      eventPayloads: [
        { type: 'CLOCK_ADVANCED', seconds: 30 },
        { type: 'SHOT', shooterId: handler, zone: 'MID_RANGE', made: false },
      ],
      resolution: 'SAME_SIDE_DEAD_BALL',
    });
    session = commitModelBShotClockViolation(session, handler);

    for (const [index, anchor] of session.anchors.entries()) {
      expect(anchor.anchorHash).toBe(deriveMatchAnchorHash(anchor));
      expect(anchor.previousAnchorHash).toBe(
        index === 0 ? genesis.previousAnchorHash : session.anchors[index - 1]!.anchorHash,
      );
    }
    for (const event of session.events) {
      const previous = session.anchors.find(
        (anchor) => anchor.anchorHash === event.previousAnchorHash,
      )!;
      const next = session.anchors.find((anchor) => anchor.anchorHash === event.nextAnchorHash)!;
      expect(event.eventId).toBe(deriveEventId(event));
      expect(event.eventHash).toBe(deriveMatchEventHash(event));
      expect(event).toMatchObject({
        period: previous.period,
        possessionIndex: previous.possession.possessionIndex,
        segmentIndex: previous.possession.segmentIndex,
      });
      expect(event.cursor).toBeGreaterThanOrEqual(previous.eventCursor);
      expect(event.cursor).toBeLessThan(next.eventCursor);
    }
    for (const fact of session.facts) {
      expect(fact.factId).toBe(deriveFactId(fact));
      expect(fact.factHash).toBe(deriveMatchFactHash(fact));
      const source = session.events.find((event) => event.eventId === fact.sourceEventIds[0])!;
      expect(fact.payload).toMatchObject({
        period: source.period,
        possessionIndex: source.possessionIndex,
        segmentIndex: source.segmentIndex,
      });
    }
  });

  it('rebuilds the 30-second clock across same-side dead balls', () => {
    let session = createModelBSession(makeP02MatchInput());
    session = commitModelBActiveSegment(session, {
      eventPayloads: [
        { type: 'CLOCK_ADVANCED', seconds: 5 },
        { type: 'FOUL', playerId: playerForCurrentSide(session, 'DEFENSE'), foulKind: 'PERSONAL' },
      ],
      resolution: 'SAME_SIDE_DEAD_BALL',
    });
    expect(rebuildModelBShotClockSeconds(session.anchors.at(-1)!, session.events)).toBe(25);
    const possession = session.anchors.at(-1)!.possession;
    expect(possession.segmentIndex).toBe(1);
    session = commitModelBActiveSegment(session, {
      eventPayloads: [
        { type: 'CLOCK_ADVANCED', seconds: 3 },
        { type: 'FOUL', playerId: playerForCurrentSide(session, 'DEFENSE'), foulKind: 'PERSONAL' },
      ],
      resolution: 'SAME_SIDE_DEAD_BALL',
    });
    expect(rebuildModelBShotClockSeconds(session.anchors.at(-1)!, session.events)).toBe(22);
    expect(session.anchors.at(-1)!.possession).toMatchObject({
      side: possession.side,
      possessionIndex: possession.possessionIndex,
      segmentIndex: 2,
    });
  });

  it('resets to 20 after ORB and to 30 only after a side-changing possession', () => {
    let session = createModelBSession(makeP02MatchInput());
    const offense = playerForCurrentSide(session);
    session = commitModelBActiveSegment(session, {
      eventPayloads: [
        { type: 'CLOCK_ADVANCED', seconds: 7 },
        { type: 'SHOT', shooterId: offense, zone: 'INSIDE', made: false },
        { type: 'REBOUND', playerId: offense, kind: 'OFFENSIVE' },
      ],
      resolution: 'OFFENSIVE_REBOUND',
    });
    expect(rebuildModelBShotClockSeconds(session.anchors.at(-1)!, session.events)).toBe(20);
    const beforeChange = session.anchors.at(-1)!.possession;
    session = commitModelBActiveSegment(session, {
      eventPayloads: [
        { type: 'CLOCK_ADVANCED', seconds: 2 },
        { type: 'SHOT', shooterId: playerForCurrentSide(session), zone: 'INSIDE', made: false },
        {
          type: 'REBOUND',
          playerId: playerForCurrentSide(session, 'DEFENSE'),
          kind: 'DEFENSIVE',
        },
      ],
      resolution: 'POSSESSION_CHANGE',
    });
    const afterChange = session.anchors.at(-1)!;
    expect(afterChange.possession.possessionIndex).toBe(beforeChange.possessionIndex + 1);
    expect(afterChange.possession.segmentIndex).toBe(0);
    expect(rebuildModelBShotClockSeconds(afterChange, session.events)).toBe(30);
  });

  it('turns a zero shot clock into an unforced player turnover with no steal', () => {
    let session = createModelBSession(makeP02MatchInput());
    const handler = playerForCurrentSide(session);
    session = commitModelBActiveSegment(session, {
      eventPayloads: [
        { type: 'CLOCK_ADVANCED', seconds: 30 },
        { type: 'SHOT', shooterId: handler, zone: 'MID_RANGE', made: false },
      ],
      resolution: 'SAME_SIDE_DEAD_BALL',
    });
    expect(rebuildModelBShotClockSeconds(session.anchors.at(-1)!, session.events)).toBe(0);
    session = commitModelBShotClockViolation(session, handler);
    expect(session.events.at(-2)!.payload).toEqual({
      type: 'TURNOVER',
      playerId: handler,
      turnoverKind: 'UNFORCED_DEAD_BALL',
    });
    expect(session.events.some(({ eventType }) => eventType === 'STEAL')).toBe(false);
    expect(rebuildModelBShotClockSeconds(session.anchors.at(-1)!, session.events)).toBe(30);
  });

  it('requires every live segment to consume time and never substitutes a watchdog result', () => {
    const session = createModelBSession(makeP02MatchInput());
    expect(() =>
      commitModelBActiveSegment(session, {
        eventPayloads: [
          { type: 'SHOT', shooterId: playerForCurrentSide(session), zone: 'INSIDE', made: true },
        ],
        resolution: 'POSSESSION_CHANGE',
      }),
    ).toThrow(/at least one second/);
    expect(() => assertModelBWatchdog(101, 100)).toThrow(ModelBWatchdogError);
    expect(session.anchors.at(-1)!.status).toBe('IN_PROGRESS');
    expect(session.events).toHaveLength(0);
  });

  it('orders period end events and applies the Q2-Q4 alternating arrow', () => {
    let session = createModelBSession(makeP02MatchInput());
    const openingSide = session.anchors[0]!.possession.side;
    session = completeModelBPeriod(runCurrentPeriodToZero(session));
    expect(session.anchors.at(-1)).toMatchObject({
      period: 2,
      periodClockSeconds: 600,
      possession: { side: openingSide === 'HOME' ? 'AWAY' : 'HOME', segmentIndex: 0 },
    });
    expect(session.events.slice(-2).map(({ eventType }) => eventType)).toEqual([
      'POSSESSION_ENDED',
      'PERIOD_COMPLETED',
    ]);
  });

  it('continues tied official/friendly games into 300-second OT but ends tied scrimmages', () => {
    let official = createModelBSession(makeP02MatchInput({ matchKind: 'OFFICIAL' }));
    let scrimmage = createModelBSession(makeP02MatchInput({ matchKind: 'SCRIMMAGE' }));
    for (let period = 1; period <= 4; period += 1) {
      official = completeModelBPeriod(runCurrentPeriodToZero(official));
      scrimmage = completeModelBPeriod(runCurrentPeriodToZero(scrimmage));
    }
    expect(official.anchors.at(-1)).toMatchObject({
      period: 5,
      periodClockSeconds: 300,
      status: 'IN_PROGRESS',
      possession: {
        side:
          keyedDrawUnitInterval({
            matchSeed: official.input.matchSeed,
            period: 5,
            possessionIndex: 0,
            segmentIndex: 0,
            drawKind: 'BALL_HANDLER',
            localIndex: 0,
          }) < 0.5
            ? 'HOME'
            : 'AWAY',
      },
    });
    expect(scrimmage.anchors.at(-1)!.status).toBe('COMPLETED');
    expect(scrimmage.events.slice(-3).map(({ eventType }) => eventType)).toEqual([
      'POSSESSION_ENDED',
      'PERIOD_COMPLETED',
      'MATCH_COMPLETED',
    ]);
  });
});
