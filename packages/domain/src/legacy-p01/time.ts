import {
  OPERATION_WEEKS_PER_TERM,
  P01_ANNUAL_GRANT,
  SCHOOL_YEARS_PER_RUN,
  WEEKS_PER_TERM,
} from './constants.js';
import { DomainRuleError } from './errors.js';
import { simulateModelAMatch } from './model-a.js';
import type { DeterministicRng } from './rng.js';
import type { AttributeState, DomainEvent, GameDate, GameState, Player, Week } from './schemas.js';

export interface DomainTransition {
  state: GameState;
  events: DomainEvent[];
}

function weekDate(week: Week): GameDate {
  return {
    schoolYearIndex: week.schoolYearIndex,
    term: week.term,
    weekOfTerm: week.weekOfTerm,
  };
}

function appendEvent(
  state: GameState,
  week: Week,
  events: DomainEvent[],
  type: DomainEvent['type'],
  payload: Record<string, unknown>,
): void {
  const committedRevision = state.revision + 1;
  const sequence = events.length + 1;
  events.push({
    id: `event-r${committedRevision}-w${week.absoluteWeek}-s${sequence}-${type}`,
    type,
    at: weekDate(week),
    payload,
  });
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Number(value.toFixed(3))));
}

function appendBudgetEntry(
  state: GameState,
  amount: number,
  reason: 'WEEKLY_OPERATIONS' | 'EXAM_MAINTENANCE' | 'ANNUAL_GRANT',
  week: Week,
): void {
  const nextBalance = state.budget.balance + amount;
  if (nextBalance < state.budget.reserved) {
    throw new DomainRuleError(
      'BUDGET_INSUFFICIENT',
      `Budget ${state.budget.balance} cannot cover ${Math.abs(amount)}.`,
    );
  }
  state.budget.balance = nextBalance;
  state.budget.ledger.push({
    sequence: state.budget.ledger.length,
    schoolYearIndex: week.schoolYearIndex,
    absoluteWeek: week.absoluteWeek,
    amount,
    balanceAfter: nextBalance,
    reason,
  });
}

function growPlayer(
  player: Player,
  focus: GameState['trainingPlan']['focus'],
  intensity: 0 | 1 | 2,
  rng: DeterministicRng,
): void {
  if (intensity === 0) {
    player.condition.fatigue = clamp(player.condition.fatigue - 7);
    player.condition.focus = clamp(player.condition.focus + 1);
    return;
  }

  const attributeNames = ['offense', 'defense', 'athleticism', 'stamina'] as const;
  const selected =
    focus === 'BALANCED'
      ? rng.pick('training-growth', attributeNames)
      : (
          {
            OFFENSE: 'offense',
            DEFENSE: 'defense',
            ATHLETICISM: 'athleticism',
            STAMINA: 'stamina',
          } as const
        )[focus];

  const growth = (0.12 + rng.nextFloat('training-growth') * 0.18) * intensity;
  const attributes: AttributeState = player.attributes;
  attributes[selected] = clamp(attributes[selected] + growth);
  player.condition.fatigue = clamp(player.condition.fatigue + 2.5 * intensity);
  player.condition.focus = clamp(player.condition.focus - 0.3 * intensity);
}

function applyOperationWeek(
  state: GameState,
  week: Week,
  rng: DeterministicRng,
  events: DomainEvent[],
): void {
  const activePlayers = state.players.filter((player) => player.activeStatus === 'ACTIVE');
  const weeklyCost = 200 + activePlayers.length * state.trainingPlan.intensity * 10;
  appendBudgetEntry(state, -weeklyCost, 'WEEKLY_OPERATIONS', week);

  for (const player of activePlayers) {
    growPlayer(player, state.trainingPlan.focus, state.trainingPlan.intensity, rng);
  }

  appendEvent(state, week, events, 'TRAINING_APPLIED', {
    playerCount: activePlayers.length,
    intensity: state.trainingPlan.intensity,
    focus: state.trainingPlan.focus,
    weeklyCost,
  });

  const nextOperationWeek = state.metrics.resolvedOperationWeeks + 1;
  if (nextOperationWeek % 4 === 0) {
    const result = simulateModelAMatch(state, rng);
    state.matchResults.push(result);
    state.metrics.matches += 1;
    if (result.score.home > result.score.away) state.team.history.wins += 1;
    else state.team.history.losses += 1;
    for (const playerId of result.playerStats.map((stat) => stat.playerId)) {
      const player = state.players.find((candidate) => candidate.id === playerId);
      if (player) player.condition.fatigue = clamp(player.condition.fatigue + 3);
    }
    appendEvent(state, week, events, 'MATCH_SIMULATED', {
      matchId: result.id,
      homeScore: result.score.home,
      awayScore: result.score.away,
    });
  }

  state.metrics.resolvedOperationWeeks += 1;
}

function applyExamWeek(state: GameState, week: Week, events: DomainEvent[]): void {
  appendBudgetEntry(state, -100, 'EXAM_MAINTENANCE', week);
  for (const player of state.players) {
    if (player.activeStatus !== 'ACTIVE') continue;
    player.condition.fatigue = clamp(player.condition.fatigue - 5);
    player.condition.focus = clamp(player.condition.focus + 1.5);
  }
  state.metrics.resolvedExamWeeks += 1;
  appendEvent(state, week, events, 'EXAM_WEEK_RESOLVED', {});
}

