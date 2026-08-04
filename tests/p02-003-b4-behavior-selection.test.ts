import { describe, expect, it } from 'vitest';

import {
  MODEL_B_CREATION_EXIT_REGISTRY,
  MODEL_B_PASS_BEHAVIOR_IDS,
  buildModelBBehaviorCandidates,
  calculateModelBDutyAdjustedSceneAvailabilityMilli,
  calculateAbilityBlendMilli,
  deriveModelBBlockHelpCandidate,
  deriveModelBDefensiveDuty,
  deriveModelBDefensiveSlot,
  calculateModelBBehaviorTendencyBasisPoints,
  deriveModelBBoxoutActor,
  deriveModelBPassInterceptionCandidate,
  modelBActorLocalIndex,
  modelBPassResultDrawKey,
  modelBReceiverLocalIndex,
  resolveModelBDirectOpponent,
  selectModelBActor,
  selectModelBBehavior,
  selectModelBCreationExit,
  selectModelBDefensiveMode,
  selectModelBDoubleTeamActors,
  selectModelBHandler,
  selectModelBHelpDefender,
  selectModelBReceiverOrBeneficiary,
  type MatchPlayerSnapshot,
  type ModelBBehaviorId,
  type ModelBDrawContext,
} from '../packages/domain/src/match/index.js';
import { makeP02MatchInput } from './helpers/p02-003-fixtures.js';

const input = makeP02MatchInput();
const context: ModelBDrawContext = {
  matchSeed: input.matchSeed,
  period: 1,
  possessionIndex: 4,
  segmentIndex: 2,
};

function player(playerId: string): MatchPlayerSnapshot {
  const found = [...input.homeTeam.players, ...input.awayTeam.players].find(
    (candidate) => candidate.playerId === playerId,
  );
  if (found === undefined) throw new Error(`Missing fixture player ${playerId}.`);
  return found;
}

function withPlayer(
  subject: MatchPlayerSnapshot,
  patch: Partial<MatchPlayerSnapshot>,
): MatchPlayerSnapshot {
  return { ...subject, ...patch };
}

function lineupPlayers(side: 'HOME' | 'AWAY'): MatchPlayerSnapshot[] {
  const team = side === 'HOME' ? input.homeTeam : input.awayTeam;
  return Object.values(team.startingLineup).map((playerId) =>
    team.players.find((candidate) => candidate.playerId === playerId),
  ) as MatchPlayerSnapshot[];
}

