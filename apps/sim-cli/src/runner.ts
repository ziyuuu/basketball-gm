import {
  EphemeralBatchSession,
  GameSession,
  createAdvanceWeekCommand,
} from '@sunny-court/application';
import {
  CALENDAR_WEEKS_PER_RUN,
  OPERATION_WEEKS_PER_RUN,
  createInitialGame,
  stableHash,
  type GameState,
} from '@sunny-court/domain';
import { createSaveEnvelope, type SaveRepository } from '@sunny-court/persistence';

export interface ThreeYearRunOptions {
  seed: string;
  schoolName?: string;
  managerName?: string;
  saveRepository?: SaveRepository;
  saveSlot?: string;
  auditClock?: () => string;
}

export interface ThreeYearRunSummary {
  seed: string;
  status: GameState['status'];
  calendarWeeks: number;
  operationWeeks: number;
  examWeeks: number;
  schoolYearsCompleted: number;
  activePlayers: number;
  archivedPlayers: number;
  matches: number;
  wins: number;
  losses: number;
  budgetBalance: number;
  stateHash: string;
  replayHash: string;
}

export interface ThreeYearRunResult {
  session: GameSession;
  summary: ThreeYearRunSummary;
}

function summarize(
  seed: string,
  state: GameState,
  rng: ReturnType<GameSession['rngSnapshot']>,
): ThreeYearRunSummary {
  return {
    seed,
    status: state.status,
    calendarWeeks: state.metrics.resolvedCalendarWeeks,
    operationWeeks: state.metrics.resolvedOperationWeeks,
    examWeeks: state.metrics.resolvedExamWeeks,
    schoolYearsCompleted: state.metrics.completedSchoolYears,
    activePlayers: state.team.activePlayerIds.length,
    archivedPlayers: state.careerArchives.length,
    matches: state.metrics.matches,
    wins: state.team.history.wins,
    losses: state.team.history.losses,
    budgetBalance: state.budget.balance,
    stateHash: stableHash(state),
    replayHash: stableHash({
      state,
      rng,
    }),
  };
}

export async function runThreeYearSimulation(
  options: ThreeYearRunOptions,
): Promise<ThreeYearRunResult> {
  const initial = createInitialGame({
    rootSeed: options.seed,
    schoolName: options.schoolName ?? 'P01测试高中',
    managerName: options.managerName ?? 'P01测试经理',
  });
  const session = new GameSession({
    state: initial.state,
    rng: initial.rng,
    ...(options.auditClock ? { auditClock: options.auditClock } : {}),
  });
  let previousSaveId: string | undefined;

  while (session.status === 'ACTIVE') {
    const result = session.execute(
      createAdvanceWeekCommand(session, `${options.seed}:week:${session.revision + 1}`),
    );
    if (!result.ok) {
      throw new Error(`${result.code}: ${result.message}`);
    }

    const settlement = result.events.find((event) => event.type === 'SCHOOL_YEAR_COMPLETED');
    if (settlement && options.saveRepository) {
      const year = session.state().metrics.completedSchoolYears;
      const saveId = `${options.seed}:year:${year}`;
      const envelope = createSaveEnvelope({
        session,
        saveId,
        ...(previousSaveId ? { parentSaveId: previousSaveId } : {}),
        contentPackHashes: initial.contentPackHashes,
      });
      await options.saveRepository.saveAtomic(options.saveSlot ?? 'autosave', envelope);
      previousSaveId = saveId;
    }
  }

  const state = session.state();
  if (
    state.metrics.resolvedCalendarWeeks !== CALENDAR_WEEKS_PER_RUN ||
    state.metrics.resolvedOperationWeeks !== OPERATION_WEEKS_PER_RUN
  ) {
    throw new Error(
      `Three-year calendar mismatch: ${state.metrics.resolvedCalendarWeeks}/${state.metrics.resolvedOperationWeeks}.`,
    );
  }

  const summary = summarize(options.seed, state, session.rngSnapshot());

  return {
    session,
    summary,
  };
}

async function runEphemeralThreeYearSimulation(seed: string): Promise<ThreeYearRunSummary> {
  const initial = createInitialGame({
    rootSeed: seed,
    schoolName: 'P01测试高中',
    managerName: 'P01测试经理',
  });
  const session = new EphemeralBatchSession({
    state: initial.state,
    rng: initial.rng,
  });

  while (session.status === 'ACTIVE') {
    const events = session.executeAdvanceWeek(
      createAdvanceWeekCommand(session, `${seed}:batch:${session.revision + 1}`),
    );
    if (events.some((event) => event.type === 'SCHOOL_YEAR_COMPLETED')) {
      session.validateCheckpoint();
    }
  }

  const state = session.state();
  return summarize(seed, state, session.rngSnapshot());
}

export interface BatchRunOptions {
  runs: number;
  seedPrefix: string;
  replaySamples?: number;
}

export interface BatchRunSummary {
  requestedRuns: number;
  completedRuns: number;
  failedRuns: number;
  replaySamples: number;
  replayMismatches: number;
  calendarWeekViolations: number;
  operationWeekViolations: number;
  illegalTerminalStates: number;
  averageMatches: number;
  averageBudgetBalance: number;
  elapsedMilliseconds: number;
  failures: Array<{
    seed: string;
    message: string;
  }>;
}

export async function runBatch(options: BatchRunOptions): Promise<BatchRunSummary> {
  if (!Number.isInteger(options.runs) || options.runs < 1) {
    throw new Error(`runs must be a positive integer; received ${options.runs}.`);
  }
  const replaySamples = Math.min(options.replaySamples ?? 10, options.runs);
  const startedAt = performance.now();
  let completedRuns = 0;
  let replayMismatches = 0;
  let calendarWeekViolations = 0;
  let operationWeekViolations = 0;
  let illegalTerminalStates = 0;
  let totalMatches = 0;
  let totalBudgetBalance = 0;
  const failures: BatchRunSummary['failures'] = [];

  for (let index = 0; index < options.runs; index += 1) {
    const seed = `${options.seedPrefix}-${String(index + 1).padStart(4, '0')}`;
    try {
      const first = await runEphemeralThreeYearSimulation(seed);
      completedRuns += 1;
      totalMatches += first.matches;
      totalBudgetBalance += first.budgetBalance;
      if (first.calendarWeeks !== CALENDAR_WEEKS_PER_RUN) calendarWeekViolations += 1;
      if (first.operationWeeks !== OPERATION_WEEKS_PER_RUN) operationWeekViolations += 1;
      if (first.status !== 'THREE_YEAR_COMPLETE') illegalTerminalStates += 1;

      if (index < replaySamples) {
        const replay = await runEphemeralThreeYearSimulation(seed);
        if (first.replayHash !== replay.replayHash) replayMismatches += 1;
      }
    } catch (error) {
      failures.push({
        seed,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    requestedRuns: options.runs,
    completedRuns,
    failedRuns: failures.length,
    replaySamples,
    replayMismatches,
    calendarWeekViolations,
    operationWeekViolations,
    illegalTerminalStates,
    averageMatches: completedRuns === 0 ? 0 : totalMatches / completedRuns,
    averageBudgetBalance: completedRuns === 0 ? 0 : totalBudgetBalance / completedRuns,
    elapsedMilliseconds: Number((performance.now() - startedAt).toFixed(2)),
    failures,
  };
}
