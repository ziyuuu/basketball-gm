import * as applicationRoot from '@sunny-court/application';
import * as applicationLegacy from '@sunny-court/application/legacy-p01';
import * as domainRoot from '@sunny-court/domain';
import * as domainLegacy from '@sunny-court/domain/legacy-p01';
import * as indexedDbRoot from '@sunny-court/persistence-indexeddb';
import * as indexedDbLegacy from '@sunny-court/persistence-indexeddb/legacy-p01';
import * as nodeRoot from '@sunny-court/persistence-node';
import * as nodeLegacy from '@sunny-court/persistence-node/legacy-p01';
import * as persistenceRoot from '@sunny-court/persistence';
import * as persistenceLegacy from '@sunny-court/persistence/legacy-p01';
import { describe, expect, it } from 'vitest';

function createSession(seed: string) {
  const initial = domainRoot.createInitialGame({
    rootSeed: seed,
    schoolName: 'P02-001兼容高中',
    managerName: 'P02-001兼容经理',
  });
  return new applicationRoot.GameSession({
    state: initial.state,
    rng: initial.rng,
    auditClock: () => '2026-08-01T00:00:00.000Z',
  });
}

describe('P02-001 Legacy P01 package subpaths', () => {
  it('directly imports all five Legacy package subpaths with the exact root runtime identities', () => {
    expect(Object.keys(domainRoot).sort()).toEqual(Object.keys(domainLegacy).sort());
    expect(Object.keys(applicationRoot).sort()).toEqual(Object.keys(applicationLegacy).sort());
    expect(Object.keys(persistenceRoot).sort()).toEqual(Object.keys(persistenceLegacy).sort());
    expect(Object.keys(nodeRoot).sort()).toEqual(Object.keys(nodeLegacy).sort());
    expect(Object.keys(indexedDbRoot).sort()).toEqual(Object.keys(indexedDbLegacy).sort());

    expect(domainRoot.DeterministicRng).toBe(domainLegacy.DeterministicRng);
    expect(domainRoot.GameStateSchema).toBe(domainLegacy.GameStateSchema);
    expect(applicationRoot.GameSession).toBe(applicationLegacy.GameSession);
    expect(persistenceRoot.InMemorySaveRepository).toBe(persistenceLegacy.InMemorySaveRepository);
    expect(nodeRoot.FileSaveRepository).toBe(nodeLegacy.FileSaveRepository);
    expect(indexedDbRoot.IndexedDbSaveRepository).toBe(indexedDbLegacy.IndexedDbSaveRepository);
  });

  it('keeps the root and Legacy save/latest/backup contracts identical', async () => {
    const session = createSession('p02-001-persistence-contract');
    const first = persistenceRoot.createSaveEnvelope({
      session,
      saveId: 'first',
      createdAt: '2026-08-01T00:00:00.000Z',
      committedAt: '2026-08-01T00:00:00.000Z',
    });
    const command = applicationLegacy.createAdvanceWeekCommand(session, 'p02-001:week:1');
    const result = session.execute(command);
    expect(result.ok).toBe(true);
    const second = persistenceLegacy.createSaveEnvelope({
      session,
      saveId: 'second',
      parentSaveId: 'first',
      createdAt: '2026-08-01T00:00:00.000Z',
      committedAt: '2026-08-01T00:00:00.000Z',
    });

    expect(persistenceRoot.validateSaveEnvelope(second)).toEqual(
      persistenceLegacy.validateSaveEnvelope(second),
    );
    expect(persistenceRoot.restoreSession(second).state()).toEqual(
      persistenceLegacy.restoreSession(second).state(),
    );

    const rootRepository = new persistenceRoot.InMemorySaveRepository();
    const legacyRepository = new persistenceLegacy.InMemorySaveRepository();
    await rootRepository.saveAtomic('compatibility', first);
    await legacyRepository.saveAtomic('compatibility', first);
    await rootRepository.saveAtomic('compatibility', second);
    await legacyRepository.saveAtomic('compatibility', second);

    await expect(rootRepository.loadLatest('compatibility')).resolves.toEqual(
      await legacyRepository.loadLatest('compatibility'),
    );
    await expect(rootRepository.loadBackup('compatibility')).resolves.toEqual(
      await legacyRepository.loadBackup('compatibility'),
    );
  });
});