describe('P02-003 B4 behavior candidates and semantic keys', () => {
  it('keeps P_select closed to selectable behaviors and fixed registry order', () => {
    const decisionPlayer = player('HOME-01');
    const candidates = buildModelBBehaviorCandidates({
      decisionPlayer,
      legalBehaviorIds: ['SCREEN', 'DRIVE', 'PASS'],
    });
    expect(candidates.map(({ behavior }) => behavior.behaviorId)).toEqual([
      'DRIVE',
      'PASS',
      'SCREEN',
    ]);
    expect(() =>
      buildModelBBehaviorCandidates({
        decisionPlayer,
        legalBehaviorIds: ['BOXOUT'],
      }),
    ).toThrow(/Non-selectable behavior BOXOUT/);
  });

  it('uses the exact product of tendency factors without reading abilities', () => {
    const baseline = player('HOME-01');
    const stronger = withPlayer(baseline, {
      abilityProfile: {
        ...baseline.abilityProfile,
        values: Object.fromEntries(
          Object.keys(baseline.abilityProfile.values).map((key) => [key, 100]),
        ) as MatchPlayerSnapshot['abilityProfile']['values'],
      },
      physicalProfile: {
        ...baseline.physicalProfile,
        heightCm: 220,
        wingspanCm: 235,
      },
    });
    expect(calculateModelBBehaviorTendencyBasisPoints(baseline, 'DRIVE')).toBe(1_650);
    const baselineCandidates = buildModelBBehaviorCandidates({
      decisionPlayer: baseline,
      legalBehaviorIds: ['DRIVE', 'PASS'],
    });
    const strongerCandidates = buildModelBBehaviorCandidates({
      decisionPlayer: stronger,
      legalBehaviorIds: ['DRIVE', 'PASS'],
    });
    expect(strongerCandidates.map(({ weight }) => weight)).toEqual(
      baselineCandidates.map(({ weight }) => weight),
    );
    expect(calculateAbilityBlendMilli(stronger, 'BALL_SECURITY')).toBeGreaterThan(
      calculateAbilityBlendMilli(baseline, 'BALL_SECURITY'),
    );
  });

  it('selects behaviors independently of candidate input order', () => {
    const common = {
      context,
      behaviorSelectionOrdinal: 3,
      decisionPlayer: player('HOME-01'),
      safeFallbackBehaviorId: 'PASS' as const,
    };
    const first = selectModelBBehavior({
      ...common,
      legalBehaviorIds: ['PASS', 'MID', 'DRIVE'],
    });
    const reordered = selectModelBBehavior({
      ...common,
      legalBehaviorIds: ['DRIVE', 'PASS', 'MID'],
    });
    expect(reordered).toEqual(first);
    expect(first.drawKey).toMatchObject({ drawKind: 'BEHAVIOR', localIndex: 3 });
  });

  it('uses the caller-provided fixed safe behavior when legal weights are zero', () => {
    const baseline = player('HOME-01');
    const neverPasses = withPlayer(baseline, {
      tendencies: { ...baseline.tendencies, passSelection: 0 },
    });
    const result = selectModelBBehavior({
      context,
      behaviorSelectionOrdinal: 0,
      decisionPlayer: neverPasses,
      legalBehaviorIds: ['ADV', 'REORG'],
      safeFallbackBehaviorId: 'REORG',
    });
    expect(result.value.behavior.behaviorId).toBe('REORG');
    expect(result).toMatchObject({ totalWeight: 0, usedFallback: true, drawKey: null });
  });

  it('freezes the creation-success exit sets and gives exits a new BEHAVIOR ordinal', () => {
    expect(MODEL_B_CREATION_EXIT_REGISTRY).toEqual({
      DRIVE: ['LAYUP', 'CONTACTFIN', 'HELDKICK'],
      SHAKE: ['SPOTUP', 'PULLUP', 'THREE'],
      ISO: ['PULLUP', 'MID'],
      STEP_BACK: ['MID'],
      POSTUP: ['HOOK', 'CLOSE'],
      HIGH_POST_CREATION: ['HPASS', 'SPOTUP'],
    });
    const result = selectModelBCreationExit({
      context,
      creationBehaviorId: 'DRIVE',
      behaviorSelectionOrdinal: 4,
      decisionPlayer: player('HOME-01'),
      safeFallbackBehaviorId: 'LAYUP',
    });
    expect(MODEL_B_CREATION_EXIT_REGISTRY.DRIVE).toContain(
      result.value.behavior.behaviorId as 'LAYUP' | 'CONTACTFIN' | 'HELDKICK',
    );
    expect(result.drawKey).toMatchObject({ drawKind: 'BEHAVIOR', localIndex: 4 });
  });

  it('gives every PASS-family behavior exactly the single turnover result key', () => {
    for (const behaviorId of MODEL_B_PASS_BEHAVIOR_IDS) {
      expect(modelBPassResultDrawKey(context, behaviorId, 7)).toEqual({
        ...context,
        drawKind: 'TURNOVER_OCCURRENCE',
        localIndex: 2_007,
      });
    }
  });
});

