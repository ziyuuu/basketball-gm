import { GameSession, createAdvanceWeekCommand } from '@sunny-court/application';
import { createInitialGame, stableHash } from '@sunny-court/domain';
import { describe, expect, it } from 'vitest';

import {
  InMemorySaveRepository,
  SaveIntegrityError,
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
});
