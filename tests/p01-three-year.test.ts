import { GameSession, createAdvanceWeekCommand } from '@sunny-court/application';
import {
  CALENDAR_WEEKS_PER_RUN,
  GameStateSchema,
  OPERATION_WEEKS_PER_RUN,
  createInitialGame,
  stableHash,
} from '@sunny-court/domain';
import {
  InMemorySaveRepository,
  createSaveEnvelope,
  restoreSession,
} from '@sunny-court/persistence';
import { describe, expect, it } from 'vitest';

import { runBatch, runThreeYearSimulation } from '../apps/sim-cli/src/runner.js';

function advance(session: GameSession, count: number, prefix: string): void {
  for (let index = 0; index < count; index += 1) {
    const result = session.execute(
      createAdvanceWeekCommand(session, `${prefix}-${String(index + 1).padStart(3, '0')}`),
    );
    if (!result.ok) throw new Error(`${result.code}: ${result.message}`);
  }
}

describe('P01 three-year headless Gate', () => {
  it('resolves exactly 120 calendar weeks, 96 operation weeks, and three school years', async () => {
    const result = await runThreeYearSimulation({
      seed: 'p01-three-year',
      auditClock: () => '2026-07-31T00:00:00.000Z',
    });

    expect(result.summary).toMatchObject({
      status: 'THREE_YEAR_COMPLETE',
      calendarWeeks: CALENDAR_WEEKS_PER_RUN,
      operationWeeks: OPERATION_WEEKS_PER_RUN,
      examWeeks: 24,
      schoolYearsCompleted: 3,
      activePlayers: 0,
      archivedPlayers: 22,
      matches: 24,
    });
    expect(result.summary.wins + result.summary.losses).toBe(result.summary.matches);
    expect(GameStateSchema.safeParse(result.session.state()).success).toBe(true);
  });

  it('advances grades and graduates the initial grade-two fixture at year two', async () => {
    const initial = createInitialGame({
      rootSeed: 'lifecycle',
      schoolName: '测试高中',
      managerName: '测试经理',
    });
    const session = new GameSession({
      state: initial.state,
      rng: initial.rng,
      auditClock: () => '2026-07-31T00:00:00.000Z',
    });

    advance(session, 40, 'year-one');
    expect(session.state().players.filter((player) => player.grade === 3)).toHaveLength(4);
    expect(session.state().careerArchives).toHaveLength(0);

    advance(session, 40, 'year-two');
    expect(session.state().careerArchives).toHaveLength(4);
    expect(session.state().team.activePlayerIds).toHaveLength(18);
    expect(
      session.state().careerArchives.every((archive) => archive.exitReason === 'GRADUATED'),
    ).toBe(true);
  });

  it('continues from a year-end save to the same terminal state and RNG hash', async () => {
    const seed = 'save-resume';
    const uninterrupted = await runThreeYearSimulation({
      seed,
      auditClock: () => '2026-07-31T00:00:00.000Z',
    });

    const initial = createInitialGame({
      rootSeed: seed,
      schoolName: 'P01测试高中',
      managerName: 'P01测试经理',
    });
    const checkpointSession = new GameSession({
      state: initial.state,
      rng: initial.rng,
      auditClock: () => '2026-07-31T00:00:00.000Z',
    });
    advance(checkpointSession, 80, 'checkpoint');
    const repository = new InMemorySaveRepository();
    await repository.saveAtomic(
      'year-two',
      createSaveEnvelope({
        session: checkpointSession,
        saveId: 'year-two',
        createdAt: '2026-07-31T00:00:00.000Z',
        committedAt: '2026-07-31T00:00:00.000Z',
      }),
    );
    const loaded = await repository.loadLatest('year-two');
    expect(loaded).toBeDefined();
    const restored = restoreSession(loaded, () => '2026-07-31T00:00:00.000Z');
    advance(restored, 40, 'resumed');

    expect(stableHash(restored.state())).toBe(stableHash(uninterrupted.session.state()));
    expect(restored.rngSnapshot()).toEqual(uninterrupted.session.rngSnapshot());
  });

  it('completes the 1,000-run phase Gate without deadlock or illegal terminal states', async () => {
    const summary = await runBatch({
      runs: 1000,
      seedPrefix: 'p01-test-gate',
      replaySamples: 20,
    });

    expect(summary).toMatchObject({
      requestedRuns: 1000,
      completedRuns: 1000,
      failedRuns: 0,
      replaySamples: 20,
      replayMismatches: 0,
      calendarWeekViolations: 0,
      operationWeekViolations: 0,
      illegalTerminalStates: 0,
    });
    expect(summary.failures).toEqual([]);
  }, 120_000);
});
