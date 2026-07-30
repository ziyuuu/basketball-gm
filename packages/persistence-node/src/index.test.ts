import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { GameSession, createAdvanceWeekCommand } from '@sunny-court/application';
import { createInitialGame } from '@sunny-court/domain';
import { createSaveEnvelope } from '@sunny-court/persistence';
import { afterEach, describe, expect, it } from 'vitest';

import { FileSaveRepository } from './index.js';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

function createSession(): GameSession {
  const initial = createInitialGame({
    rootSeed: 'file-save',
    schoolName: '测试高中',
    managerName: '测试经理',
  });
  return new GameSession({
    state: initial.state,
    rng: initial.rng,
    auditClock: () => '2026-07-31T00:00:00.000Z',
  });
}

describe('Node file save repository', () => {
  it('persists latest and previous-good backup files', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'sunny-court-save-'));
    temporaryDirectories.push(directory);
    const repository = new FileSaveRepository(directory);
    const session = createSession();

    await repository.saveAtomic(
      'autosave',
      createSaveEnvelope({
        session,
        saveId: 'file-1',
        createdAt: '2026-07-31T00:00:00.000Z',
        committedAt: '2026-07-31T00:00:00.000Z',
      }),
    );
    expect(session.execute(createAdvanceWeekCommand(session, 'week-1')).ok).toBe(true);
    await repository.saveAtomic(
      'autosave',
      createSaveEnvelope({
        session,
        saveId: 'file-2',
        parentSaveId: 'file-1',
        createdAt: '2026-07-31T00:01:00.000Z',
        committedAt: '2026-07-31T00:01:00.000Z',
      }),
    );

    expect((await repository.loadLatest('autosave'))?.saveId).toBe('file-2');
    expect((await repository.loadBackup('autosave'))?.saveId).toBe('file-1');
  });
});
