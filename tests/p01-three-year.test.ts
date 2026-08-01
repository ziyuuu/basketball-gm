import { GameSession, createAdvanceWeekCommand } from '@sunny-court/application';
import {
  CALENDAR_WEEKS_PER_RUN,
  DomainEventSchema,
  GameStateSchema,
  OPERATION_WEEKS_PER_RUN,
  P01_ANNUAL_GRANT,
  P01_INITIAL_GRANT,
  TERMS_PER_SCHOOL_YEAR,
  WEEKS_PER_TERM,
  createInitialGame,
  parseDomainEventId,
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
  it('accepts and restores every annual-grant boundary with a continuous balance chain', () => {
    const initial = createInitialGame({
      rootSeed: 'grant-boundaries',
      schoolName: '测试高中',
      managerName: '测试经理',
    });
    const session = new GameSession({
      state: initial.state,
      rng: initial.rng,
      auditClock: () => '2026-07-31T00:00:00.000Z',
    });
    const boundaries = [0, 39, 40, 41, 79, 80, 119, 120];
    let resolvedWeeks = 0;

    for (const boundary of boundaries) {
      advance(session, boundary - resolvedWeeks, `boundary-${boundary}`);
      resolvedWeeks = boundary;
      const state = session.state();
      const settledSchoolYears = Math.floor(boundary / 40);
      const annualGrants = state.budget.ledger.filter((entry) => entry.reason === 'ANNUAL_GRANT');

      expect(GameStateSchema.safeParse(state).success).toBe(true);
      expect(state.metrics.completedSchoolYears).toBe(settledSchoolYears);
      expect(state.team.history.schoolYearsCompleted).toBe(settledSchoolYears);
      expect(state.budget.annualGrant).toBe(P01_ANNUAL_GRANT);
      expect(
        annualGrants.map((entry) => ({
          schoolYearIndex: entry.schoolYearIndex,
          absoluteWeek: entry.absoluteWeek,
          amount: entry.amount,
        })),
      ).toEqual(
        Array.from({ length: settledSchoolYears }, (_, index) => ({
          schoolYearIndex: index + 1,
          absoluteWeek: (index + 1) * 40,
          amount: P01_ANNUAL_GRANT,
        })),
      );
      expect(state.budget.ledger[0]).toMatchObject({
        sequence: 0,
        schoolYearIndex: 1,
        absoluteWeek: 0,
        amount: P01_INITIAL_GRANT,
        balanceAfter: P01_INITIAL_GRANT,
        reason: 'INITIAL_GRANT',
      });
      state.budget.ledger.slice(1).forEach((entry, index) => {
        const previous = state.budget.ledger[index];
        expect(entry.balanceAfter).toBe(previous!.balanceAfter + entry.amount);
      });
      expect(state.budget.ledger.at(-1)?.balanceAfter).toBe(state.budget.balance);

      const envelope = createSaveEnvelope({
        session,
        saveId: `boundary-${boundary}`,
        createdAt: '2026-07-31T00:00:00.000Z',
        committedAt: '2026-07-31T00:00:00.000Z',
      });
      const restored = restoreSession(envelope, () => '2026-07-31T00:00:00.000Z');
      expect(stableHash(restored.state())).toBe(stableHash(state));
      expect(restored.rngSnapshot()).toEqual(session.rngSnapshot());
    }
  });

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
    const state = result.session.state();
    expect(GameStateSchema.safeParse(state).success).toBe(true);
    expect(
      state.budget.ledger
        .filter((entry) => entry.reason === 'ANNUAL_GRANT')
        .map((entry) => entry.absoluteWeek),
    ).toEqual([40, 80, 120]);
    expect(
      state.budget.ledger.every(
        (entry) => entry.absoluteWeek <= state.metrics.resolvedCalendarWeeks,
      ),
    ).toBe(true);
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

  it.each([
    {
      seed: 'p01-evidence-001',
      stateHash: 'fnv64:d2e562049e32562a',
      replayHash: 'fnv64:321321f346df2bd9',
    },
    {
      seed: 'r2-clean-gate',
      stateHash: 'fnv64:8cbf99e1aa4068d4',
      replayHash: 'fnv64:62713a07383cbf50',
    },
  ])('preserves the frozen P01 golden hashes for $seed', async (fixture) => {
    const result = await runThreeYearSimulation({
      seed: fixture.seed,
      auditClock: () => '2026-07-31T00:00:00.000Z',
    });

    expect(result.summary.stateHash).toBe(fixture.stateHash);
    expect(result.summary.replayHash).toBe(fixture.replayHash);
  });

  it('emits globally unique event IDs aligned with revision, actual week, sequence, and type', () => {
    const initial = createInitialGame({
      rootSeed: 'event-audit-integrity',
      schoolName: '测试高中',
      managerName: '测试经理',
    });
    const session = new GameSession({
      state: initial.state,
      rng: initial.rng,
      auditClock: () => '2026-07-31T00:00:00.000Z',
    });
    const eventIds: string[] = [];

    while (session.status === 'ACTIVE') {
      const committedRevision = session.revision + 1;
      const result = session.execute(
        createAdvanceWeekCommand(session, `audit-week-${committedRevision}`),
      );
      if (!result.ok) throw new Error(`${result.code}: ${result.message}`);

      result.events.forEach((event, eventIndex) => {
        const absoluteWeek =
          (event.at.schoolYearIndex - 1) * TERMS_PER_SCHOOL_YEAR * WEEKS_PER_TERM +
          (event.at.term - 1) * WEEKS_PER_TERM +
          event.at.weekOfTerm;
        expect(DomainEventSchema.safeParse(event).success).toBe(true);
        expect(parseDomainEventId(event.id)).toEqual({
          committedRevision,
          absoluteWeek,
          sequence: eventIndex + 1,
          type: event.type,
        });
        eventIds.push(event.id);
      });
    }

    expect(eventIds.length).toBeGreaterThan(0);
    expect(new Set(eventIds).size).toBe(eventIds.length);
  });

  it('rejects persisted budget entries dated after the resolved calendar', () => {
    const initial = createInitialGame({
      rootSeed: 'future-budget-entry',
      schoolName: '测试高中',
      managerName: '测试经理',
    });
    const session = new GameSession({
      state: initial.state,
      rng: initial.rng,
      auditClock: () => '2026-07-31T00:00:00.000Z',
    });
    advance(session, 1, 'week');

    const corrupted = session.state();
    const latestEntry = corrupted.budget.ledger.at(-1);
    if (!latestEntry) throw new Error('Expected a weekly budget entry.');
    latestEntry.absoluteWeek = 2;

    expect(GameStateSchema.safeParse(corrupted).success).toBe(false);
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
