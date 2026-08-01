import { DomainRuleError } from './errors.js';
import type { DeterministicRng } from './rng.js';
import type { GameState, MatchResult, Player } from './schemas.js';

function playerRating(player: Player): number {
  const base =
    player.attributes.offense * 0.34 +
    player.attributes.defense * 0.28 +
    player.attributes.athleticism * 0.2 +
    player.attributes.stamina * 0.18;
  const conditionMultiplier =
    0.82 +
    player.condition.morale / 500 +
    player.condition.focus / 1000 -
    player.condition.fatigue / 500;
  return Math.max(1, base * conditionMultiplier);
}

function allocatePoints(total: number, players: readonly Player[]): MatchResult['playerStats'] {
  const weights = players.map((player) => Math.max(1, player.attributes.offense));
  const weightTotal = weights.reduce((sum, weight) => sum + weight, 0);
  const rawShares = weights.map((weight) => (total * weight) / weightTotal);
  const points = rawShares.map((share) => Math.floor(share));
  let remainder = total - points.reduce((sum, value) => sum + value, 0);

  const allocationOrder = rawShares
    .map((share, index) => ({
      index,
      fraction: share - Math.floor(share),
    }))
    .sort((left, right) => right.fraction - left.fraction || left.index - right.index);

  for (const item of allocationOrder) {
    if (remainder === 0) break;
    const current = points[item.index];
    if (current === undefined) throw new Error('Point-allocation index is invalid.');
    points[item.index] = current + 1;
    remainder -= 1;
  }

  return players.map((player, index) => ({
    playerId: player.id,
    points: points[index] ?? 0,
  }));
}

export function simulateModelAMatch(state: GameState, rng: DeterministicRng): MatchResult {
  const activePlayers = state.team.activePlayerIds
    .map((id) => state.players.find((player) => player.id === id))
    .filter((player): player is Player => player !== undefined && player.activeStatus === 'ACTIVE')
    .sort((left, right) => playerRating(right) - playerRating(left))
    .slice(0, 12);

  if (activePlayers.length < 5) {
    throw new DomainRuleError(
      'NO_ACTIVE_PLAYERS',
      'Model A requires at least five active players.',
    );
  }

  const callStart = rng.calls('match');
  const teamRating =
    activePlayers.reduce((sum, player) => sum + playerRating(player), 0) / activePlayers.length;
  const opponentRating = 43 + state.season.schoolYearIndex * 4 + rng.nextInt('match', -4, 7);
  const homeVariance = rng.nextInt('match', -8, 8);
  const awayVariance = rng.nextInt('match', -8, 8);

  let homeScore = Math.max(35, Math.round(42 + teamRating * 0.55 + homeVariance));
  let awayScore = Math.max(35, Math.round(42 + opponentRating * 0.55 + awayVariance));
  if (homeScore === awayScore) {
    if (rng.nextInt('match', 0, 1) === 0) homeScore += 1;
    else awayScore += 1;
  }

  const result: MatchResult = {
    id: `match-${state.metrics.matches + 1}`,
    absoluteWeek: state.currentWeek?.absoluteWeek ?? state.metrics.resolvedCalendarWeeks,
    homeTeamId: state.team.id,
    opponentId: `opponent-p01-year-${state.season.schoolYearIndex}`,
    seedRef: {
      stream: 'match',
      callStart,
      callEnd: rng.calls('match'),
    },
    score: {
      home: homeScore,
      away: awayScore,
    },
    playerStats: allocatePoints(homeScore, activePlayers),
    explanations: [
      `Prototype team rating ${teamRating.toFixed(2)} vs opponent ${opponentRating.toFixed(2)}.`,
      'P01 model A validates lifecycle and structured-result invariants, not final basketball balance.',
    ],
    simVersion: 'model-a-p01',
  };

  return result;
}
