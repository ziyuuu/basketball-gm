import { describe, expect, it } from 'vitest';

import {
  assertModelBSessionInvariants,
  buildModelBCreationFactDraft,
  buildModelBDefensiveFoulResolution,
  buildModelBFreeThrowResolution,
  buildModelBOffensiveFoulResolution,
  buildModelBPassResolution,
  buildModelBPossessionHandlerFactDraft,
  buildModelBReboundResolution,
  buildModelBShotResolution,
  buildModelBTeamReboundFactDraft,
  buildModelBTurnoverResolution,
  commitModelBTransition,
  createModelBSession,
  predictModelBEventId,
  type ModelBReboundCandidate,
  type ModelBSession,
} from '../packages/domain/src/match/index.js';
import { makeP02MatchInput } from './helpers/p02-003-fixtures.js';

function currentSides(session: ModelBSession) {
  const offenseSide = session.anchors.at(-1)!.possession.side;
  return {
    offenseSide,
    defenseSide: offenseSide === 'HOME' ? ('AWAY' as const) : ('HOME' as const),
    offense: offenseSide === 'HOME' ? session.input.homeTeam : session.input.awayTeam,
    defense: offenseSide === 'HOME' ? session.input.awayTeam : session.input.homeTeam,
  };
}

function playerStats(session: ModelBSession, side: 'HOME' | 'AWAY', playerId: string) {
  const box = session.anchors.at(-1)!.boxScore[side === 'HOME' ? 'home' : 'away'];
  return box.players.find((player) => player.playerId === playerId)!;
}

function reboundCandidate(
  player: ModelBSession['input']['homeTeam']['players'][number],
  personalReboundExecutionMilli: number,
): ModelBReboundCandidate {
  return { player, personalReboundExecutionMilli };
}