function archiveGraduatedPlayer(state: GameState, player: Player, week: Week): void {
  const playerMatchStats = state.matchResults
    .flatMap((result) => result.playerStats)
    .filter((stat) => stat.playerId === player.id);
  const matches = playerMatchStats.length;
  const points = playerMatchStats.reduce((sum, stat) => sum + stat.points, 0);

  player.activeStatus = 'GRADUATED';
  player.careerLog.push({
    at: weekDate(week),
    type: 'GRADUATED',
    detail: 'Graduated during the P01 lifecycle settlement.',
  });
  state.careerArchives.push({
    id: `archive-${player.id}`,
    playerSnapshot: structuredClone(player),
    yearsPlayed: Math.max(1, week.schoolYearIndex - player.lifecycle.joinedAt.schoolYearIndex + 1),
    records: {
      matches,
      points,
    },
    keyEvents: [],
    exitReason: 'GRADUATED',
    destination: 'UNDECIDED',
  });
}

function settleSchoolYear(state: GameState, week: Week, events: DomainEvent[]): void {
  for (const player of state.players) {
    if (player.activeStatus !== 'ACTIVE') continue;
    if (player.grade === 3) {
      archiveGraduatedPlayer(state, player, week);
      state.team.activePlayerIds = state.team.activePlayerIds.filter((id) => id !== player.id);
      appendEvent(state, week, events, 'PLAYER_GRADUATED', { playerId: player.id });
    } else {
      player.grade = player.grade === 1 ? 2 : 3;
      player.careerLog.push({
        at: weekDate(week),
        type: 'GRADE_ADVANCED',
        detail: `Advanced to grade ${player.grade}.`,
      });
      appendEvent(state, week, events, 'PLAYER_GRADE_ADVANCED', {
        playerId: player.id,
        grade: player.grade,
      });
    }
  }

  state.metrics.completedSchoolYears += 1;
  state.team.history.schoolYearsCompleted += 1;
  appendBudgetEntry(state, P01_ANNUAL_GRANT, 'ANNUAL_GRANT', week);
  appendEvent(state, week, events, 'SCHOOL_YEAR_COMPLETED', {
    schoolYearIndex: week.schoolYearIndex,
    activePlayers: state.team.activePlayerIds.length,
    archivedPlayers: state.careerArchives.length,
  });
}

function createWeek(schoolYearIndex: number, term: 1 | 2, weekOfTerm: number): Week {
  const absoluteWeek =
    (schoolYearIndex - 1) * 2 * WEEKS_PER_TERM + (term - 1) * WEEKS_PER_TERM + weekOfTerm;
  return {
    id: `week-${schoolYearIndex}-${term}-${weekOfTerm}`,
    absoluteWeek,
    schoolYearIndex,
    term,
    weekOfTerm,
    phase: weekOfTerm <= OPERATION_WEEKS_PER_TERM ? 'TERM_OPERATION' : 'EXAM_WRAP',
    availableActions: weekOfTerm <= OPERATION_WEEKS_PER_TERM ? 1 : 0,
    scheduledEventIds: [],
    resolved: false,
  };
}

function advanceTimeline(state: GameState, week: Week, events: DomainEvent[]): void {
  if (week.weekOfTerm < WEEKS_PER_TERM) {
    state.currentWeek = createWeek(week.schoolYearIndex, week.term, week.weekOfTerm + 1);
    return;
  }
  if (week.term === 1) {
    state.currentWeek = createWeek(week.schoolYearIndex, 2, 1);
    return;
  }

  settleSchoolYear(state, week, events);
  if (week.schoolYearIndex === SCHOOL_YEARS_PER_RUN) {
    state.status = 'THREE_YEAR_COMPLETE';
    state.currentWeek = null;
    appendEvent(state, week, events, 'THREE_YEAR_RUN_COMPLETED', {
      calendarWeeks: state.metrics.resolvedCalendarWeeks,
      operationWeeks: state.metrics.resolvedOperationWeeks,
    });
    return;
  }

  const nextSchoolYear = week.schoolYearIndex + 1;
  state.season = {
    id: `season-${nextSchoolYear}`,
    schoolYearIndex: nextSchoolYear,
    competitionIds: [],
    objectives: ['P01: continue the deterministic school-year skeleton'],
  };
  state.currentWeek = createWeek(nextSchoolYear, 1, 1);
}

export function resolveCurrentWeek(
  originalState: GameState,
  rng: DeterministicRng,
): DomainTransition {
  const week = originalState.currentWeek;
  if (originalState.status === 'THREE_YEAR_COMPLETE' || week === null) {
    throw new DomainRuleError('TIME_ALREADY_COMPLETE', 'The three-year run is already complete.');
  }

  const state = originalState;
  const events: DomainEvent[] = [];

  if (week.phase === 'TERM_OPERATION') applyOperationWeek(state, week, rng, events);
  else applyExamWeek(state, week, events);

  state.metrics.resolvedCalendarWeeks += 1;
  appendEvent(state, week, events, 'WEEK_RESOLVED', {
    absoluteWeek: week.absoluteWeek,
    phase: week.phase,
  });
  advanceTimeline(state, week, events);

  return {
    state,
    events,
  };
}
