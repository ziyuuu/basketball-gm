import {
  canonicalizeV2,
  clampFixedPoint,
  compareUtf16CodeUnits,
  idHash,
  roundHalfUp,
} from '../../core/index.js';
import { replaceMatchEffect } from '../effects.js';
import {
  MatchEffectSchema,
  deriveEffectKey,
  type MatchAnchor,
  type MatchEffect,
  type MatchEvent,
} from '../schemas.js';
import {
  calculateEnergyBaseCostMilli,
  calculateLineupChemistryMilli,
  modelBAbilityValues,
  type MatchPlayerSnapshot,
} from './effective-values.js';
import { MODEL_B_FORCED_MISMATCH_REASON_CODES, MODEL_B_PARAMETER_REGISTRY } from './registries.js';
import type { ModelBMatchInput, ModelBSession } from './session.js';

export const MODEL_B_INTERNAL_TEST_ROTATION_POLICY_ID = 'model-b-neutral-rotation/internal/test/v1';
export const MODEL_B_OPPONENT_POLICY_ID = 'model-b-opponent-policy/v1';
export const MODEL_B_FOUL_OUT_RULE_ID = 'model-b-foul-out/v1';

type MatchSide = MatchAnchor['possession']['side'];
type SideKey = 'home' | 'away';
type StartingLineup = MatchAnchor['lineups']['home'];
type MatchPosition = keyof StartingLineup;
type MatchRoles = MatchAnchor['roles']['home'];
type MatchBoxScore = MatchAnchor['boxScore'];

const POSITION_ORDER = Object.freeze(['PG', 'SG', 'SF', 'PF', 'C'] as const);

function sideKey(side: MatchSide): SideKey {
  return side === 'HOME' ? 'home' : 'away';
}

function oppositeSide(side: MatchSide): MatchSide {
  return side === 'HOME' ? 'AWAY' : 'HOME';
}

function teamForSide(input: ModelBMatchInput, side: MatchSide): ModelBMatchInput['homeTeam'] {
  return side === 'HOME' ? input.homeTeam : input.awayTeam;
}

function boxPlayersForSide(boxScore: MatchBoxScore, side: MatchSide) {
  return boxScore[sideKey(side)].players;
}

function playerById(input: ModelBMatchInput, side: MatchSide): Map<string, MatchPlayerSnapshot> {
  return new Map(teamForSide(input, side).players.map((player) => [player.playerId, player]));
}

function foulCountById(boxScore: MatchBoxScore, side: MatchSide): Map<string, number> {
  return new Map(
    boxPlayersForSide(boxScore, side).map((player) => [player.playerId, player.personalFouls]),
  );
}

function replaceLineupPlayer(
  lineup: StartingLineup,
  outPlayerId: string,
  inPlayerId: string,
): StartingLineup {
  const slot = POSITION_ORDER.find((position) => lineup[position] === outPlayerId);
  if (slot === undefined) throw new Error(`Outgoing player ${outPlayerId} is not in the lineup.`);
  if (Object.values(lineup).includes(inPlayerId)) {
    throw new Error(`Incoming player ${inPlayerId} is already in the lineup.`);
  }
  return { ...lineup, [slot]: inPlayerId };
}

function currentAnchor(session: ModelBSession): MatchAnchor {
  const anchor = session.anchors.at(-1);
  if (anchor === undefined) throw new Error('A Model B session requires a current Anchor.');
  return anchor;
}

function rosterOrdinal(input: ModelBMatchInput, side: MatchSide, playerId: string): number {
  const ordinal = teamForSide(input, side).registeredRosterIds.indexOf(playerId);
  if (ordinal < 0) throw new Error(`Player ${playerId} is not registered for ${side}.`);
  return ordinal;
}

function positionFitOrdinal(player: MatchPlayerSnapshot, position: MatchPosition): number {
  if (player.primaryPosition === position) return 0;
  // secondaryPosition is compat-only; all non-primary positions tie at rank 1
  return 1;
}

function positionAbilitySummary(player: MatchPlayerSnapshot, position: MatchPosition): number {
  const ability = modelBAbilityValues(player);
  switch (position) {
    case 'PG':
      return (
        ability.ballHandling * 300 +
        ability.playmaking * 350 +
        ability.shooting * 150 +
        ability.perimeterDefense * 100 +
        ability.tacticalUnderstanding * 100
      );
    case 'SG':
      return (
        ability.shooting * 350 +
        ability.finishing * 200 +
        ability.ballHandling * 150 +
        ability.perimeterDefense * 150 +
        ability.athleticism * 150
      );
    case 'SF':
      return (
        ability.shooting * 200 +
        ability.finishing * 200 +
        ability.perimeterDefense * 200 +
        ability.athleticism * 200 +
        ability.rebounding * 200
      );
    case 'PF':
      return (
        ability.finishing * 200 +
        ability.interiorDefense * 250 +
        ability.rebounding * 250 +
        ability.athleticism * 150 +
        ability.shooting * 150
      );
    case 'C':
      return (
        ability.interiorDefense * 250 +
        ability.rebounding * 300 +
        ability.strength * 200 +
        ability.finishing * 150 +
        ability.tacticalUnderstanding * 100
      );
  }
}

