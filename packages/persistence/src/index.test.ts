import { GameSession, createAdvanceWeekCommand } from '@sunny-court/application';
import { GameStateSchema, createInitialGame, stableHash } from '@sunny-court/domain';
import { describe, expect, it } from 'vitest';

import {
  InMemorySaveRepository,
  SaveEnvelopeSchema,
  SaveIntegrityError,
  calculateSaveChecksum,
  createSaveEnvelope,
  restoreSession,
  type SaveEnvelope,
} from './index.js';

function session(seed: string): GameSession {
  const initial = createInitialGame({
    rootSeed: seed,
    schoolName: '测试高中',
    managerName: '测试经理',
  });
  return new GameSession({
    state: initial.state,
    rng: initial.rng,
    auditClock: () => '2026-07-31T00:00:00.000Z',
  });
}

function advance(original: GameSession, count: number, prefix: string): void {
  for (let index = 0; index < count; index += 1) {
    const result = original.execute(
      createAdvanceWeekCommand(original, `${prefix}-${String(index + 1).padStart(3, '0')}`),
    );
    if (!result.ok) throw new Error(`${result.code}: ${result.message}`);
  }
}

function annualGrant(envelope: SaveEnvelope, schoolYearIndex: number) {
  const entry = envelope.snapshot.budget.ledger.find(
    (candidate) =>
      candidate.reason === 'ANNUAL_GRANT' && candidate.schoolYearIndex === schoolYearIndex,
  );
  if (!entry) throw new Error(`Expected annual grant for school year ${schoolYearIndex}.`);
  return entry;
}

function resign(envelope: SaveEnvelope): void {
  envelope.snapshotHash = stableHash(envelope.snapshot);
  envelope.checksum = calculateSaveChecksum(envelope);
}

function reconcileLedgerAndResign(envelope: SaveEnvelope): void {
  let balance = 0;
  envelope.snapshot.budget.ledger.forEach((entry, index) => {
    entry.sequence = index;
    balance += entry.amount;
    entry.balanceAfter = balance;
  });
  envelope.snapshot.budget.balance = balance;
  resign(envelope);
}

function rejectionResult(
  name: string,
  envelope: SaveEnvelope,
  expectedIssueMessage: string,
  expectedIssuePathPrefix: string,
) {
  const gameStateResult = GameStateSchema.safeParse(envelope.snapshot);
  const targetIssueFound =
    !gameStateResult.success &&
    gameStateResult.error.issues.some(
      (issue) =>
        issue.message.includes(expectedIssueMessage) &&
        issue.path.join('.').startsWith(expectedIssuePathPrefix),
    );
  let restoreRejected = false;
  try {
    restoreSession(envelope);
  } catch {
    restoreRejected = true;
  }
  return {
    name,
    checksumRecomputed: envelope.checksum === calculateSaveChecksum(envelope),
    snapshotHashRecomputed: envelope.snapshotHash === stableHash(envelope.snapshot),
    gameStateRejected: !gameStateResult.success,
    targetIssueFound,
    envelopeRejected: !SaveEnvelopeSchema.safeParse(envelope).success,
    restoreRejected,
  };
}

