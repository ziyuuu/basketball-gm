import { describe, expect, it } from 'vitest';

import {
  assertModelBSessionInvariants,
  buildModelBCreationFactDraft,
  buildModelBDefensiveActionFactDraft,
  buildModelBDefensiveFoulResolution,
  buildModelBFreeThrowResolution,
  buildModelBHelpDefenseResolution,
  buildModelBOffensiveFoulResolution,
  buildModelBPassResolution,
  buildModelBPossessionHandlerFactDraft,
  buildModelBReboundResolution,
  buildModelBShotResolution,
  buildModelBTeamReboundFactDraft,
  buildModelBTurnoverResolution,
  calculateModelBDefensiveBreakdownMetrics,
  calculateModelBOpportunityLedger,
  calculateModelBTacticExecutionMetrics,
  commitModelBActiveSegment,
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
      stealAttributionProbabilityMilli: 1_000,
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
      stealAttributionProbabilityMilli: 1_000,
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
      stealAttributionProbabilityMilli: 1_000,
    });
    expect(failure.eventPayloads.map(({ type }) => type)).toEqual([
      'CLOCK_ADVANCED',
      'TURNOVER',
      'STEAL',
    ]);
    expect(failure.stealCandidateId).toBe(stealerId);
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

  it('preserves the last-pass assist candidate across receiver CreationFact', () => {
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
      stealAttributionProbabilityMilli: 1_000,
    });
    const shot = buildModelBShotResolution(session, {
      transitionEventOffset: 2,
      shooterId,
      zone: 'INSIDE',
      shotInstanceIndex: 0,
      makeProbabilityMilli: 1_000,
      assistCandidate: { playerId: passerId, attributionProbabilityMilli: 1_000 },
    });
    const committed = commitModelBTransition(session, {
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
    });
    expect(playerStats(committed, offenseSide, passerId).assists).toBe(1);
    expect(committed.facts.some((fact) => fact.payload.type === 'CREATION')).toBe(true);
  });

  it('resolves HELPD only as SUCCESS/-6000 or NO_EFFECT/0 and never clears an assist', () => {
    const session = createModelBSession(makeP02MatchInput({ rootSeed: 'helpd-success' }));
    const { offenseSide, defenseSide, offense, defense } = currentSides(session);
    const anchor = session.anchors.at(-1)!;
    const passerId = offense.players[0]!.playerId;
    const handlerId = offense.players[1]!.playerId;
    const defenseLineup = anchor.lineups[defenseSide === 'HOME' ? 'home' : 'away'];
    const help = buildModelBHelpDefenseResolution(session, {
      transitionEventOffset: 0,
      seconds: 1,
      behaviorSelectionOrdinal: 4,
      successProbabilityMilli: 1_000,
      offenseSide,
      defenseSide,
      handlerId,
      onBallDefenderId: defenseLineup.PG,
      helperId: defenseLineup.C,
    });
    expect(help.result).toBe('SUCCESS');
    expect(help.eventPayloads).toEqual([{ type: 'CLOCK_ADVANCED', seconds: 1 }]);
    expect(help.drawKeys).toEqual([
      {
        matchSeed: session.input.matchSeed,
        period: 1,
        possessionIndex: 0,
        segmentIndex: 0,
        drawKind: 'DEFENSIVE_ACTION',
        localIndex: 1_004,
      },
    ]);
    expect(help.facts).toHaveLength(1);
    expect(help.facts[0]!.payload).toMatchObject({
      type: 'DEFENSIVE_ACTION',
      behaviorId: 'HELPD',
      result: 'SUCCESS',
      opportunityQualityDelta: -6_000,
      breakdownOpportunity: false,
    });
    const helped = commitModelBTransition(session, {
      eventPayloads: help.eventPayloads,
      facts: help.facts,
    });
    expect(
      calculateModelBOpportunityLedger(helped.facts, { period: 1, possessionIndex: 0 }),
    ).toMatchObject({
      rawDeltaMilli: -6_000,
      netPossessionDeltaMilli: -6_000,
    });
    expect(calculateModelBTacticExecutionMetrics(helped, defenseSide)).toEqual({
      tacticExecutionOpportunities: 1,
      successfulTacticExecutions: 1,
      tacticExecutionRate: 1,
    });
    expect(
      calculateModelBDefensiveBreakdownMetrics(helped, {
        defenseSide,
        opponentHalfCourtPossessions: 0,
      }),
    ).toEqual({
      defensiveBreakdownOpportunityEvents: 0,
      defensiveBreakdownEvents: 0,
      defensiveBreakdownOpportunityRate: null,
      defensiveBreakdownRate: null,
    });

    const noEffectSession = createModelBSession(makeP02MatchInput({ rootSeed: 'helpd-no-effect' }));
    const noEffectSides = currentSides(noEffectSession);
    const noEffectAnchor = noEffectSession.anchors.at(-1)!;
    const noEffectDefenseLineup =
      noEffectAnchor.lineups[noEffectSides.defenseSide === 'HOME' ? 'home' : 'away'];
    const noEffect = buildModelBHelpDefenseResolution(noEffectSession, {
      transitionEventOffset: 0,
      seconds: 2,
      behaviorSelectionOrdinal: 4,
      successProbabilityMilli: 0,
      offenseSide: noEffectSides.offenseSide,
      defenseSide: noEffectSides.defenseSide,
      handlerId: noEffectSides.offense.players[1]!.playerId,
      onBallDefenderId: noEffectDefenseLineup.PG,
      helperId: noEffectDefenseLineup.C,
    });
    expect(noEffect.facts[0]!.payload).toMatchObject({
      result: 'NO_EFFECT',
      opportunityQualityDelta: 0,
      breakdownOpportunity: false,
    });
    const noEffectCommitted = commitModelBTransition(noEffectSession, {
      eventPayloads: noEffect.eventPayloads,
      facts: noEffect.facts,
    });
    expect(
      calculateModelBTacticExecutionMetrics(noEffectCommitted, noEffectSides.defenseSide),
    ).toEqual({
      tacticExecutionOpportunities: 1,
      successfulTacticExecutions: 0,
      tacticExecutionRate: 0,
    });

    const pass = buildModelBPassResolution(session, {
      transitionEventOffset: 0,
      seconds: 1,
      behaviorId: 'PASS',
      behaviorSelectionOrdinal: 0,
      passSequence: 0,
      passerId,
      receiverId: handlerId,
      turnoverProbabilityMilli: 0,
      pressuredClassificationProbabilityMilli: 0,
      stealAttributionProbabilityMilli: 1_000,
    });
    const helpAfterPass = buildModelBHelpDefenseResolution(session, {
      transitionEventOffset: 1,
      seconds: 1,
      behaviorSelectionOrdinal: 1,
      successProbabilityMilli: 0,
      offenseSide,
      defenseSide,
      handlerId,
      onBallDefenderId: defenseLineup.PG,
      helperId: defenseLineup.C,
    });
    const shot = buildModelBShotResolution(session, {
      transitionEventOffset: 2,
      shooterId: handlerId,
      zone: 'INSIDE',
      shotInstanceIndex: 0,
      makeProbabilityMilli: 1_000,
      assistCandidate: { playerId: passerId, attributionProbabilityMilli: 1_000 },
    });
    const assisted = commitModelBTransition(session, {
      eventPayloads: [...pass.eventPayloads, ...helpAfterPass.eventPayloads, ...shot.eventPayloads],
      facts: [...pass.facts, ...helpAfterPass.facts],
    });
    expect(playerStats(assisted, offenseSide, passerId).assists).toBe(1);
    expect(assisted.facts.some((fact) => fact.payload.type === 'CREATION')).toBe(false);
    expect(defense.players.some(({ playerId }) => playerId === help.helperId)).toBe(true);
  });

  it('consumes each opportunity source once and caps the possession ledger independently of display', () => {
    const session = createModelBSession(makeP02MatchInput({ rootSeed: 'ledger' }));
    const { offense } = currentSides(session);
    const first = offense.players[0]!.playerId;
    const second = offense.players[1]!.playerId;
    const committed = commitModelBTransition(session, {
      eventPayloads: [
        { type: 'CLOCK_ADVANCED', seconds: 1 },
        { type: 'CLOCK_ADVANCED', seconds: 1 },
      ],
      facts: [
        buildModelBCreationFactDraft({
          sourceEventIndexes: [0],
          creatorId: first,
          beneficiaryId: second,
          behaviorId: 'DRIVE',
          opportunityQualityDelta: 6_000,
          defensiveResponse: 'CONTESTED',
          period: 1,
          possessionIndex: 0,
          segmentIndex: 0,
          nextBehaviorId: 'LAYUP',
        }),
        buildModelBCreationFactDraft({
          sourceEventIndexes: [1],
          creatorId: second,
          beneficiaryId: second,
          behaviorId: 'SCREEN',
          opportunityQualityDelta: 6_000,
          defensiveResponse: 'NONE',
          period: 1,
          possessionIndex: 0,
          segmentIndex: 0,
          nextBehaviorId: 'SPOTUP',
        }),
      ],
    });
    const ledger = calculateModelBOpportunityLedger(committed.facts, {
      period: 1,
      possessionIndex: 0,
    });
    expect(ledger).toMatchObject({ rawDeltaMilli: 12_000, netPossessionDeltaMilli: 6_000 });
    expect(ledger.contributors).toHaveLength(2);
    expect(() =>
      calculateModelBOpportunityLedger([committed.facts[0]!, committed.facts[0]!], {
        period: 1,
        possessionIndex: 0,
      }),
    ).toThrow(/at most one opportunity ledger delta/);
    expect(
      calculateModelBTacticExecutionMetrics(committed, session.anchors[0]!.possession.side),
    ).toEqual({
      tacticExecutionOpportunities: 2,
      successfulTacticExecutions: 2,
      tacticExecutionRate: 1,
    });
  });

  it('reports breakdown opportunities and realized results separately with null zero denominators', () => {
    const makeBreakdown = (rootSeed: string, made: boolean, useHandler: boolean) => {
      const session = createModelBSession(makeP02MatchInput({ rootSeed }));
      const { offenseSide, defenseSide, offense } = currentSides(session);
      const anchor = session.anchors.at(-1)!;
      const defenseLineup = anchor.lineups[defenseSide === 'HOME' ? 'home' : 'away'];
      const handlerId = offense.players[0]!.playerId;
      const shooterId = useHandler ? handlerId : offense.players[1]!.playerId;
      const eventPayloads = [
        { type: 'CLOCK_ADVANCED', seconds: 1 } as const,
        { type: 'SHOT', shooterId, zone: 'INSIDE', made } as const,
        ...(made
          ? ([{ type: 'SCORE', side: offenseSide, playerId: shooterId, points: 2 }] as const)
          : []),
      ];
      return {
        defenseSide,
        session: commitModelBTransition(session, {
          eventPayloads,
          facts: [
            buildModelBDefensiveActionFactDraft({
              sourceEventIndexes: [0],
              behaviorId: 'PRESS',
              offenseSide,
              defenseSide,
              handlerId,
              primaryDefenderId: defenseLineup.PG,
              supportingDefenderIds: [],
              result: 'FAILED_BREAKDOWN',
              opportunityQualityDelta: 6_000,
              breakdownOpportunity: true,
              period: 1,
              possessionIndex: 0,
              segmentIndex: 0,
            }),
          ],
        }),
      };
    };
    const realized = makeBreakdown('breakdown-realized', true, true);
    expect(
      calculateModelBDefensiveBreakdownMetrics(realized.session, {
        defenseSide: realized.defenseSide,
        opponentHalfCourtPossessions: 2,
      }),
    ).toEqual({
      defensiveBreakdownOpportunityEvents: 1,
      defensiveBreakdownEvents: 1,
      defensiveBreakdownOpportunityRate: 0.5,
      defensiveBreakdownRate: 0.5,
    });
    for (const candidate of [
      makeBreakdown('breakdown-miss', false, true),
      makeBreakdown('breakdown-unrelated', true, false),
    ]) {
      expect(
        calculateModelBDefensiveBreakdownMetrics(candidate.session, {
          defenseSide: candidate.defenseSide,
          opponentHalfCourtPossessions: 0,
        }),
      ).toEqual({
        defensiveBreakdownOpportunityEvents: 1,
        defensiveBreakdownEvents: 0,
        defensiveBreakdownOpportunityRate: null,
        defensiveBreakdownRate: null,
      });
    }
  });

  it('ends assist eligibility on a later pass or prior attempt while keeping one attribution draw', () => {
    const session = createModelBSession(makeP02MatchInput({ rootSeed: 'assist-causal-end' }));
    const { offense } = currentSides(session);
    const passerId = offense.players[0]!.playerId;
    const shooterId = offense.players[1]!.playerId;
    const otherReceiverId = offense.players[2]!.playerId;
    const firstPass = buildModelBPassResolution(session, {
      transitionEventOffset: 0,
      seconds: 1,
      behaviorId: 'PASS',
      behaviorSelectionOrdinal: 0,
      passSequence: 0,
      passerId,
      receiverId: shooterId,
      turnoverProbabilityMilli: 0,
      pressuredClassificationProbabilityMilli: 0,
      stealAttributionProbabilityMilli: 1_000,
    });
    const laterPass = buildModelBPassResolution(session, {
      transitionEventOffset: 1,
      seconds: 1,
      behaviorId: 'PASS',
      behaviorSelectionOrdinal: 1,
      passSequence: 1,
      passerId: shooterId,
      receiverId: otherReceiverId,
      turnoverProbabilityMilli: 0,
      pressuredClassificationProbabilityMilli: 0,
      stealAttributionProbabilityMilli: 1_000,
    });
    const shot = buildModelBShotResolution(session, {
      transitionEventOffset: 2,
      shooterId,
      zone: 'INSIDE',
      shotInstanceIndex: 0,
      makeProbabilityMilli: 1_000,
      assistCandidate: { playerId: passerId, attributionProbabilityMilli: 1_000 },
    });
    expect(shot.drawKeys.filter(({ drawKind }) => drawKind === 'ASSIST_ATTRIBUTION')).toHaveLength(
      1,
    );
    expect(() =>
      commitModelBTransition(session, {
        eventPayloads: [
          ...firstPass.eventPayloads,
          ...laterPass.eventPayloads,
          ...shot.eventPayloads,
        ],
        facts: [...firstPass.facts, ...laterPass.facts],
      }),
    ).toThrow(/last legal pass/);

    const shotAfterAttempt = buildModelBShotResolution(session, {
      transitionEventOffset: 2,
      shooterId,
      zone: 'MID_RANGE',
      shotInstanceIndex: 1,
      makeProbabilityMilli: 1_000,
      assistCandidate: { playerId: passerId, attributionProbabilityMilli: 1_000 },
    });
    expect(() =>
      commitModelBTransition(session, {
        eventPayloads: [
          ...firstPass.eventPayloads,
          { type: 'FREE_THROW', shooterId, made: false },
          ...shotAfterAttempt.eventPayloads,
        ],
        facts: firstPass.facts,
      }),
    ).toThrow(/candidate ended/);

    const shotAfterTurnover = buildModelBShotResolution(session, {
      transitionEventOffset: 2,
      shooterId,
      zone: 'MID_RANGE',
      shotInstanceIndex: 2,
      makeProbabilityMilli: 1_000,
      assistCandidate: { playerId: passerId, attributionProbabilityMilli: 1_000 },
    });
    expect(() =>
      commitModelBTransition(session, {
        eventPayloads: [
          ...firstPass.eventPayloads,
          {
            type: 'TURNOVER',
            playerId: shooterId,
            turnoverKind: 'UNFORCED_DEAD_BALL',
          },
          ...shotAfterTurnover.eventPayloads,
        ],
        facts: firstPass.facts,
      }),
    ).toThrow(/candidate ended/);

    const passed = commitModelBActiveSegment(session, {
      eventPayloads: firstPass.eventPayloads,
      facts: firstPass.facts,
      resolution: 'SAME_SIDE_DEAD_BALL',
    });
    const shotAfterSegment = buildModelBShotResolution(passed, {
      transitionEventOffset: 1,
      shooterId,
      zone: 'INSIDE',
      shotInstanceIndex: 3,
      makeProbabilityMilli: 1_000,
      assistCandidate: { playerId: passerId, attributionProbabilityMilli: 1_000 },
    });
    expect(() =>
      commitModelBActiveSegment(passed, {
        eventPayloads: [{ type: 'CLOCK_ADVANCED', seconds: 1 }, ...shotAfterSegment.eventPayloads],
        resolution: 'POSSESSION_CHANGE',
      }),
    ).toThrow(/last legal pass/);
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