function eligibleIdsForLineup(
  lineup: StartingLineup,
  fouls: ReadonlyMap<string, number>,
  foulOutLimit: number,
): string[] {
  return POSITION_ORDER.map((position) => lineup[position]).filter(
    (playerId) => (fouls.get(playerId) ?? foulOutLimit) < foulOutLimit,
  );
}

export function eligibleModelBLineupPlayerIds(
  anchor: MatchAnchor,
  side: MatchSide,
  foulOutLimit = MODEL_B_PARAMETER_REGISTRY.foulOutLimit,
): string[] {
  return eligibleIdsForLineup(
    anchor.lineups[sideKey(side)],
    foulCountById(anchor.boxScore, side),
    foulOutLimit,
  );
}

export function calculateModelBShortHandedDefensePenaltyMilli(
  anchor: MatchAnchor,
  side: MatchSide,
): number {
  const missingPlayers = 5 - eligibleModelBLineupPlayerIds(anchor, side).length;
  return -(
    missingPlayers * MODEL_B_PARAMETER_REGISTRY.shortHandedDefensePenaltyMilliPerMissingPlayer
  );
}

/**
 * v2.10: Accumulates energy from committed CLOCK_ADVANCED payloads.
 * Base cost (time-only, no pace/defense/kind multiplier) + bench recovery.
 * Behavior-participant costs are added separately by the runner.
 */
export function reduceModelBCommittedEnergy(
  input: ModelBMatchInput,
  previousAnchor: MatchAnchor,
  payloads: readonly MatchEvent['payload'][],
): MatchAnchor['fatigueMilliByPlayer'] {
  const energy = { ...previousAnchor.fatigueMilliByPlayer };
  const lineups = {
    home: { ...previousAnchor.lineups.home },
    away: { ...previousAnchor.lineups.away },
  };
  const fouls = {
    home: foulCountById(previousAnchor.boxScore, 'HOME'),
    away: foulCountById(previousAnchor.boxScore, 'AWAY'),
  };
  const snapshots = {
    home: playerById(input, 'HOME'),
    away: playerById(input, 'AWAY'),
  };
  const offenseSide = previousAnchor.possession.side;
  const defenseSide = oppositeSide(offenseSide);

  // Total clock seconds in this transition
  const totalClockSeconds = payloads
    .filter(
      (p): p is Extract<MatchEvent['payload'], { type: 'CLOCK_ADVANCED' }> =>
        p.type === 'CLOCK_ADVANCED',
    )
    .reduce((sum, p) => sum + p.seconds, 0);

  // Base energy cost for all 10 on-court eligible players (per stamina)
  const addBaseEnergyCost = (side: MatchSide): void => {
    const key = sideKey(side);
    for (const playerId of eligibleIdsForLineup(
      lineups[key],
      fouls[key],
      input.rules.foulOutLimit,
    )) {
      const player = snapshots[key].get(playerId);
      if (player === undefined) throw new Error(`Energy player ${playerId} is not registered.`);
      const increment = calculateEnergyBaseCostMilli(
        totalClockSeconds,
        modelBAbilityValues(player).stamina,
      );
      energy[playerId] = clampFixedPoint((energy[playerId] ?? 0) + increment, 0, 100_000);
    }
  };
  addBaseEnergyCost('HOME');
  addBaseEnergyCost('AWAY');

  // Bench recovery: players NOT in either lineup recover per elapsed time
  const allCourtPlayerIds = new Set([
    ...Object.values(lineups.home),
    ...Object.values(lineups.away),
  ]);
  const allPlayers = [...playerById(input, 'HOME').values(), ...playerById(input, 'AWAY').values()];
  for (const player of allPlayers) {
    if (!allCourtPlayerIds.has(player.playerId)) {
      const recovery = totalClockSeconds * MODEL_B_PARAMETER_REGISTRY.benchRecoveryPerSecondMilli;
      energy[player.playerId] = clampFixedPoint(
        (energy[player.playerId] ?? 0) - recovery,
        0,
        100_000,
      );
    }
  }

  // Process fouls and substitutions
  for (const payload of payloads) {
    if (payload.type === 'FOUL') {
      const side = payload.foulKind === 'OFFENSIVE' ? offenseSide : defenseSide;
      const key = sideKey(side);
      fouls[key].set(payload.playerId, (fouls[key].get(payload.playerId) ?? 0) + 1);
    } else if (payload.type === 'SUBSTITUTION') {
      const key = sideKey(payload.side);
      lineups[key] = replaceLineupPlayer(lineups[key], payload.outPlayerId, payload.inPlayerId);
    }
  }
  return energy;
}

