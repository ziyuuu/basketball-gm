import { describe, expect, it } from 'vitest';

import {
  GENESIS_MATCH_ANCHOR_HASH,
  MODEL_B_INTERNAL_TEST_ROTATION_POLICY_ID,
  MODEL_B_OPPONENT_POLICY_ID,
  MatchEffectSchema,
  MatchInputSchema,
  assertModelBSessionInvariants,
  buildModelBFoulOutBoundaryPlan,
  buildModelBNeutralRotationPlan,
  buildModelBOpponentPolicyPlan,
  calculateCommittedFatigueIncrementMilli,
  calculateModelBShortHandedDefensePenaltyMilli,
  commitModelBAutomatedDecision,
  commitModelBTransition,
  completeModelBPeriod,
  createModelBSession,
  deriveEffectKey,
  deriveMatchInputHash,
  eligibleModelBLineupPlayerIds,
  type MatchEffect,
  type MatchInput,
  type ModelBSession,
} from '../packages/domain/src/match/index.js';
import { makeP02MatchInput } from './helpers/p02-003-fixtures.js';

type MatchSide = ModelBSession['anchors'][number]['possession']['side'];

function sideKey(side: MatchSide): 'home' | 'away' {
  return side === 'HOME' ? 'home' : 'away';
}

function oppositeSide(side: MatchSide): MatchSide {
  return side === 'HOME' ? 'AWAY' : 'HOME';
}

function rematerializeInput(input: MatchInput, mutate: (draft: MatchInput) => void): MatchInput {
  const draft = structuredClone(input);
  mutate(draft);
  draft.matchInputHash = GENESIS_MATCH_ANCHOR_HASH;
  draft.matchInputHash = deriveMatchInputHash(draft);
  return MatchInputSchema.parse(draft);
}

function currentPlayer(session: ModelBSession, side: MatchSide, playerId: string) {
  return session.input[side === 'HOME' ? 'homeTeam' : 'awayTeam'].players.find(
    (player) => player.playerId === playerId,
  )!;
}

function playerSeconds(session: ModelBSession, side: MatchSide): number {
  return session.anchors
    .at(-1)!
    .boxScore[sideKey(side)].players.reduce((total, player) => total + player.secondsPlayed, 0);
}

function foulOutPlayer(session: ModelBSession, side: MatchSide, playerId: string): ModelBSession {
  const offenseSide = session.anchors.at(-1)!.possession.side;
  const foulKind = side === offenseSide ? ('OFFENSIVE' as const) : ('PERSONAL' as const);
  const eventPayloads = Array.from({ length: 5 }, () => ({
    type: 'FOUL' as const,
    playerId,
    foulKind,
  }));
  if (foulKind === 'OFFENSIVE') {
    return commitModelBTransition(session, {
      eventPayloads: eventPayloads.flatMap((foul) => [
        foul,
        {
          type: 'TURNOVER' as const,
          playerId,
          turnoverKind: 'OFFENSIVE_FOUL' as const,
        },
      ]),
    });
  }
  return commitModelBTransition(session, { eventPayloads });
}

function makeEffect(
  session: ModelBSession,
  remainingPossessions: number,
  sourceRevision = 0,
): MatchEffect {
  const anchor = session.anchors.at(-1)!;
  const controlBoundary = anchor.controlBoundary!;
  const source = {
    kind: 'BASE_TACTIC' as const,
    sourceId: 'b6-effect-fixture',
    reasonCode: `REVISION_${sourceRevision}`,
  };
  const target = {
    side: anchor.possession.side,
    scope: 'TEAM' as const,
    playerId: null,
    behavior: null,
  };
  const identity = { source, target, parameter: 'OPPORTUNITY_QUALITY' as const };
  return MatchEffectSchema.parse({
    effectKey: deriveEffectKey(identity),
    source,
    sourceRevision,
    controlBoundary,
    effectiveFromSegmentKey: {
      period: controlBoundary.period,
      possessionIndex: controlBoundary.possessionIndex,
      segmentIndex: controlBoundary.segmentIndex,
    },
    target,
    parameter: identity.parameter,
    modifier: { mode: 'ADD', valueMilli: 1_000 + sourceRevision },
    duration: { kind: 'POSSESSIONS', remainingPossessions },
  });
}

