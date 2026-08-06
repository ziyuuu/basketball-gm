import type { MatchAnchor, MatchEvent, MatchInput } from '../schemas.js';

type MatchSide = MatchAnchor['possession']['side'];
type PlayerBoxScore = MatchAnchor['boxScore']['home']['players'][number];
type StartingLineup = MatchAnchor['lineups']['home'];
type MatchRoles = MatchAnchor['roles']['home'];

export type ModelBEventReduction = Readonly<{
  score: MatchAnchor['score'];
  boxScore: MatchAnchor['boxScore'];
  lineups: MatchAnchor['lineups'];
  roles: MatchAnchor['roles'];
  periodClockSeconds: number;
}>;

function emptyPlayerBoxScore(playerId: string): PlayerBoxScore {
  return {
    playerId,
    secondsPlayed: 0,
    points: 0,
    fieldGoalsMade: 0,
    fieldGoalsAttempted: 0,
    threePointersMade: 0,
    threePointersAttempted: 0,
    freeThrowsMade: 0,
    freeThrowsAttempted: 0,
    offensiveRebounds: 0,
    defensiveRebounds: 0,
    assists: 0,
    steals: 0,
    blocks: 0,
    turnovers: 0,
    personalFouls: 0,
  };
}

export function createEmptyModelBBoxScore(input: MatchInput): MatchAnchor['boxScore'] {
  const byPlayerId = (left: { playerId: string }, right: { playerId: string }): number =>
    left.playerId < right.playerId ? -1 : left.playerId > right.playerId ? 1 : 0;
  return {
    home: {
      players: input.homeTeam.players
        .map(({ playerId }) => emptyPlayerBoxScore(playerId))
        .sort(byPlayerId),
    },
    away: {
      players: input.awayTeam.players
        .map(({ playerId }) => emptyPlayerBoxScore(playerId))
        .sort(byPlayerId),
    },
  };
}

function oppositeSide(side: MatchSide): MatchSide {
  return side === 'HOME' ? 'AWAY' : 'HOME';
}

function sideKey(side: MatchSide): 'home' | 'away' {
  return side === 'HOME' ? 'home' : 'away';
}

function replaceLineupPlayer(
  lineup: StartingLineup,
  roles: MatchRoles,
  outPlayerId: string,
  inPlayerId: string,
): Readonly<{ lineup: StartingLineup; roles: MatchRoles }> {
  const slot = (Object.keys(lineup) as (keyof StartingLineup)[]).find(
    (candidate) => lineup[candidate] === outPlayerId,
  );
  if (slot === undefined) throw new Error(`Outgoing player ${outPlayerId} is not in the lineup.`);
  if (Object.values(lineup).includes(inPlayerId)) {
    throw new Error(`Incoming player ${inPlayerId} is already in the lineup.`);
  }
  const nextLineup = { ...lineup, [slot]: inPlayerId };
  const nextRoles = {
    primaryOrganizer: roles.primaryOrganizer === outPlayerId ? inPlayerId : roles.primaryOrganizer,
    offensiveHub: roles.offensiveHub === outPlayerId ? inPlayerId : roles.offensiveHub,
    defensiveCaptain: roles.defensiveCaptain === outPlayerId ? inPlayerId : roles.defensiveCaptain,
  };
  return { lineup: nextLineup, roles: nextRoles };
}

/**
 * Pure event reducer. Score, player totals, clock, and lineup substitutions have
 * no non-event write path in Model B.
 */