/** @deprecated v2.9 — use reduceModelBCommittedEnergy */
export const reduceModelBCommittedFatigue = reduceModelBCommittedEnergy;

function roleScore(player: MatchPlayerSnapshot, role: keyof MatchRoles): number {
  const ability = modelBAbilityValues(player);
  if (role === 'primaryOrganizer') {
    return ability.playmaking * 1_000 + ability.ballHandling;
  }
  if (role === 'offensiveHub') {
    return ability.playmaking * 1_000 + ability.tacticalUnderstanding;
  }
  return (
    (ability.perimeterDefense + ability.interiorDefense) * 1_000 + ability.tacticalUnderstanding
  );
}

export function recalculateModelBEligibleLineupState(
  input: ModelBMatchInput,
  lineups: MatchAnchor['lineups'],
  previousRoles: MatchAnchor['roles'],
  boxScore: MatchAnchor['boxScore'],
): Readonly<{
  roles: MatchAnchor['roles'];
  chemistryWeightedMilli: MatchAnchor['chemistryWeightedMilli'];
}> {
  const nextRoles = {
    home: { ...previousRoles.home },
    away: { ...previousRoles.away },
  };
  const chemistryWeightedMilli = { home: 0, away: 0 };
  for (const side of ['HOME', 'AWAY'] as const) {
    const key = sideKey(side);
    const fouls = foulCountById(boxScore, side);
    const eligibleIds = eligibleIdsForLineup(lineups[key], fouls, input.rules.foulOutLimit);
    const players = playerById(input, side);
    for (const role of ['primaryOrganizer', 'offensiveHub', 'defensiveCaptain'] as const) {
      if (eligibleIds.includes(nextRoles[key][role])) continue;
      const replacement = [...eligibleIds].sort((leftId, rightId) => {
        const left = players.get(leftId)!;
        const right = players.get(rightId)!;
        return (
          roleScore(right, role) - roleScore(left, role) ||
          rosterOrdinal(input, side, leftId) - rosterOrdinal(input, side, rightId) ||
          compareUtf16CodeUnits(leftId, rightId)
        );
      })[0];
      if (replacement !== undefined) nextRoles[key][role] = replacement;
    }
    if (eligibleIds.length >= 2) {
      chemistryWeightedMilli[key] = calculateLineupChemistryMilli(
        eligibleIds.map((playerId) => players.get(playerId)!),
        nextRoles[key],
      );
    }
  }
  return { roles: nextRoles, chemistryWeightedMilli };
}

function participantForPayload(
  payload: MatchEvent['payload'],
  offenseSide: MatchSide,
): Readonly<{ side: MatchSide; playerId: string }> | null {
  const defenseSide = oppositeSide(offenseSide);
  switch (payload.type) {
    case 'SHOT':
    case 'FREE_THROW':
      return { side: offenseSide, playerId: payload.shooterId };
    case 'TURNOVER':
    case 'ASSIST':
    case 'SCORE':
      return { side: offenseSide, playerId: payload.playerId };
    case 'STEAL':
    case 'BLOCK':
      return { side: defenseSide, playerId: payload.playerId };
    case 'REBOUND':
      return {
        side: payload.kind === 'OFFENSIVE' ? offenseSide : defenseSide,
        playerId: payload.playerId,
      };
    case 'FOUL':
      return {
        side: payload.foulKind === 'OFFENSIVE' ? offenseSide : defenseSide,
        playerId: payload.playerId,
      };
    default:
      return null;
  }
}