describe('P02-003 B5 basketball result, fact and statistic chains', () => {
  it('commits a made field goal, score and at most one assist from one shot source', () => {
    const session = createModelBSession(makeP02MatchInput());
    const { offenseSide, offense } = currentSides(session);
    const shooterId = offense.players[0]!.playerId;
    const passerId = offense.players[1]!.playerId;
    const pass = buildModelBPassResolution(session, {
      transitionEventOffset: 0,
      seconds: 1,
      behaviorId: 'PASS',
      behaviorSelectionOrdinal: 0,
      passSequence: 0,
      passerId,
      receiverId: shooterId,
      turnoverProbabilityMilli: 0,
      pressuredClassificationProbabilityMilli: 0,
    });
    const shot = buildModelBShotResolution(session, {
      transitionEventOffset: pass.eventPayloads.length,
      shooterId,
      zone: 'THREE_POINT',
      shotInstanceIndex: 0,
      makeProbabilityMilli: 1_000,
      assistCandidate: { playerId: passerId, attributionProbabilityMilli: 1_000 },
    });

    expect(shot.eventPayloads.map(({ type }) => type)).toEqual(['SHOT', 'SCORE', 'ASSIST']);
    expect(shot.drawKeys.map(({ drawKind }) => drawKind)).toEqual(['SHOT', 'ASSIST_ATTRIBUTION']);
    const next = commitModelBTransition(session, {
      eventPayloads: [...pass.eventPayloads, ...shot.eventPayloads],
      facts: pass.facts,
    });

    expect(next.anchors.at(-1)!.score[offenseSide === 'HOME' ? 'home' : 'away']).toBe(3);
    expect(playerStats(next, offenseSide, shooterId)).toMatchObject({
      points: 3,
      fieldGoalsMade: 1,
      fieldGoalsAttempted: 1,
      threePointersMade: 1,
      threePointersAttempted: 1,
    });
    expect(playerStats(next, offenseSide, passerId).assists).toBe(1);
    expect(next.events.at(-1)!.payload).toMatchObject({ sourceEventId: shot.shotEventId });
    expect(() => assertModelBSessionInvariants(next)).not.toThrow();
  });

  it('keeps a block as attribution on a miss and resolves one stable rebound draw', () => {
    const session = createModelBSession(makeP02MatchInput());
    const { offenseSide, defenseSide, offense, defense } = currentSides(session);
    const shooterId = offense.players[0]!.playerId;
    const blockerId = defense.players[0]!.playerId;
    const shot = buildModelBShotResolution(session, {
      transitionEventOffset: 1,
      shooterId,
      zone: 'INSIDE',
      shotInstanceIndex: 0,
      makeProbabilityMilli: 0,
      blockCandidate: { playerId: blockerId, attributionProbabilityMilli: 1_000 },
    });
    const offenseCandidates = [
      reboundCandidate(offense.players[0]!, 48_000),
      reboundCandidate(offense.players[1]!, 52_000),
    ];
    const defenseCandidates = [
      reboundCandidate(defense.players[0]!, 60_000),
      reboundCandidate(defense.players[1]!, 50_000),
    ];
    const rebound = buildModelBReboundResolution(session, {
      transitionEventOffset: 1 + shot.eventPayloads.length,
      reboundInstanceIndex: 0,
      offensiveReboundProbabilityMilli: 0,
      offensiveCandidates: offenseCandidates,
      defensiveCandidates: defenseCandidates,
    });
    const reordered = buildModelBReboundResolution(session, {
      transitionEventOffset: 1 + shot.eventPayloads.length,
      reboundInstanceIndex: 0,
      offensiveReboundProbabilityMilli: 0,
      offensiveCandidates: [...offenseCandidates].reverse(),
      defensiveCandidates: [...defenseCandidates].reverse(),
    });

    expect(rebound).toEqual(reordered);
    expect(rebound.drawKeys).toHaveLength(1);
    expect(rebound.drawKeys[0]!.drawKind).toBe('REBOUND');
    expect(rebound.boxerId).toBe(blockerId);
    const next = commitModelBTransition(session, {
      eventPayloads: [
        { type: 'CLOCK_ADVANCED', seconds: 2 },
        ...shot.eventPayloads,
        ...rebound.eventPayloads,
      ],
    });
    expect(playerStats(next, offenseSide, shooterId).fieldGoalsMade).toBe(0);
    expect(playerStats(next, defenseSide, blockerId).blocks).toBe(1);
    expect(playerStats(next, defenseSide, rebound.rebounderId).defensiveRebounds).toBe(1);
    expect(() => assertModelBSessionInvariants(next)).not.toThrow();
  });

  it('uses the single PASS turnover result chain and only records successful passes as facts', () => {
    const successSession = createModelBSession(makeP02MatchInput());
    const successSides = currentSides(successSession);
    const passerId = successSides.offense.players[0]!.playerId;
    const receiverId = successSides.offense.players[1]!.playerId;
    const success = buildModelBPassResolution(successSession, {
      transitionEventOffset: 0,
      seconds: 1,
      behaviorId: 'PASS',
      behaviorSelectionOrdinal: 7,
      passSequence: 0,
      passerId,
      receiverId,
      turnoverProbabilityMilli: 0,
      pressuredClassificationProbabilityMilli: 1_000,
    });
    expect(success.drawKeys).toEqual([success.behaviorResultDrawKey]);
    expect(success.behaviorResultDrawKey).toMatchObject({
      drawKind: 'TURNOVER_OCCURRENCE',
      localIndex: 2_007,
    });
    expect(success.nextHandlerPlayerId).toBe(receiverId);
    const passed = commitModelBTransition(successSession, {
      eventPayloads: success.eventPayloads,
      facts: success.facts,
    });
    expect(passed.facts[0]!.payload).toMatchObject({
      type: 'PASS',
      passerId,
      receiverId,
      sequence: 0,
    });
    expect(passed.events.some(({ eventType }) => eventType === 'ASSIST')).toBe(false);
    expect(() => assertModelBSessionInvariants(passed)).not.toThrow();

    const failureSession = createModelBSession(makeP02MatchInput({ rootSeed: 'pass-failure' }));
    const failureSides = currentSides(failureSession);
    const failedPasserId = failureSides.offense.players[0]!.playerId;
    const stealerId = failureSides.defense.players[0]!.playerId;
    const failure = buildModelBPassResolution(failureSession, {
      transitionEventOffset: 0,
      seconds: 1,
      behaviorId: 'HELDKICK',
      behaviorSelectionOrdinal: 7,
      passSequence: 0,
      passerId: failedPasserId,
      receiverId: failureSides.offense.players[1]!.playerId,
      turnoverProbabilityMilli: 1_000,
      pressuredClassificationProbabilityMilli: 1_000,
      stealCandidate: { playerId: stealerId, attributionProbabilityMilli: 1_000 },
    });
    expect(failure.eventPayloads.map(({ type }) => type)).toEqual([
      'CLOCK_ADVANCED',
      'TURNOVER',
      'STEAL',
    ]);
    expect(failure.facts).toHaveLength(0);
    expect(failure.drawKeys.map(({ drawKind }) => drawKind)).toEqual([
      'TURNOVER_OCCURRENCE',
      'TURNOVER_CLASSIFICATION',
      'STEAL_ATTRIBUTION',
    ]);
    const failed = commitModelBTransition(failureSession, {
      eventPayloads: failure.eventPayloads,
    });
    expect(playerStats(failed, failureSides.offenseSide, failedPasserId).turnovers).toBe(1);
    expect(playerStats(failed, failureSides.defenseSide, stealerId).steals).toBe(1);
    expect(() => assertModelBSessionInvariants(failed)).not.toThrow();
  });

  it('resolves non-pass unforced turnovers without a steal attribution draw', () => {
    const session = createModelBSession(makeP02MatchInput({ rootSeed: 'unforced-turnover' }));
    const { offenseSide, offense, defense } = currentSides(session);
    const handlerPlayerId = offense.players[0]!.playerId;
    const turnover = buildModelBTurnoverResolution(session, {
      transitionEventOffset: 1,
      handlerPlayerId,
      behaviorSelectionOrdinal: 2,
      occurrenceProbabilityMilli: 1_000,
      pressuredClassificationProbabilityMilli: 0,
      stealCandidate: {
        playerId: defense.players[0]!.playerId,
        attributionProbabilityMilli: 1_000,
      },
    });
    expect(turnover.turnoverKind).toBe('UNFORCED_DEAD_BALL');
    expect(turnover.drawKeys.map(({ drawKind }) => drawKind)).toEqual([
      'TURNOVER_OCCURRENCE',
      'TURNOVER_CLASSIFICATION',
    ]);
    const next = commitModelBTransition(session, {
      eventPayloads: [{ type: 'CLOCK_ADVANCED', seconds: 1 }, ...turnover.eventPayloads],
    });
    expect(playerStats(next, offenseSide, handlerPlayerId).turnovers).toBe(1);
    expect(next.events.some(({ eventType }) => eventType === 'STEAL')).toBe(false);
  });

  it('uses SHOT 5000..5999 for a fixed free-throw sequence and derives all points from events', () => {
    const session = createModelBSession(makeP02MatchInput({ rootSeed: 'free-throws' }));
    const { offenseSide, offense } = currentSides(session);
    const shooterId = offense.players[0]!.playerId;
    const freeThrows = buildModelBFreeThrowResolution(session, {
      transitionEventOffset: 0,
      shooterId,
      attempts: 3,
      shootingMilli: 50_000,
      fatiguePenaltyMilli: 0,
    });
    expect(freeThrows.drawKeys.map(({ localIndex }) => localIndex)).toEqual([5_000, 5_001, 5_002]);
    const next = commitModelBTransition(session, { eventPayloads: freeThrows.eventPayloads });
    expect(playerStats(next, offenseSide, shooterId)).toMatchObject({
      points: freeThrows.made,
      freeThrowsMade: freeThrows.made,
      freeThrowsAttempted: 3,
    });
    expect(() => assertModelBSessionInvariants(next)).not.toThrow();
  });

  it('classifies fouls only after occurrence and pairs every offensive foul with one turnover', () => {
    const session = createModelBSession(makeP02MatchInput({ rootSeed: 'fouls' }));
    const { offenseSide, defenseSide, offense, defense } = currentSides(session);
    const offensive = buildModelBOffensiveFoulResolution(session, {
      transitionEventOffset: 1,
      playerId: offense.players[0]!.playerId,
      behaviorSelectionOrdinal: 3,
      occurrenceProbabilityMilli: 1_000,
    });
    expect(offensive.eventPayloads.map(({ type }) => type)).toEqual(['FOUL', 'TURNOVER']);
    expect(offensive.drawKeys.map(({ drawKind }) => drawKind)).toEqual([
      'OFFENSIVE_FOUL',
      'FOUL_TYPE',
    ]);
    const committed = commitModelBTransition(session, {
      eventPayloads: [{ type: 'CLOCK_ADVANCED', seconds: 1 }, ...offensive.eventPayloads],
    });
    expect(playerStats(committed, offenseSide, offense.players[0]!.playerId)).toMatchObject({
      personalFouls: 1,
      turnovers: 1,
    });

    const absent = buildModelBDefensiveFoulResolution(session, {
      transitionEventOffset: 1,
      defenderId: defense.players[0]!.playerId,
      behaviorSelectionOrdinal: 4,
      occurrenceProbabilityMilli: 0,
      shootingContext: null,
    });
    expect(absent.drawKeys.map(({ drawKind }) => drawKind)).toEqual(['DEFENSIVE_FOUL']);
    expect(absent.eventPayloads).toHaveLength(0);

    const shooting = buildModelBDefensiveFoulResolution(session, {
      transitionEventOffset: 1,
      defenderId: defense.players[0]!.playerId,
      behaviorSelectionOrdinal: 5,
      occurrenceProbabilityMilli: 1_000,
      shootingContext: { zone: 'THREE_POINT', made: false },
    });
    expect(shooting.freeThrowAttempts).toBe(3);
    const fouled = commitModelBTransition(session, {
      eventPayloads: [{ type: 'CLOCK_ADVANCED', seconds: 1 }, ...shooting.eventPayloads],
    });
    expect(playerStats(fouled, defenseSide, defense.players[0]!.playerId).personalFouls).toBe(1);
  });

  it('commits Creation, handler and team-rebound facts without inventing personal statistics', () => {
    const session = createModelBSession(makeP02MatchInput({ rootSeed: 'facts' }));
    const { offenseSide, defenseSide, offense } = currentSides(session);
    const creatorId = offense.players[0]!.playerId;
    const beneficiaryId = offense.players[1]!.playerId;
    const created = commitModelBTransition(session, {
      eventPayloads: [{ type: 'CLOCK_ADVANCED', seconds: 1 }],
      facts: [
        buildModelBPossessionHandlerFactDraft({
          sourceEventIndexes: [0],
          handlerPlayerId: creatorId,
          period: 1,
          possessionIndex: 0,
          segmentIndex: 0,
        }),
        buildModelBCreationFactDraft({
          sourceEventIndexes: [0],
          creatorId,
          beneficiaryId,
          behaviorId: 'DRIVE',
          opportunityQualityDelta: 6_000,
          defensiveResponse: 'COLLAPSED',
          period: 1,
          possessionIndex: 0,
          segmentIndex: 0,
          nextBehaviorId: 'LAYUP',
        }),
      ],
    });
    expect(created.facts.map(({ factKind }) => factKind)).toEqual(['STATISTICAL', 'EXPLANATION']);
    expect(() => assertModelBSessionInvariants(created)).not.toThrow();

    const missSession = createModelBSession(makeP02MatchInput({ rootSeed: 'team-rebound' }));
    const missSides = currentSides(missSession);
    const shooterId = missSides.offense.players[0]!.playerId;
    const teamRebound = commitModelBTransition(missSession, {
      eventPayloads: [
        { type: 'CLOCK_ADVANCED', seconds: 1 },
        { type: 'SHOT', shooterId, zone: 'MID_RANGE', made: false },
      ],
      facts: [
        buildModelBTeamReboundFactDraft({
          sourceEventIndexes: [1],
          awardedSide: missSides.defenseSide,
          period: 1,
          possessionIndex: 0,
          segmentIndex: 0,
        }),
      ],
    });
    expect(
      teamRebound.anchors
        .at(-1)!
        .boxScore[missSides.defenseSide === 'HOME' ? 'home' : 'away'].players.reduce(
          (sum, player) => sum + player.defensiveRebounds,
          0,
        ),
    ).toBe(0);
    expect(teamRebound.events.some(({ eventType }) => eventType === 'REBOUND')).toBe(false);
    expect(() => assertModelBSessionInvariants(teamRebound)).not.toThrow();
    expect(playerStats(created, offenseSide, creatorId).points).toBe(0);
    expect(defenseSide).not.toBe(offenseSide);
  });

  it('clears an assist candidate when the receiver performs a later autonomous creation', () => {
    const session = createModelBSession(makeP02MatchInput({ rootSeed: 'assist-cleared' }));
    const { offenseSide, offense } = currentSides(session);
    const passerId = offense.players[0]!.playerId;
    const shooterId = offense.players[1]!.playerId;
    const pass = buildModelBPassResolution(session, {
      transitionEventOffset: 0,
      seconds: 1,
      behaviorId: 'PASS',
      behaviorSelectionOrdinal: 0,
      passSequence: 0,
      passerId,
      receiverId: shooterId,
      turnoverProbabilityMilli: 0,
      pressuredClassificationProbabilityMilli: 0,
    });
    const shot = buildModelBShotResolution(session, {
      transitionEventOffset: 2,
      shooterId,
      zone: 'INSIDE',
      shotInstanceIndex: 0,
      makeProbabilityMilli: 1_000,
      assistCandidate: { playerId: passerId, attributionProbabilityMilli: 1_000 },
    });
    expect(() =>
      commitModelBTransition(session, {
        eventPayloads: [
          ...pass.eventPayloads,
          { type: 'CLOCK_ADVANCED', seconds: 1 },
          ...shot.eventPayloads,
        ],
        facts: [
          ...pass.facts,
          buildModelBCreationFactDraft({
            sourceEventIndexes: [1],
            creatorId: shooterId,
            beneficiaryId: shooterId,
            behaviorId: 'DRIVE',
            opportunityQualityDelta: 6_000,
            defensiveResponse: 'CONTESTED',
            period: 1,
            possessionIndex: 0,
            segmentIndex: 0,
            nextBehaviorId: 'LAYUP',
          }),
        ],
      }),
    ).toThrow(/autonomous/);
    expect(session.anchors.at(-1)!.score[offenseSide === 'HOME' ? 'home' : 'away']).toBe(0);
  });

  it('rejects malformed fact attribution atomically and enforces the CreationFact event cap', () => {
    const session = createModelBSession(makeP02MatchInput({ rootSeed: 'bad-facts' }));
    const { offenseSide, defenseSide, offense, defense } = currentSides(session);
    const snapshot = JSON.stringify(session);
    expect(() =>
      buildModelBCreationFactDraft({
        sourceEventIndexes: [0],
        creatorId: offense.players[0]!.playerId,
        beneficiaryId: offense.players[1]!.playerId,
        behaviorId: 'DRIVE',
        opportunityQualityDelta: 6_001,
        defensiveResponse: 'NONE',
        period: 1,
        possessionIndex: 0,
        segmentIndex: 0,
        nextBehaviorId: 'LAYUP',
      }),
    ).toThrow(/capped/);
    expect(() =>
      commitModelBTransition(session, {
        eventPayloads: [{ type: 'CLOCK_ADVANCED', seconds: 1 }],
        facts: [
          buildModelBCreationFactDraft({
            sourceEventIndexes: [0],
            creatorId: defense.players[0]!.playerId,
            beneficiaryId: offense.players[1]!.playerId,
            behaviorId: 'DRIVE',
            opportunityQualityDelta: 1_000,
            defensiveResponse: 'NONE',
            period: 1,
            possessionIndex: 0,
            segmentIndex: 0,
            nextBehaviorId: 'LAYUP',
          }),
        ],
      }),
    ).toThrow(/possession side/);
    expect(() =>
      commitModelBTransition(session, {
        eventPayloads: [
          { type: 'CLOCK_ADVANCED', seconds: 1 },
          {
            type: 'SHOT',
            shooterId: offense.players[0]!.playerId,
            zone: 'MID_RANGE',
            made: false,
          },
        ],
        facts: [
          buildModelBTeamReboundFactDraft({
            sourceEventIndexes: [1],
            awardedSide: offenseSide,
            period: 1,
            possessionIndex: 0,
            segmentIndex: 0,
          }),
        ],
      }),
    ).toThrow(/TEAM_REBOUND|Team rebound|team rebound/i);
    expect(JSON.stringify(session)).toBe(snapshot);
    expect(defenseSide).not.toBe(offenseSide);
  });

  it('rejects impossible score, assist, steal, block and offensive-foul chains atomically', () => {
    const session = createModelBSession(makeP02MatchInput({ rootSeed: 'bad-causality' }));
    const { offenseSide, offense, defense } = currentSides(session);
    const shooterId = offense.players[0]!.playerId;
    const snapshot = JSON.stringify(session);
    expect(() =>
      commitModelBTransition(session, {
        eventPayloads: [
          { type: 'CLOCK_ADVANCED', seconds: 1 },
          { type: 'SHOT', shooterId, zone: 'INSIDE', made: true },
        ],
      }),
    ).toThrow();

    const shotId = predictModelBEventId(session, 1, 'SHOT');
    expect(() =>
      commitModelBTransition(session, {
        eventPayloads: [
          { type: 'CLOCK_ADVANCED', seconds: 1 },
          { type: 'SHOT', shooterId, zone: 'INSIDE', made: true },
          { type: 'SCORE', side: offenseSide, playerId: shooterId, points: 2 },
          { type: 'ASSIST', playerId: shooterId, sourceEventId: shotId },
        ],
      }),
    ).toThrow(/ASSIST/);
    expect(() =>
      commitModelBTransition(session, {
        eventPayloads: [
          { type: 'CLOCK_ADVANCED', seconds: 1 },
          { type: 'SHOT', shooterId, zone: 'INSIDE', made: true },
          { type: 'SCORE', side: offenseSide, playerId: shooterId, points: 2 },
          {
            type: 'ASSIST',
            playerId: offense.players[1]!.playerId,
            sourceEventId: shotId,
          },
        ],
      }),
    ).toThrow(/last legal pass/);

    const turnoverId = predictModelBEventId(session, 1, 'TURNOVER');
    expect(() =>
      commitModelBTransition(session, {
        eventPayloads: [
          { type: 'CLOCK_ADVANCED', seconds: 1 },
          { type: 'TURNOVER', playerId: shooterId, turnoverKind: 'UNFORCED_DEAD_BALL' },
          {
            type: 'STEAL',
            playerId: defense.players[0]!.playerId,
            sourceEventId: turnoverId,
          },
        ],
      }),
    ).toThrow(/STEAL/);

    expect(() =>
      commitModelBTransition(session, {
        eventPayloads: [
          { type: 'CLOCK_ADVANCED', seconds: 1 },
          { type: 'SHOT', shooterId, zone: 'THREE_POINT', made: false },
          { type: 'BLOCK', playerId: defense.players[0]!.playerId, sourceEventId: shotId },
        ],
      }),
    ).toThrow(/BLOCK/);

    expect(() =>
      commitModelBTransition(session, {
        eventPayloads: [
          { type: 'CLOCK_ADVANCED', seconds: 1 },
          { type: 'FOUL', playerId: shooterId, foulKind: 'OFFENSIVE' },
        ],
      }),
    ).toThrow(/offensive foul/i);
    expect(() =>
      commitModelBTransition(session, {
        eventPayloads: [
          { type: 'CLOCK_ADVANCED', seconds: 1 },
          { type: 'TURNOVER', playerId: shooterId, turnoverKind: 'OFFENSIVE_FOUL' },
        ],
      }),
    ).toThrow(/offensive foul/i);
    expect(JSON.stringify(session)).toBe(snapshot);
  });
});