export function reduceModelBEventPayloads(
  previousAnchor: MatchAnchor,
  payloads: readonly MatchEvent['payload'][],
  foulOutLimit: number,
): ModelBEventReduction {
  const score = { ...previousAnchor.score };
  const boxScore = {
    home: { players: previousAnchor.boxScore.home.players.map((player) => ({ ...player })) },
    away: { players: previousAnchor.boxScore.away.players.map((player) => ({ ...player })) },
  };
  const lineups = {
    home: { ...previousAnchor.lineups.home },
    away: { ...previousAnchor.lineups.away },
  };
  const roles = {
    home: { ...previousAnchor.roles.home },
    away: { ...previousAnchor.roles.away },
  };
  let periodClockSeconds = previousAnchor.periodClockSeconds;
  const offenseSide = previousAnchor.possession.side;
  const defenseSide = oppositeSide(offenseSide);

  const statsFor = (side: MatchSide, playerId: string): PlayerBoxScore => {
    const player = boxScore[sideKey(side)].players.find(
      (candidate) => candidate.playerId === playerId,
    );
    if (player === undefined) {
      throw new Error(`Player ${playerId} is not registered for ${side}.`);
    }
    return player;
  };

  const addSeconds = (side: MatchSide, seconds: number): void => {
    const key = sideKey(side);
    const activeIds = new Set(Object.values(lineups[key]));
    for (const player of boxScore[key].players) {
      if (activeIds.has(player.playerId) && player.personalFouls < foulOutLimit) {
        player.secondsPlayed += seconds;
      }
    }
  };

  for (const payload of payloads) {
    switch (payload.type) {
      case 'CLOCK_ADVANCED':
        if (payload.seconds > periodClockSeconds) {
          throw new Error('CLOCK_ADVANCED cannot move the period clock below zero.');
        }
        periodClockSeconds -= payload.seconds;
        addSeconds('HOME', payload.seconds);
        addSeconds('AWAY', payload.seconds);
        break;
      case 'SHOT': {
        const player = statsFor(offenseSide, payload.shooterId);
        player.fieldGoalsAttempted += 1;
        if (payload.made) player.fieldGoalsMade += 1;
        if (payload.zone === 'THREE_POINT') {
          player.threePointersAttempted += 1;
          if (payload.made) player.threePointersMade += 1;
        }
        break;
      }
      case 'FREE_THROW': {
        const player = statsFor(offenseSide, payload.shooterId);
        player.freeThrowsAttempted += 1;
        if (payload.made) player.freeThrowsMade += 1;
        break;
      }
      case 'SCORE': {
        if (payload.side !== offenseSide) {
          throw new Error('SCORE must be attributed to the current possession side.');
        }
        score[sideKey(payload.side)] += payload.points;
        statsFor(payload.side, payload.playerId).points += payload.points;
        break;
      }
      case 'REBOUND': {
        const side = payload.kind === 'OFFENSIVE' ? offenseSide : defenseSide;
        const player = statsFor(side, payload.playerId);
        if (payload.kind === 'OFFENSIVE') player.offensiveRebounds += 1;
        else player.defensiveRebounds += 1;
        break;
      }
      case 'TURNOVER':
        statsFor(offenseSide, payload.playerId).turnovers += 1;
        break;
      case 'FOUL':
        statsFor(
          payload.foulKind === 'OFFENSIVE' ? offenseSide : defenseSide,
          payload.playerId,
        ).personalFouls += 1;
        break;
      case 'ASSIST':
        statsFor(offenseSide, payload.playerId).assists += 1;
        break;
      case 'STEAL':
        statsFor(defenseSide, payload.playerId).steals += 1;
        break;
      case 'BLOCK':
        statsFor(defenseSide, payload.playerId).blocks += 1;
        break;
      case 'SUBSTITUTION': {
        const key = sideKey(payload.side);
        statsFor(payload.side, payload.outPlayerId);
        statsFor(payload.side, payload.inPlayerId);
        const replacement = replaceLineupPlayer(
          lineups[key],
          roles[key],
          payload.outPlayerId,
          payload.inPlayerId,
        );
        lineups[key] = replacement.lineup;
        roles[key] = replacement.roles;
        break;
      }
      case 'POSSESSION_STARTED':
      case 'POSSESSION_ENDED':
      case 'EFFECT_APPLIED':
      case 'PERIOD_COMPLETED':
      case 'MATCH_COMPLETED':
        break;
    }
  }

  return Object.freeze({ score, boxScore, lineups, roles, periodClockSeconds });
}