/** Rejects participation after the fifth foul and rejects ineligible substitutes. */
export function assertModelBTransitionPlayerEligibility(
  previousAnchor: MatchAnchor,
  payloads: readonly MatchEvent['payload'][],
  foulOutLimit: number,
): void {
  const offenseSide = previousAnchor.possession.side;
  const lineups = {
    home: { ...previousAnchor.lineups.home },
    away: { ...previousAnchor.lineups.away },
  };
  const fouls = {
    home: foulCountById(previousAnchor.boxScore, 'HOME'),
    away: foulCountById(previousAnchor.boxScore, 'AWAY'),
  };
  let previousPayload: MatchEvent['payload'] | null = null;
  for (const payload of payloads) {
    if (payload.type === 'SUBSTITUTION') {
      const key = sideKey(payload.side);
      const outgoingFouls = fouls[key].get(payload.outPlayerId);
      const incomingFouls = fouls[key].get(payload.inPlayerId);
      if (outgoingFouls === undefined || incomingFouls === undefined) {
        throw new Error('A substitution must use two registered players from its side.');
      }
      if (incomingFouls >= foulOutLimit) {
        throw new Error('A fouled-out player cannot enter the match.');
      }
      if (
        payload.forced &&
        outgoingFouls < foulOutLimit &&
        payload.reasonCode !== MODEL_B_FORCED_MISMATCH_REASON_CODES.NO_PRIMARY_CANDIDATE
      ) {
        throw new Error('A forced Model B substitution requires a fouled-out player.');
      }
      lineups[key] = replaceLineupPlayer(lineups[key], payload.outPlayerId, payload.inPlayerId);
      previousPayload = payload;
      continue;
    }
    const participant = participantForPayload(payload, offenseSide);
    if (participant === null) {
      previousPayload = payload;
      continue;
    }
    const key = sideKey(participant.side);
    const currentFouls = fouls[key].get(participant.playerId);
    if (currentFouls === undefined) {
      throw new Error('A Model B participant is not registered for the attributed side.');
    }
    if (!Object.values(lineups[key]).includes(participant.playerId)) {
      throw new Error('A Model B participant must be in the current lineup.');
    }
    const isAtomicOffensiveFoulTurnover =
      payload.type === 'TURNOVER' &&
      payload.turnoverKind === 'OFFENSIVE_FOUL' &&
      previousPayload?.type === 'FOUL' &&
      previousPayload.foulKind === 'OFFENSIVE' &&
      previousPayload.playerId === payload.playerId;
    if (currentFouls >= foulOutLimit && !isAtomicOffensiveFoulTurnover) {
      throw new Error('A player may not participate after reaching the foul-out limit.');
    }
    if (payload.type === 'FOUL') fouls[key].set(participant.playerId, currentFouls + 1);
    previousPayload = payload;
  }
}

type PlannedSubstitution = Readonly<{
  side: MatchSide;
  position: MatchPosition;
  outPlayerId: string;
  inPlayerId: string;
  forced: boolean;
  reasonCode: string;
}>;

/**
 * Selects the best bench replacement for a lineup position, enforcing a hard primary-first
 * constraint. Non-primary candidates are only considered when no primary-position bench
 * player is eligible (foul-free and not already in the lineup).
 */
function selectBestPrimaryOrFallback(
  session: ModelBSession,
  side: MatchSide,
  position: MatchPosition,
  lineup: StartingLineup,
  minimumEnergyAdvantageMilli: number,
  outgoingFatigueMilli: number,
): { player: MatchPlayerSnapshot; reasonCode: string } | null {
  const candidates = sortedReplacementCandidates(session, side, position, lineup);
  if (candidates.length === 0) return null;

  // Step 1: Try primary-position players first
  const primaryCandidates = candidates.filter((p) => p.primaryPosition === position);
  const bestPrimary = primaryCandidates.find(
    (player) =>
      outgoingFatigueMilli - (currentAnchor(session).fatigueMilliByPlayer[player.playerId] ?? 0) >=
      minimumEnergyAdvantageMilli,
  );
  if (bestPrimary !== undefined) {
    return { player: bestPrimary, reasonCode: 'INTERNAL_TEST_FATIGUE_POSITION' };
  }

  // Step 2: Only fall to non-primary if NO primary candidate exists at all
  if (primaryCandidates.length === 0) {
    const bestFallback = candidates.find(
      (player) =>
        outgoingFatigueMilli -
          (currentAnchor(session).fatigueMilliByPlayer[player.playerId] ?? 0) >=
        minimumEnergyAdvantageMilli,
    );
    if (bestFallback !== undefined) {
      return {
        player: bestFallback,
        reasonCode: MODEL_B_FORCED_MISMATCH_REASON_CODES.NO_PRIMARY_CANDIDATE,
      };
    }
  }

  return null; // No suitable replacement
}

/**
 * Checks whether a currently-mismatched slot can be restored to a primary-position bench
 * player. Returns the bench playerId if restoration is possible, null otherwise.
 */
function canRestorePrimaryPosition(
  session: ModelBSession,
  side: MatchSide,
  position: MatchPosition,
  currentLineup: StartingLineup,
): string | null {
  const currentPlayerId = currentLineup[position];
  const currentPlayer = playerById(session.input, side).get(currentPlayerId);
  if (currentPlayer === undefined || currentPlayer.primaryPosition === position) return null;

  const anchor = currentAnchor(session);
  const fouls = foulCountById(anchor.boxScore, side);
  const activeIds = new Set(Object.values(currentLineup));
  const benchPrimary = teamForSide(session.input, side).players.find(
    (p) =>
      !activeIds.has(p.playerId) &&
      p.primaryPosition === position &&
      (fouls.get(p.playerId) ?? session.input.rules.foulOutLimit) <
        session.input.rules.foulOutLimit,
  );
  if (benchPrimary === undefined) return null;

  // Prevent cross-boundary oscillation: only restore a primary-position player
  // whose consumed energy is below the neutral rotation fatigue threshold.
  // A player above this threshold would be immediately flagged as an outgoing
  // fatigue candidate on the next boundary, causing a restore→sub-out cycle.
  const benchEnergy = anchor.fatigueMilliByPlayer[benchPrimary.playerId] ?? 0;
  if (benchEnergy >= MODEL_B_PARAMETER_REGISTRY.neutralRotationEnergyThresholdMilli) {
    return null;
  }

  return benchPrimary.playerId;
}