describe('P02-003 B6 committed state, eligibility and internal policies', () => {
  it('derives per-slice fatigue from committed clock events and current offense/defense tactics', () => {
    const input = rematerializeInput(makeP02MatchInput(), (draft) => {
      draft.homeTeam.tactics.pace = 'FAST';
      draft.awayTeam.tactics.pace = 'FAST';
      draft.homeTeam.tactics.defensiveFocus = 'PRESSURE';
      draft.awayTeam.tactics.defensiveFocus = 'PRESSURE';
    });
    const session = createModelBSession(input);
    const anchor = session.anchors.at(-1)!;
    const offenseSide = anchor.possession.side;
    const defenseSide = oppositeSide(offenseSide);
    const offenseId = anchor.lineups[sideKey(offenseSide)].PG;
    const defenseId = anchor.lineups[sideKey(defenseSide)].PG;
    const benchId = input[offenseSide === 'HOME' ? 'homeTeam' : 'awayTeam'].players[5]!.playerId;

    const next = commitModelBTransition(session, {
      eventPayloads: [{ type: 'CLOCK_ADVANCED', seconds: 10 }],
    });
    const nextAnchor = next.anchors.at(-1)!;
    const offenseIncrement = calculateCommittedFatigueIncrementMilli({
      matchKind: input.matchKind,
      seconds: 10,
      stamina: currentPlayer(session, offenseSide, offenseId).abilities.stamina,
      tactics: {
        pace: 'FAST',
        offensiveFocus: 'BALANCED',
        defensiveFocus: 'BALANCED',
      },
    });
    const defenseIncrement = calculateCommittedFatigueIncrementMilli({
      matchKind: input.matchKind,
      seconds: 10,
      stamina: currentPlayer(session, defenseSide, defenseId).abilities.stamina,
      tactics: {
        pace: 'FAST',
        offensiveFocus: 'BALANCED',
        defensiveFocus: 'PRESSURE',
      },
    });

    expect(nextAnchor.fatigueMilliByPlayer[offenseId]).toBe(
      anchor.fatigueMilliByPlayer[offenseId]! + offenseIncrement,
    );
    expect(nextAnchor.fatigueMilliByPlayer[defenseId]).toBe(
      anchor.fatigueMilliByPlayer[defenseId]! + defenseIncrement,
    );
    expect(nextAnchor.fatigueMilliByPlayer[benchId]).toBe(anchor.fatigueMilliByPlayer[benchId]);
    expect(session.anchors.at(-1)!.fatigueMilliByPlayer).toEqual(anchor.fatigueMilliByPlayer);
    expect(() =>
      commitModelBTransition(next, {
        eventPayloads: [{ type: 'CLOCK_ADVANCED', seconds: 591 }],
      }),
    ).toThrow(/period clock below zero/);
    expect(() => assertModelBSessionInvariants(next)).not.toThrow();
  });

  it('applies same-key replacements and decrements possession effects only after a committed end', () => {
    const session = createModelBSession(makeP02MatchInput());
    const effect = makeEffect(session, 2);
    const applied = commitModelBTransition(session, {
      eventPayloads: [{ type: 'EFFECT_APPLIED', effectKey: effect.effectKey }],
      effectiveFragment: {
        ...session.anchors.at(-1)!.effectiveFragment,
        effects: [effect],
      },
    });
    expect(applied.anchors.at(-1)!.effectiveFragment.effects[0]!.duration).toEqual({
      kind: 'POSSESSIONS',
      remainingPossessions: 2,
    });

    const replacement = makeEffect(applied, 2, 1);
    const replaced = commitModelBTransition(applied, {
      eventPayloads: [{ type: 'EFFECT_APPLIED', effectKey: replacement.effectKey }],
      effectiveFragment: {
        ...applied.anchors.at(-1)!.effectiveFragment,
        effects: [replacement],
      },
    });
    expect(replaced.anchors.at(-1)!.effectiveFragment.effects).toHaveLength(1);
    expect(replaced.anchors.at(-1)!.effectiveFragment.effects[0]!.sourceRevision).toBe(1);
    expect(() =>
      commitModelBTransition(replaced, {
        eventPayloads: [{ type: 'EFFECT_APPLIED', effectKey: replacement.effectKey }],
      }),
    ).toThrow(/add or replace/);
    expect(replaced.anchors.at(-1)!.effectiveFragment.effects[0]!.duration).toEqual({
      kind: 'POSSESSIONS',
      remainingPossessions: 2,
    });

    const firstEnd = commitModelBTransition(replaced, {
      eventPayloads: [{ type: 'POSSESSION_ENDED', side: replaced.anchors.at(-1)!.possession.side }],
      nextPossession: {
        side: oppositeSide(replaced.anchors.at(-1)!.possession.side),
        possessionIndex: 1,
        segmentIndex: 0,
      },
    });
    expect(firstEnd.anchors.at(-1)!.effectiveFragment.effects[0]!.duration).toEqual({
      kind: 'POSSESSIONS',
      remainingPossessions: 1,
    });
    const secondEnd = commitModelBTransition(firstEnd, {
      eventPayloads: [{ type: 'POSSESSION_ENDED', side: firstEnd.anchors.at(-1)!.possession.side }],
      nextPossession: {
        side: oppositeSide(firstEnd.anchors.at(-1)!.possession.side),
        possessionIndex: 2,
        segmentIndex: 0,
      },
    });
    expect(secondEnd.anchors.at(-1)!.effectiveFragment.effects).toEqual([]);
    expect(() => assertModelBSessionInvariants(secondEnd)).not.toThrow();
  });

  it('forces a deterministic fifth-foul replacement and forbids all later participation', () => {
    const session = createModelBSession(makeP02MatchInput());
    const defenseSide = oppositeSide(session.anchors.at(-1)!.possession.side);
    const outPlayerId = session.anchors.at(-1)!.lineups[sideKey(defenseSide)].PG;
    const fouledOut = foulOutPlayer(session, defenseSide, outPlayerId);
    const plan = buildModelBFoulOutBoundaryPlan(fouledOut);

    expect(plan.forfeitingSide).toBeNull();
    expect(plan.substitutions).toEqual([
      expect.objectContaining({
        side: defenseSide,
        position: 'PG',
        outPlayerId,
        forced: true,
        reasonCode: 'FOUL_OUT_FORCED_REPLACEMENT',
      }),
    ]);
    const replaced = commitModelBTransition(fouledOut, {
      eventPayloads: plan.eventPayloads,
    });
    expect(Object.values(replaced.anchors.at(-1)!.lineups[sideKey(defenseSide)])).not.toContain(
      outPlayerId,
    );
    expect(Object.values(replaced.anchors.at(-1)!.roles[sideKey(defenseSide)])).not.toContain(
      outPlayerId,
    );
    expect(() =>
      commitModelBTransition(replaced, {
        eventPayloads: [{ type: 'FOUL', playerId: outPlayerId, foulKind: 'PERSONAL' }],
      }),
    ).toThrow(/current lineup|foul-out limit/);
    expect(() =>
      commitModelBTransition(replaced, {
        eventPayloads: [
          {
            type: 'SUBSTITUTION',
            side: defenseSide,
            outPlayerId: plan.substitutions[0]!.inPlayerId,
            inPlayerId: outPlayerId,
            transcriptEntryHash: null,
            forced: false,
          },
        ],
      }),
    ).toThrow(/fouled-out player cannot enter/);
    expect(() => assertModelBSessionInvariants(replaced)).not.toThrow();
  });

  it('counts actual 4/3/2-player minutes and preserves score on the under-two forfeit', () => {
    let session = createModelBSession(makeP02MatchInput({ rootSeed: 'b6-short-handed' }));
    const shortSide = oppositeSide(session.anchors.at(-1)!.possession.side);
    let foulOuts = 0;
    while (foulOuts < 8) {
      const playerId = eligibleModelBLineupPlayerIds(session.anchors.at(-1)!, shortSide)[0]!;
      session = foulOutPlayer(session, shortSide, playerId);
      const plan = buildModelBFoulOutBoundaryPlan(session);
      if (plan.eventPayloads.length > 0) {
        session = commitModelBTransition(session, { eventPayloads: plan.eventPayloads });
      }
      foulOuts += 1;
    }
    expect(eligibleModelBLineupPlayerIds(session.anchors.at(-1)!, shortSide)).toHaveLength(4);
    expect(calculateModelBShortHandedDefensePenaltyMilli(session.anchors.at(-1)!, shortSide)).toBe(
      -4_000,
    );
    const shortSecondsBefore = playerSeconds(session, shortSide);
    const fullSide = oppositeSide(shortSide);
    const fullSecondsBefore = playerSeconds(session, fullSide);
    session = commitModelBTransition(session, {
      eventPayloads: [{ type: 'CLOCK_ADVANCED', seconds: 10 }],
    });
    expect(playerSeconds(session, shortSide) - shortSecondsBefore).toBe(40);
    expect(playerSeconds(session, fullSide) - fullSecondsBefore).toBe(50);

    while (foulOuts < 10) {
      const playerId = eligibleModelBLineupPlayerIds(session.anchors.at(-1)!, shortSide)[0]!;
      session = foulOutPlayer(session, shortSide, playerId);
      const plan = buildModelBFoulOutBoundaryPlan(session);
      if (plan.eventPayloads.length > 0) {
        session = commitModelBTransition(session, { eventPayloads: plan.eventPayloads });
      }
      foulOuts += 1;
    }
    expect(eligibleModelBLineupPlayerIds(session.anchors.at(-1)!, shortSide)).toHaveLength(2);
    const finalEligible = eligibleModelBLineupPlayerIds(session.anchors.at(-1)!, shortSide)[0]!;
    session = foulOutPlayer(session, shortSide, finalEligible);
    const forfeit = buildModelBFoulOutBoundaryPlan(session);
    expect(forfeit).toMatchObject({
      forfeitingSide: shortSide,
      status: 'FORFEIT_INSUFFICIENT_PLAYERS',
      substitutions: [],
      eventPayloads: [
        { type: 'MATCH_COMPLETED', terminationReason: 'FORFEIT_INSUFFICIENT_PLAYERS' },
      ],
    });
    const scoreBefore = session.anchors.at(-1)!.score;
    const completed = commitModelBTransition(session, {
      eventPayloads: forfeit.eventPayloads,
      status: forfeit.status,
      controlBoundaryKind: 'MATCH_COMPLETE',
    });
    expect(completed.anchors.at(-1)!.score).toEqual(scoreBefore);
    expect(completed.anchors.at(-1)!.status).toBe('FORFEIT_INSUFFICIENT_PLAYERS');
    expect(() => assertModelBSessionInvariants(completed)).not.toThrow();
  });

  it('keeps the deterministic fatigue rotation explicitly internal/test and INSTANT-only', () => {
    const highFatigueInput = rematerializeInput(makeP02MatchInput(), (draft) => {
      for (const team of [draft.homeTeam, draft.awayTeam]) {
        for (const [index, player] of team.players.entries()) {
          player.fatigueMilli = index < 5 ? 80_000 : 10_000;
        }
      }
    });
    const atDeadBall = commitModelBTransition(createModelBSession(highFatigueInput), {
      eventPayloads: [{ type: 'CLOCK_ADVANCED', seconds: 1 }],
    });
    const plan = buildModelBNeutralRotationPlan(atDeadBall);
    expect(plan.policyId).toBe(MODEL_B_INTERNAL_TEST_ROTATION_POLICY_ID);
    expect(plan.policyId).toContain('internal/test');
    expect(plan.substitutions.length).toBeGreaterThan(0);
    expect(plan).toEqual(buildModelBNeutralRotationPlan(atDeadBall));
    expect(plan.substitutions.every((substitution) => !substitution.forced)).toBe(true);
    const rotated = commitModelBTransition(atDeadBall, { eventPayloads: plan.eventPayloads });
    expect(() => assertModelBSessionInvariants(rotated)).not.toThrow();

    const fullCoachInput = rematerializeInput(highFatigueInput, (draft) => {
      draft.controlStrategy = 'FULL_COACH';
    });
    const fullCoachDeadBall = commitModelBTransition(createModelBSession(fullCoachInput), {
      eventPayloads: [{ type: 'CLOCK_ADVANCED', seconds: 1 }],
    });
    expect(() => buildModelBNeutralRotationPlan(fullCoachDeadBall)).toThrow(/INSTANT/);
  });

  it('produces a deterministic period-break opponent decision with reasons and closed effects', () => {
    const input = rematerializeInput(
      makeP02MatchInput({ rootSeed: 'b6-opponent-policy' }),
      (draft) => {
        draft.homeTeam.tactics.defensiveFocus = 'PAINT_PROTECT';
        draft.awayTeam.tactics.defensiveFocus = 'PAINT_PROTECT';
      },
    );
    let session = createModelBSession(input);
    const leaderSide = session.anchors.at(-1)!.possession.side;
    const scorerId = session.anchors.at(-1)!.lineups[sideKey(leaderSide)].PG;
    session = commitModelBTransition(session, {
      eventPayloads: [
        { type: 'CLOCK_ADVANCED', seconds: 600 },
        { type: 'SHOT', shooterId: scorerId, zone: 'THREE_POINT', made: true },
        { type: 'SCORE', side: leaderSide, playerId: scorerId, points: 3 },
        { type: 'SHOT', shooterId: scorerId, zone: 'THREE_POINT', made: true },
        { type: 'SCORE', side: leaderSide, playerId: scorerId, points: 3 },
        { type: 'SHOT', shooterId: scorerId, zone: 'INSIDE', made: true },
        { type: 'SCORE', side: leaderSide, playerId: scorerId, points: 2 },
      ],
    });
    session = completeModelBPeriod(session);
    const plan = buildModelBOpponentPolicyPlan(session, leaderSide);
    expect(plan.policyId).toBe(MODEL_B_OPPONENT_POLICY_ID);
    expect(plan.reasonCodes).toEqual([
      'LEADING_EIGHT_SLOW',
      'PLAYER_PAINT_PROTECT_ATTACK_PERIMETER',
    ]);
    expect(plan.effectiveFragment.tactics[sideKey(leaderSide)]).toMatchObject({
      pace: 'SLOW',
      offensiveFocus: 'PERIMETER',
    });
    expect(plan.effectiveFragment.effects).toHaveLength(2);
    expect(
      plan.effectiveFragment.effects.every(
        (effect) =>
          effect.source.kind === 'OPPONENT_POLICY' &&
          effect.source.sourceId === MODEL_B_OPPONENT_POLICY_ID,
      ),
    ).toBe(true);
    expect(plan.eventPayloads.map((payload) => payload.type)).toEqual([
      'EFFECT_APPLIED',
      'EFFECT_APPLIED',
    ]);
    expect(plan).toEqual(buildModelBOpponentPolicyPlan(session, leaderSide));

    const decided = commitModelBAutomatedDecision(session, {
      actor: 'OPPONENT',
      policyId: plan.policyId,
      policyInputHash: plan.policyInputHash,
      effectiveFragment: plan.effectiveFragment,
    });
    expect(decided.transcriptEntries.at(-1)!.actor).toBe('OPPONENT');
    expect(() => assertModelBSessionInvariants(decided)).not.toThrow();
  });
});
