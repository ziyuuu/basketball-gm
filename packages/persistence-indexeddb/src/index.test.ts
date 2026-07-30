import 'fake-indexeddb/auto';

import { GameSession } from '@sunny-court/application';
import { createInitialGame } from '@sunny-court/domain';
import { createSaveEnvelope } from '@sunny-court/persistence';
import { describe, expect, it } from 'vitest';

import { IndexedDbSaveRepository } from './index.js';

function createSession(): GameSession {
  const initial = createInitialGame({
    rootSeed: 'indexeddb-save',
    schoolName: '测试高中',
    managerName: '测试经理',
  });
  return new GameSession({
    state: initial.state,
    rng: initial.rng,
    auditClock: () => '2026-07-31T00:00:00.000Z',
  });
}

describe('IndexedDB save repository', () => {
  it('updates latest and backup in one slot transaction', async () => {
    const repository = new IndexedDbSaveRepository(`p01-test-${crypto.randomUUID()}`);
    const session = createSession();
    try {
      await repository.saveAtomic(
        'autosave',
        createSaveEnvelope({
          session,
          saveId: 'idb-1',
          createdAt: '2026-07-31T00:00:00.000Z',
          committedAt: '2026-07-31T00:00:00.000Z',
        }),
      );
      await repository.saveAtomic(
        'autosave',
        createSaveEnvelope({
          session,
          saveId: 'idb-2',
          parentSaveId: 'idb-1',
          createdAt: '2026-07-31T00:01:00.000Z',
          committedAt: '2026-07-31T00:01:00.000Z',
        }),
      );

      expect((await repository.loadLatest('autosave'))?.saveId).toBe('idb-2');
      expect((await repository.loadBackup('autosave'))?.saveId).toBe('idb-1');
    } finally {
      await repository.destroy();
    }
  });
});