function sortedReplacementCandidates(
  session: ModelBSession,
  side: MatchSide,
  position: MatchPosition,
  lineup: StartingLineup,
): MatchPlayerSnapshot[] {
  const anchor = currentAnchor(session);
  const fouls = foulCountById(anchor.boxScore, side);
  const activeIds = new Set(Object.values(lineup));
  return teamForSide(session.input, side)
    .players.filter(
      (player) =>
        !activeIds.has(player.playerId) &&
        (fouls.get(player.playerId) ?? session.input.rules.foulOutLimit) <
          session.input.rules.foulOutLimit,
    )
    .sort(
      (left, right) =>
        positionFitOrdinal(left, position) - positionFitOrdinal(right, position) ||
        anchor.fatigueMilliByPlayer[left.playerId]! -
          anchor.fatigueMilliByPlayer[right.playerId]! ||
        positionAbilitySummary(right, position) - positionAbilitySummary(left, position) ||
        rosterOrdinal(session.input, side, left.playerId) -
          rosterOrdinal(session.input, side, right.playerId) ||
        compareUtf16CodeUnits(left.playerId, right.playerId),
    );
}

export type ModelBFoulOutBoundaryPlan = Readonly<{
  ruleId: typeof MODEL_B_FOUL_OUT_RULE_ID;
  ruleInputHash: string;
  substitutions: readonly PlannedSubstitution[];
  eventPayloads: readonly MatchEvent['payload'][];
  forfeitingSide: MatchSide | null;
  status: MatchAnchor['status'];
}>;

export function buildModelBFoulOutBoundaryPlan(session: ModelBSession): ModelBFoulOutBoundaryPlan {
  const anchor = currentAnchor(session);
  const substitutions: PlannedSubstitution[] = [];
  const workingLineups = {
    home: { ...anchor.lineups.home },
    away: { ...anchor.lineups.away },
  };
  let forfeitingSide: MatchSide | null = null;

  for (const side of ['HOME', 'AWAY'] as const) {
    const key = sideKey(side);
    const fouls = foulCountById(anchor.boxScore, side);
    const eligibleRosterCount = [...fouls.values()].filter(
      (personalFouls) => personalFouls < session.input.rules.foulOutLimit,
    ).length;
    if (eligibleRosterCount < 2) {
      forfeitingSide = side;
      break;
    }
    for (const position of POSITION_ORDER) {
      const outPlayerId = workingLineups[key][position];
      if ((fouls.get(outPlayerId) ?? 0) < session.input.rules.foulOutLimit) continue;
      const replacement = sortedReplacementCandidates(
        session,
        side,
        position,
        workingLineups[key],
      )[0];
      if (replacement === undefined) continue;
      const isMismatch = replacement.primaryPosition !== position;
      substitutions.push({
        side,
        position,
        outPlayerId,
        inPlayerId: replacement.playerId,
        forced: true,
        reasonCode: isMismatch
          ? MODEL_B_FORCED_MISMATCH_REASON_CODES.NO_PRIMARY_CANDIDATE
          : 'FOUL_OUT_FORCED_REPLACEMENT',
      });
      workingLineups[key] = replaceLineupPlayer(
        workingLineups[key],
        outPlayerId,
        replacement.playerId,
      );
    }
  }

  const eventPayloads: MatchEvent['payload'][] = substitutions.map((substitution) => ({
    type: 'SUBSTITUTION',
    side: substitution.side,
    outPlayerId: substitution.outPlayerId,
    inPlayerId: substitution.inPlayerId,
    transcriptEntryHash: null,
    forced: true,
    reasonCode: substitution.reasonCode,
  }));
  if (forfeitingSide !== null) {
    eventPayloads.length = 0;
    eventPayloads.push({
      type: 'MATCH_COMPLETED',
      terminationReason: 'FORFEIT_INSUFFICIENT_PLAYERS',
    });
  }
  const ruleInputHash = idHash('model-b-foul-out-input-v1', {
    matchId: session.input.matchId,
    anchorHash: anchor.anchorHash,
    foulOutLimit: session.input.rules.foulOutLimit,
    lineups: anchor.lineups,
    personalFouls: anchor.boxScore,
  });
  return {
    ruleId: MODEL_B_FOUL_OUT_RULE_ID,
    ruleInputHash,
    substitutions,
    eventPayloads,
    forfeitingSide,
    status: forfeitingSide === null ? 'IN_PROGRESS' : 'FORFEIT_INSUFFICIENT_PLAYERS',
  };
}