describe('save envelope and memory repository', () => {
  it('round-trips state, RNG, and the accepted command tail', () => {
    const original = session('round-trip');
    const command = original.execute(createAdvanceWeekCommand(original, 'week-1'));
    expect(command.ok).toBe(true);

    const envelope = createSaveEnvelope({
      session: original,
      saveId: 'save-1',
      createdAt: '2026-07-31T00:00:00.000Z',
      committedAt: '2026-07-31T00:00:00.000Z',
    });
    const restored = restoreSession(envelope, () => '2026-07-31T00:00:00.000Z');

    expect(stableHash(restored.state())).toBe(stableHash(original.state()));
    expect(restored.rngSnapshot()).toEqual(original.rngSnapshot());
    expect(restored.recentCommandLog()).toEqual(original.recentCommandLog());
  });

  it('rotates the previous valid save into a recoverable backup', async () => {
    const repository = new InMemorySaveRepository();
    const original = session('backup');
    const first = createSaveEnvelope({
      session: original,
      saveId: 'save-1',
      createdAt: '2026-07-31T00:00:00.000Z',
      committedAt: '2026-07-31T00:00:00.000Z',
    });
    await repository.saveAtomic('autosave', first);

    expect(original.execute(createAdvanceWeekCommand(original, 'week-1')).ok).toBe(true);
    const second = createSaveEnvelope({
      session: original,
      saveId: 'save-2',
      parentSaveId: 'save-1',
      createdAt: '2026-07-31T00:01:00.000Z',
      committedAt: '2026-07-31T00:01:00.000Z',
    });
    await repository.saveAtomic('autosave', second);

    expect((await repository.loadLatest('autosave'))?.saveId).toBe('save-2');
    expect((await repository.loadBackup('autosave'))?.saveId).toBe('save-1');
  });

  it('rejects a corrupt replacement without overwriting the latest valid save', async () => {
    const repository = new InMemorySaveRepository();
    const original = session('corrupt-save');
    const valid = createSaveEnvelope({
      session: original,
      saveId: 'valid',
      createdAt: '2026-07-31T00:00:00.000Z',
      committedAt: '2026-07-31T00:00:00.000Z',
    });
    await repository.saveAtomic('autosave', valid);
    const corrupt = {
      ...valid,
      saveId: 'corrupt',
      checksum: 'invalid-checksum',
    } as SaveEnvelope;

    await expect(repository.saveAtomic('autosave', corrupt)).rejects.toBeInstanceOf(
      SaveIntegrityError,
    );
    expect((await repository.loadLatest('autosave'))?.saveId).toBe('valid');
    expect(await repository.loadBackup('autosave')).toBeUndefined();
  });

  it('preserves distinguishable year-end event audit IDs across save and restore', () => {
    const original = session('audit-id-round-trip');
    advance(original, 80, 'week');
    const envelope = createSaveEnvelope({
      session: original,
      saveId: 'year-two',
      createdAt: '2026-07-31T00:00:00.000Z',
      committedAt: '2026-07-31T00:00:00.000Z',
    });
    const restored = restoreSession(envelope, () => '2026-07-31T00:00:00.000Z');

    expect(restored.recentCommandLog()).toEqual(original.recentCommandLog());
    const restoredEventIds = restored.recentCommandLog().flatMap((record) => record.eventIds);
    expect(new Set(restoredEventIds).size).toBe(restoredEventIds.length);

    const yearEndAudit = restored
      .recentCommandLog()
      .find((record) => record.committedRevision === 80);
    expect(yearEndAudit).toBeDefined();
    const playerLifecycleEventIds = yearEndAudit!.eventIds.filter(
      (eventId) =>
        eventId.endsWith('-PLAYER_GRADE_ADVANCED') || eventId.endsWith('-PLAYER_GRADUATED'),
    );
    expect(playerLifecycleEventIds).toHaveLength(22);
    expect(new Set(playerLifecycleEventIds).size).toBe(22);
    expect(playerLifecycleEventIds.every((eventId) => eventId.includes('-w80-'))).toBe(true);
  });

  it('rejects re-signed grant and balance-chain attacks after checksum recomputation', () => {
    const original = session('grant-ledger-attacks');
    advance(original, 120, 'week');
    const valid = createSaveEnvelope({
      session: original,
      saveId: 'terminal',
      createdAt: '2026-07-31T00:00:00.000Z',
      committedAt: '2026-07-31T00:00:00.000Z',
    });
    const attacks: Array<{
      name: string;
      mutate: (envelope: SaveEnvelope) => void;
      reconcile?: boolean;
      expectedIssueMessage: string;
      expectedIssuePathPrefix: string;
    }> = [
      {
        name: 'delete a settled annual grant',
        mutate: (envelope) => {
          const index = envelope.snapshot.budget.ledger.findIndex(
            (entry) => entry.reason === 'ANNUAL_GRANT' && entry.schoolYearIndex === 2,
          );
          if (index < 0) throw new Error('Expected the school-year-two grant.');
          envelope.snapshot.budget.ledger.splice(index, 1);
        },
        reconcile: true,
        expectedIssueMessage: 'School year 2 must contain 1 annual grant ledger entry',
        expectedIssuePathPrefix: 'budget.ledger',
      },
      {
        name: 'duplicate a settled annual grant',
        mutate: (envelope) => {
          const grant = annualGrant(envelope, 2);
          const index = envelope.snapshot.budget.ledger.indexOf(grant);
          envelope.snapshot.budget.ledger.splice(index + 1, 0, structuredClone(grant));
        },
        reconcile: true,
        expectedIssueMessage: 'School year 2 must contain 1 annual grant ledger entry',
        expectedIssuePathPrefix: 'budget.ledger',
      },
      {
        name: 'move a grant to the wrong school year',
        mutate: (envelope) => {
          annualGrant(envelope, 1).schoolYearIndex = 2;
        },
        reconcile: true,
        expectedIssueMessage: 'belongs to school year 1, not 2',
        expectedIssuePathPrefix: 'budget.ledger',
      },
      {
        name: 'move the school-year-one grant to week 41',
        mutate: (envelope) => {
          annualGrant(envelope, 1).absoluteWeek = 41;
        },
        reconcile: true,
        expectedIssueMessage: 'Annual grant for school year 1 must be recorded at week 40',
        expectedIssuePathPrefix: 'budget.ledger',
      },
      {
        name: 'move the school-year-two grant to week 81',
        mutate: (envelope) => {
          annualGrant(envelope, 2).absoluteWeek = 81;
        },
        reconcile: true,
        expectedIssueMessage: 'Annual grant for school year 2 must be recorded at week 80',
        expectedIssuePathPrefix: 'budget.ledger',
      },
      {
        name: 'move the school-year-three grant to week 121',
        mutate: (envelope) => {
          annualGrant(envelope, 3).absoluteWeek = 121;
        },
        reconcile: true,
        expectedIssueMessage: 'expected number to be <=120',
        expectedIssuePathPrefix: 'budget.ledger',
      },
      {
        name: 'change one grant amount',
        mutate: (envelope) => {
          annualGrant(envelope, 1).amount += 1;
        },
        reconcile: true,
        expectedIssueMessage: 'Annual grant for school year 1 must equal 50000',
        expectedIssuePathPrefix: 'budget.ledger',
      },
      {
        name: 'change every grant amount and the stored annualGrant field together',
        mutate: (envelope) => {
          envelope.snapshot.budget.annualGrant += 1;
          envelope.snapshot.budget.ledger
            .filter((entry) => entry.reason === 'ANNUAL_GRANT')
            .forEach((entry) => {
              entry.amount += 1;
            });
        },
        reconcile: true,
        expectedIssueMessage: 'P01 annual grant must equal the rules constant 50000',
        expectedIssuePathPrefix: 'budget.annualGrant',
      },
      {
        name: 'change the completed-school-year metric',
        mutate: (envelope) => {
          envelope.snapshot.metrics.completedSchoolYears = 2;
        },
        expectedIssueMessage: 'Completed-school-year metric must equal 3',
        expectedIssuePathPrefix: 'metrics.completedSchoolYears',
      },
      {
        name: 'change the team completed-school-year history',
        mutate: (envelope) => {
          envelope.snapshot.team.history.schoolYearsCompleted = 2;
        },
        expectedIssueMessage: 'Team school-year history must equal 3',
        expectedIssuePathPrefix: 'team.history.schoolYearsCompleted',
      },
      {
        name: 'change an internal balanceAfter while preserving the terminal balance',
        mutate: (envelope) => {
          const entry = envelope.snapshot.budget.ledger[2];
          if (!entry) throw new Error('Expected at least three ledger entries.');
          entry.balanceAfter += 1;
        },
        expectedIssueMessage: 'Budget ledger balance at position 2',
        expectedIssuePathPrefix: 'budget.ledger.2.balanceAfter',
      },
      {
        name: 'change the terminal budget balance while preserving the ledger',
        mutate: (envelope) => {
          envelope.snapshot.budget.balance += 1;
        },
        expectedIssueMessage: 'Budget ledger does not reconcile with current balance',
        expectedIssuePathPrefix: 'budget',
      },
      {
        name: 'change the initial grant and rebuild the full balance chain',
        mutate: (envelope) => {
          const initialGrant = envelope.snapshot.budget.ledger[0];
          if (!initialGrant || initialGrant.reason !== 'INITIAL_GRANT') {
            throw new Error('Expected the initial grant.');
          }
          initialGrant.amount += 1;
        },
        reconcile: true,
        expectedIssueMessage: 'initial grant amount and resulting balance must both equal 100000',
        expectedIssuePathPrefix: 'budget.ledger.0',
      },
      {
        name: 'change only the initial grant balanceAfter',
        mutate: (envelope) => {
          const initialGrant = envelope.snapshot.budget.ledger[0];
          if (!initialGrant || initialGrant.reason !== 'INITIAL_GRANT') {
            throw new Error('Expected the initial grant.');
          }
          initialGrant.balanceAfter += 1;
        },
        expectedIssueMessage: 'initial grant amount and resulting balance must both equal 100000',
        expectedIssuePathPrefix: 'budget.ledger.0',
      },
      {
        name: 'duplicate the initial grant and rebuild the full balance chain',
        mutate: (envelope) => {
          const initialGrant = envelope.snapshot.budget.ledger[0];
          if (!initialGrant || initialGrant.reason !== 'INITIAL_GRANT') {
            throw new Error('Expected the initial grant.');
          }
          envelope.snapshot.budget.ledger.splice(1, 0, structuredClone(initialGrant));
        },
        reconcile: true,
        expectedIssueMessage: 'exactly one initial grant as its first entry',
        expectedIssuePathPrefix: 'budget.ledger',
      },
      {
        name: 'remove the initial-grant identity while preserving a nonnegative balance chain',
        mutate: (envelope) => {
          const initialGrant = envelope.snapshot.budget.ledger[0];
          if (!initialGrant || initialGrant.reason !== 'INITIAL_GRANT') {
            throw new Error('Expected the initial grant.');
          }
          initialGrant.reason = 'WEEKLY_OPERATIONS';
          initialGrant.absoluteWeek = 1;
        },
        reconcile: true,
        expectedIssueMessage: 'exactly one initial grant as its first entry',
        expectedIssuePathPrefix: 'budget.ledger',
      },
    ];

    for (const attack of attacks) {
      const corrupted = structuredClone(valid) as SaveEnvelope;
      attack.mutate(corrupted);
      if (attack.reconcile) reconcileLedgerAndResign(corrupted);
      else resign(corrupted);

      expect(
        rejectionResult(
          attack.name,
          corrupted,
          attack.expectedIssueMessage,
          attack.expectedIssuePathPrefix,
        ),
      ).toEqual({
        name: attack.name,
        checksumRecomputed: true,
        snapshotHashRecomputed: true,
        gameStateRejected: true,
        targetIssueFound: true,
        envelopeRejected: true,
        restoreRejected: true,
      });
    }
  });

  it('rejects a re-signed annual grant for a school year that has not settled', () => {
    const original = session('future-grant-attack');
    advance(original, 40, 'week');
    const corrupted = createSaveEnvelope({
      session: original,
      saveId: 'year-one',
      createdAt: '2026-07-31T00:00:00.000Z',
      committedAt: '2026-07-31T00:00:00.000Z',
    });
    const futureGrant = structuredClone(annualGrant(corrupted, 1));
    futureGrant.schoolYearIndex = 2;
    futureGrant.absoluteWeek = 80;
    corrupted.snapshot.budget.ledger.push(futureGrant);
    reconcileLedgerAndResign(corrupted);

    expect(
      rejectionResult(
        'future annual grant',
        corrupted,
        'School year 2 must contain 0 annual grant ledger entry',
        'budget.ledger',
      ),
    ).toEqual({
      name: 'future annual grant',
      checksumRecomputed: true,
      snapshotHashRecomputed: true,
      gameStateRejected: true,
      targetIssueFound: true,
      envelopeRejected: true,
      restoreRejected: true,
    });
  });
});