describe('P02-003 B4 handler and participant selection', () => {
  it('selects the handler by possession participation after stable playerId sorting', () => {
    const first = player('HOME-01');
    const second = player('HOME-02');
    const inactive = withPlayer(first, {
      tendencies: { ...first.tendencies, possessionParticipation: 0 },
    });
    const onlyHandler = withPlayer(second, {
      tendencies: { ...second.tendencies, possessionParticipation: 100 },
    });
    const selected = selectModelBHandler({
      context,
      handlerInstanceIndex: 0,
      candidates: [onlyHandler, inactive],
    });
    expect(selected.value.playerId).toBe(onlyHandler.playerId);
    expect(selected.drawKey).toMatchObject({ drawKind: 'BALL_HANDLER', localIndex: 1 });
    expect(
      selectModelBHandler({
        context,
        handlerInstanceIndex: 0,
        candidates: [inactive, onlyHandler],
      }),
    ).toEqual(selected);
  });

  it('selects receiver/beneficiary uniformly, excludes the creator and rejects an empty set', () => {
    const candidates = lineupPlayers('HOME');
    const creatorId = candidates[0]!.playerId;
    const first = selectModelBReceiverOrBeneficiary({
      context,
      behaviorId: 'PASS',
      behaviorSelectionOrdinal: 1,
      candidates,
      excludedPlayerIds: [creatorId],
    });
    const reordered = selectModelBReceiverOrBeneficiary({
      context,
      behaviorId: 'PASS',
      behaviorSelectionOrdinal: 1,
      candidates: [...candidates].reverse(),
      excludedPlayerIds: [creatorId],
    });
    expect(first).toEqual(reordered);
    expect(first?.value.playerId).not.toBe(creatorId);
    expect(first?.drawKey).toMatchObject({
      drawKind: 'BALL_HANDLER',
      localIndex: modelBReceiverLocalIndex(1),
    });
    expect(
      selectModelBReceiverOrBeneficiary({
        context,
        behaviorId: 'PASS',
        behaviorSelectionOrdinal: 1,
        candidates: [candidates[0]!],
        excludedPlayerIds: [creatorId],
      }),
    ).toBeNull();
    expect(() =>
      selectModelBReceiverOrBeneficiary({
        context,
        behaviorId: 'HELPD',
        behaviorSelectionOrdinal: 1,
        candidates,
        excludedPlayerIds: [],
      }),
    ).toThrow(/does not use a receiver or beneficiary draw/);
  });

  it('derives duty availability from the assigned lineup slot with exact half-up scaling', () => {
    const lineup = input.awayTeam.startingLineup;
    const defender = player(lineup.PG);
    const executionBeforeSwitch = calculateAbilityBlendMilli(defender, 'HELP_DEFENSE');
    expect(deriveModelBDefensiveSlot(lineup, defender.playerId)).toBe('PG');
    expect(deriveModelBDefensiveDuty(lineup, defender.playerId)).toBe('POINT_OF_ATTACK');
    expect(
      calculateModelBDutyAdjustedSceneAvailabilityMilli({
        ordinarySceneAvailabilityMilli: 555,
        behaviorId: 'HELPD',
        assignedSlot: 'PG',
      }),
    ).toBe(167);
    const pointAvailability = buildModelBBehaviorCandidates({
      decisionPlayer: defender,
      legalBehaviorIds: ['HELPD'],
      sceneAvailabilityMilliByBehavior: { HELPD: 555 },
      currentLineup: lineup,
    })[0]!;
    const switched = { ...lineup, PG: lineup.C, C: lineup.PG };
    expect(deriveModelBDefensiveDuty(switched, defender.playerId)).toBe('RIM_ANCHOR');
    const anchorAvailability = buildModelBBehaviorCandidates({
      decisionPlayer: defender,
      legalBehaviorIds: ['HELPD'],
      sceneAvailabilityMilliByBehavior: { HELPD: 555 },
      currentLineup: switched,
    })[0]!;
    expect(pointAvailability.sceneAvailabilityMilli).toBe(167);
    expect(anchorAvailability.sceneAvailabilityMilli).toBe(555);
    expect(anchorAvailability.weight).toBeGreaterThan(pointAvailability.weight);
    expect(calculateAbilityBlendMilli(defender, 'HELP_DEFENSE')).toBe(executionBeforeSwitch);
    expect(() =>
      buildModelBBehaviorCandidates({
        decisionPlayer: defender,
        legalBehaviorIds: ['HELPD'],
      }),
    ).toThrow(/current defensive lineup/);
  });

  it('selects the HELPD helper by assigned-slot weights at the reserved 3000 ordinal', () => {
    const lineup = input.awayTeam.startingLineup;
    const candidates = lineupPlayers('AWAY');
    const selected = selectModelBHelpDefender({
      context,
      behaviorSelectionOrdinal: 7,
      currentLineup: lineup,
      candidates: [...candidates].reverse(),
      onBallDefenderId: lineup.PG,
    });
    expect(selected).toEqual(
      selectModelBHelpDefender({
        context,
        behaviorSelectionOrdinal: 7,
        currentLineup: lineup,
        candidates,
        onBallDefenderId: lineup.PG,
      }),
    );
    expect(selected?.value.playerId).not.toBe(lineup.PG);
    expect(selected?.totalWeight).toBe(2_850);
    expect(selected?.drawKey).toMatchObject({
      drawKind: 'BALL_HANDLER',
      localIndex: 3_007,
    });
    expect(
      selectModelBHelpDefender({
        context,
        behaviorSelectionOrdinal: 7,
        currentLineup: lineup,
        candidates: [player(lineup.PG)],
        onBallDefenderId: lineup.PG,
      }),
    ).toBeNull();
    expect(() =>
      selectModelBActor({
        context,
        behaviorId: 'HELPD',
        behaviorSelectionOrdinal: 7,
        candidates,
        excludedPlayerIds: [lineup.PG],
      }),
    ).toThrow(/does not use a random actor draw/);
  });

  it('selects block help and PASS interception deterministically from duty plus execution', () => {
    const lineup = input.awayTeam.startingLineup;
    const candidates = lineupPlayers('AWAY');
    expect(
      deriveModelBBlockHelpCandidate({
        currentLineup: lineup,
        candidates: [...candidates].reverse(),
        directDefenderId: lineup.PG,
      })?.playerId,
    ).toBe(lineup.C);
    expect(
      deriveModelBPassInterceptionCandidate({
        currentLineup: lineup,
        candidates: [...candidates].reverse(),
      })?.playerId,
    ).toBe(lineup.PG);

    const center = player(lineup.C);
    const powerForward = player(lineup.PF);
    const tiedPowerForward = withPlayer(powerForward, {
      abilityProfile: {
        ...powerForward.abilityProfile,
        values: {
          ...powerForward.abilityProfile.values,
          interiorDefense: powerForward.abilityProfile.values.interiorDefense + 6,
          athleticism: powerForward.abilityProfile.values.athleticism + 2,
        },
      },
    });
    expect(calculateAbilityBlendMilli(tiedPowerForward, 'BLOCK') + 5_000).toBe(
      calculateAbilityBlendMilli(center, 'BLOCK') + 8_000,
    );
    const tied = deriveModelBBlockHelpCandidate({
      currentLineup: lineup,
      candidates: [center, tiedPowerForward],
      directDefenderId: lineup.PG,
    });
    expect(tied?.playerId).toBe([center.playerId, tiedPowerForward.playerId].sort()[0]);
    expect(
      deriveModelBBlockHelpCandidate({
        currentLineup: lineup,
        candidates: [tiedPowerForward, center],
        directDefenderId: lineup.PG,
      }),
    ).toEqual(tied);
  });

  it('binds actor keys to behavior selection ordinals, not prior branch calls', () => {
    const candidates = lineupPlayers('HOME');
    const excludedPlayerIds = [candidates[0]!.playerId];
    const secondActor = () =>
      selectModelBActor({
        context,
        behaviorId: 'SCREEN',
        behaviorSelectionOrdinal: 1,
        candidates,
        excludedPlayerIds,
      });
    const withoutFirstBranch = secondActor();
    selectModelBActor({
      context,
      behaviorId: 'SCREEN',
      behaviorSelectionOrdinal: 0,
      candidates,
      excludedPlayerIds,
    });
    expect(secondActor()).toEqual(withoutFirstBranch);
    expect(withoutFirstBranch?.drawKey).toMatchObject({
      drawKind: 'BALL_HANDLER',
      localIndex: modelBActorLocalIndex(1),
    });
  });

  it('derives DOUBLET top-2 and BOXOUT actor without an actor draw', () => {
    const candidates = lineupPlayers('AWAY').slice(0, 4);
    const rated = candidates.map((candidate, index) =>
      withPlayer(candidate, {
        abilityProfile: {
          ...candidate.abilityProfile,
          values: {
            ...candidate.abilityProfile.values,
            interiorDefense: [60, 90, 90, 40][index]!,
          },
        },
      }),
    );
    expect(
      selectModelBDoubleTeamActors([...rated].reverse())?.map(({ playerId }) => playerId),
    ).toEqual([rated[1]!.playerId, rated[2]!.playerId].sort());
    const boxout = deriveModelBBoxoutActor({
      candidates: [...rated].reverse(),
      excludedPlayerIds: [rated[0]!.playerId],
      personalReboundExecutionMilliByPlayerId: {
        [rated[1]!.playerId]: 70_000,
        [rated[2]!.playerId]: 70_000,
        [rated[3]!.playerId]: 50_000,
      },
    });
    expect(boxout?.playerId).toBe([rated[1]!.playerId, rated[2]!.playerId].sort()[0]);
    expect(() =>
      selectModelBActor({
        context,
        behaviorId: 'BOXOUT',
        behaviorSelectionOrdinal: 0,
        candidates: rated,
        excludedPlayerIds: [],
      }),
    ).toThrow(/does not use a random actor draw/);
  });

  it('uses the same-position opponent and a deterministic nearest eligible fallback', () => {
    const home = input.homeTeam.startingLineup;
    const away = input.awayTeam.startingLineup;
    expect(
      resolveModelBDirectOpponent({
        actorPlayerId: home.PG,
        actorLineup: home,
        opponentLineup: away,
        eligibleOpponentIds: Object.values(away),
      }),
    ).toBe(away.PG);
    expect(
      resolveModelBDirectOpponent({
        actorPlayerId: home.PG,
        actorLineup: home,
        opponentLineup: away,
        eligibleOpponentIds: [away.SG, away.C],
      }),
    ).toBe(away.SG);
  });

  it('selects defensive SAFE/RISKY mode only from defensiveRisk tendency', () => {
    const defender = player('AWAY-01');
    const safe = withPlayer(defender, {
      tendencies: { ...defender.tendencies, defensiveRisk: 0 },
    });
    const risky = withPlayer(defender, {
      tendencies: { ...defender.tendencies, defensiveRisk: 100 },
    });
    expect(selectModelBDefensiveMode({ context, defender: safe, modeInstanceIndex: 0 }).value).toBe(
      'SAFE',
    );
    const riskyResult = selectModelBDefensiveMode({
      context,
      defender: risky,
      modeInstanceIndex: 0,
    });
    expect(riskyResult.value).toBe('RISKY');
    expect(riskyResult.drawKey).toMatchObject({ drawKind: 'DEFENSIVE_ACTION', localIndex: 0 });
  });

  it('rejects non-selectable IDs even when supplied through runtime data', () => {
    expect(() =>
      selectModelBBehavior({
        context,
        behaviorSelectionOrdinal: 0,
        decisionPlayer: player('HOME-01'),
        legalBehaviorIds: ['FT' as ModelBBehaviorId],
        safeFallbackBehaviorId: 'FT' as ModelBBehaviorId,
      }),
    ).toThrow(/cannot enter P_select/);
  });
});