export type ModelBNeutralRotationPlan = Readonly<{
  policyId: typeof MODEL_B_INTERNAL_TEST_ROTATION_POLICY_ID;
  policyInputHash: string;
  reasonCode:
    | 'INTERNAL_TEST_FATIGUE_POSITION'
    | typeof MODEL_B_FORCED_MISMATCH_REASON_CODES.NO_PRIMARY_CANDIDATE;
  substitutions: readonly PlannedSubstitution[];
  eventPayloads: readonly MatchEvent['payload'][];
}>;

export function buildModelBNeutralRotationPlan(session: ModelBSession): ModelBNeutralRotationPlan {
  const anchor = currentAnchor(session);
  if (session.input.controlStrategy !== 'INSTANT') {
    throw new Error('The P02-003 internal/test rotation is only available to INSTANT matches.');
  }
  if (
    anchor.controlBoundary === null ||
    !['DEAD_BALL', 'PERIOD_BREAK'].includes(anchor.controlBoundary.kind)
  ) {
    throw new Error('Neutral rotation requires a dead-ball or period-break control boundary.');
  }
  const substitutions: PlannedSubstitution[] = [];
  const workingLineups = {
    home: { ...anchor.lineups.home },
    away: { ...anchor.lineups.away },
  };
  for (const side of ['HOME', 'AWAY'] as const) {
    const key = sideKey(side);
    const fouls = foulCountById(anchor.boxScore, side);
    const outgoing = POSITION_ORDER.map((position) => ({
      position,
      playerId: workingLineups[key][position],
    }))
      .filter(
        ({ playerId }) =>
          (fouls.get(playerId) ?? session.input.rules.foulOutLimit) <
            session.input.rules.foulOutLimit &&
          anchor.fatigueMilliByPlayer[playerId]! >=
            MODEL_B_PARAMETER_REGISTRY.neutralRotationEnergyThresholdMilli,
      )
      .sort(
        (left, right) =>
          anchor.fatigueMilliByPlayer[right.playerId]! -
            anchor.fatigueMilliByPlayer[left.playerId]! ||
          POSITION_ORDER.indexOf(left.position) - POSITION_ORDER.indexOf(right.position) ||
          rosterOrdinal(session.input, side, left.playerId) -
            rosterOrdinal(session.input, side, right.playerId),
      );
    // v2.10: Return-to-normal — before processing outgoing fatigue subs,
    // check each slot for a mismatched player that can be restored to a
    // primary-position bench player.
    const restoredPositions = new Set<MatchPosition>();
    for (const position of POSITION_ORDER) {
      const restoreId = canRestorePrimaryPosition(session, side, position, workingLineups[key]);
      if (restoreId === null) continue;
      const currentId = workingLineups[key][position];
      substitutions.push({
        side,
        position,
        outPlayerId: currentId,
        inPlayerId: restoreId,
        forced: false,
        reasonCode: 'INTERNAL_TEST_FATIGUE_POSITION',
      });
      workingLineups[key] = replaceLineupPlayer(workingLineups[key], currentId, restoreId);
      // Prevent the outgoing pass from immediately re-substituting the just-restored position
      restoredPositions.add(position);
    }
    for (const candidate of outgoing) {
      // Skip positions just restored — avoid ping-pong with the outgoing fatigue loop
      if (restoredPositions.has(candidate.position)) continue;
      const result = selectBestPrimaryOrFallback(
        session,
        side,
        candidate.position,
        workingLineups[key],
        MODEL_B_PARAMETER_REGISTRY.neutralRotationMinimumEnergyAdvantageMilli,
        anchor.fatigueMilliByPlayer[candidate.playerId]!,
      );
      if (result === null) continue;
      substitutions.push({
        side,
        position: candidate.position,
        outPlayerId: candidate.playerId,
        inPlayerId: result.player.playerId,
        forced: result.reasonCode === MODEL_B_FORCED_MISMATCH_REASON_CODES.NO_PRIMARY_CANDIDATE,
        reasonCode: result.reasonCode,
      });
      workingLineups[key] = replaceLineupPlayer(
        workingLineups[key],
        candidate.playerId,
        result.player.playerId,
      );
    }
  }
  const eventPayloads: MatchEvent['payload'][] = substitutions.map((substitution) => ({
    type: 'SUBSTITUTION',
    side: substitution.side,
    outPlayerId: substitution.outPlayerId,
    inPlayerId: substitution.inPlayerId,
    transcriptEntryHash: null,
    forced: substitution.forced,
    reasonCode: substitution.reasonCode,
  }));
  return {
    policyId: MODEL_B_INTERNAL_TEST_ROTATION_POLICY_ID,
    policyInputHash: idHash('model-b-neutral-rotation-input-v1', {
      matchId: session.input.matchId,
      anchorHash: anchor.anchorHash,
      label: 'internal/test',
      fatigueMilliByPlayer: anchor.fatigueMilliByPlayer,
      lineups: anchor.lineups,
    }),
    reasonCode: 'INTERNAL_TEST_FATIGUE_POSITION',
    substitutions,
    eventPayloads,
  };
}

function averageEligibleEnergy(session: ModelBSession, side: MatchSide): number {
  const anchor = currentAnchor(session);
  const ids = eligibleModelBLineupPlayerIds(anchor, side);
  if (ids.length === 0) return 100_000;
  return roundHalfUp(
    ids.reduce((total, playerId) => total + anchor.fatigueMilliByPlayer[playerId]!, 0),
    ids.length,
  );
}

/** @deprecated v2.9 — use averageEligibleEnergy */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const averageEligibleFatigue = averageEligibleEnergy;

function opponentPolicyEffect(
  input: Readonly<{
    anchor: MatchAnchor;
    side: MatchSide;
    reasonCode: string;
    parameter: MatchEffect['parameter'];
    multiplierMilli: number;
  }>,
): MatchEffect {
  if (input.anchor.controlBoundary === null) {
    throw new Error('Opponent policy effects require a control boundary.');
  }
  const source = {
    kind: 'OPPONENT_POLICY' as const,
    sourceId: MODEL_B_OPPONENT_POLICY_ID,
    reasonCode: input.reasonCode,
  };
  const target = {
    side: input.side,
    scope: 'TEAM' as const,
    playerId: null,
    behavior: null,
  };
  const identity = { source, target, parameter: input.parameter };
  return MatchEffectSchema.parse({
    effectKey: deriveEffectKey(identity),
    source,
    sourceRevision: input.anchor.localRevision + 1,
    controlBoundary: input.anchor.controlBoundary,
    effectiveFromSegmentKey: {
      period: input.anchor.controlBoundary.period,
      possessionIndex: input.anchor.controlBoundary.possessionIndex,
      segmentIndex: input.anchor.controlBoundary.segmentIndex,
    },
    target,
    parameter: input.parameter,
    modifier: { mode: 'MULTIPLY', multiplierMilli: input.multiplierMilli },
    duration: { kind: 'UNTIL_REPLACED' },
  });
}

export type ModelBOpponentPolicyPlan = Readonly<{
  policyId: typeof MODEL_B_OPPONENT_POLICY_ID;
  policyInputHash: string;
  reasonCodes: readonly string[];
  effectiveFragment: MatchAnchor['effectiveFragment'];
  eventPayloads: readonly MatchEvent['payload'][];
}>;

/** Minimal, deterministic period-break policy. It does not inspect win history or difficulty. */
export function buildModelBOpponentPolicyPlan(
  session: ModelBSession,
  opponentSide: MatchSide = 'AWAY',
): ModelBOpponentPolicyPlan {
  const anchor = currentAnchor(session);
  if (anchor.controlBoundary?.kind !== 'PERIOD_BREAK') {
    throw new Error('The minimum opponent policy only evaluates at period breaks.');
  }
  const playerSide = oppositeSide(opponentSide);
  const opponentKey = sideKey(opponentSide);
  const playerKey = sideKey(playerSide);
  const opponentScore = anchor.score[opponentKey];
  const playerScore = anchor.score[playerKey];
  const scoreMargin = opponentScore - playerScore;
  const tactics = { ...anchor.effectiveFragment.tactics[opponentKey] };
  const reasonCodes: string[] = [];
  const effects: MatchEffect[] = [];

  if (scoreMargin <= -8) {
    tactics.pace = 'FAST';
    reasonCodes.push('TRAILING_EIGHT_ACCELERATE');
    effects.push(
      opponentPolicyEffect({
        anchor,
        side: opponentSide,
        reasonCode: 'TRAILING_EIGHT_ACCELERATE',
        parameter: 'PACE',
        multiplierMilli: MODEL_B_PARAMETER_REGISTRY.paceLoadFactors_LEGACY.FAST,
      }),
    );
  } else if (
    scoreMargin >= 8 ||
    averageEligibleEnergy(session, opponentSide) >=
      MODEL_B_PARAMETER_REGISTRY.neutralRotationEnergyThresholdMilli
  ) {
    tactics.pace = 'SLOW';
    const reasonCode = scoreMargin >= 8 ? 'LEADING_EIGHT_SLOW' : 'HIGH_FATIGUE_SLOW';
    reasonCodes.push(reasonCode);
    effects.push(
      opponentPolicyEffect({
        anchor,
        side: opponentSide,
        reasonCode,
        parameter: 'PACE',
        multiplierMilli: MODEL_B_PARAMETER_REGISTRY.paceLoadFactors_LEGACY.SLOW,
      }),
    );
  }

  const playerDefensiveFocus = anchor.effectiveFragment.tactics[playerKey].defensiveFocus;
  if (playerDefensiveFocus === 'PAINT_PROTECT') {
    tactics.offensiveFocus = 'PERIMETER';
    reasonCodes.push('PLAYER_PAINT_PROTECT_ATTACK_PERIMETER');
    effects.push(
      opponentPolicyEffect({
        anchor,
        side: opponentSide,
        reasonCode: 'PLAYER_PAINT_PROTECT_ATTACK_PERIMETER',
        parameter: 'PERIMETER_ATTEMPT_WEIGHT',
        multiplierMilli:
          MODEL_B_PARAMETER_REGISTRY.offensiveFocusAttemptFactors.PERIMETER.PERIMETER,
      }),
    );
  } else if (playerDefensiveFocus === 'PRESSURE') {
    tactics.offensiveFocus = 'INTERIOR';
    reasonCodes.push('PLAYER_PRESSURE_ATTACK_INTERIOR');
    effects.push(
      opponentPolicyEffect({
        anchor,
        side: opponentSide,
        reasonCode: 'PLAYER_PRESSURE_ATTACK_INTERIOR',
        parameter: 'INTERIOR_ATTEMPT_WEIGHT',
        multiplierMilli: MODEL_B_PARAMETER_REGISTRY.offensiveFocusAttemptFactors.INTERIOR.INTERIOR,
      }),
    );
  }

  const withoutOldPolicy = anchor.effectiveFragment.effects.filter(
    (effect) =>
      !(
        effect.source.kind === 'OPPONENT_POLICY' &&
        effect.source.sourceId === MODEL_B_OPPONENT_POLICY_ID &&
        effect.target.side === opponentSide
      ),
  );
  let nextEffects = withoutOldPolicy;
  for (const effect of effects) nextEffects = replaceMatchEffect(nextEffects, effect);
  const effectiveFragment = {
    ...anchor.effectiveFragment,
    tactics: {
      home: {
        ...anchor.effectiveFragment.tactics.home,
        ...(opponentSide === 'HOME' ? tactics : {}),
      },
      away: {
        ...anchor.effectiveFragment.tactics.away,
        ...(opponentSide === 'AWAY' ? tactics : {}),
      },
    },
    effects: nextEffects,
  };
  const policyInputHash = idHash('model-b-opponent-policy-input-v1', {
    matchId: session.input.matchId,
    anchorHash: anchor.anchorHash,
    period: anchor.period,
    score: anchor.score,
    opponentSide,
    opponentEnergyMilli: averageEligibleEnergy(session, opponentSide),
    playerDefensiveFocus,
  });
  return {
    policyId: MODEL_B_OPPONENT_POLICY_ID,
    policyInputHash,
    reasonCodes,
    effectiveFragment,
    eventPayloads: effects.map((effect) => ({
      type: 'EFFECT_APPLIED',
      effectKey: effect.effectKey,
    })),
  };
}

export function assertModelBEffectApplication(
  previousEffects: readonly MatchEffect[],
  nextEffects: readonly MatchEffect[],
  payloads: readonly MatchEvent['payload'][],
): void {
  const appliedKeys = payloads
    .filter(
      (payload): payload is Extract<MatchEvent['payload'], { type: 'EFFECT_APPLIED' }> =>
        payload.type === 'EFFECT_APPLIED',
    )
    .map(({ effectKey }) => effectKey);
  if (new Set(appliedKeys).size !== appliedKeys.length) {
    throw new Error('One transition may apply each effect key at most once.');
  }
  const previousByKey = new Map(previousEffects.map((effect) => [effect.effectKey, effect]));
  const nextByKey = new Map(nextEffects.map((effect) => [effect.effectKey, effect]));
  for (const effect of nextEffects) {
    const previous = previousByKey.get(effect.effectKey);
    if (
      (previous === undefined || canonicalizeV2(previous) !== canonicalizeV2(effect)) &&
      !appliedKeys.includes(effect.effectKey)
    ) {
      throw new Error('Every added or replaced effect requires an EFFECT_APPLIED event.');
    }
  }
  for (const key of appliedKeys) {
    const effect = nextByKey.get(key);
    if (effect === undefined) throw new Error('EFFECT_APPLIED must name an active next effect.');
    const previous = previousByKey.get(key);
    if (previous !== undefined && canonicalizeV2(previous) === canonicalizeV2(effect)) {
      throw new Error('EFFECT_APPLIED must add or replace an effect definition.');
    }
  }
}
