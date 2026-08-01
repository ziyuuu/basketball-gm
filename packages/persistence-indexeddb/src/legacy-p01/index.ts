import { deleteDB, openDB, type DBSchema, type IDBPDatabase } from 'idb';

import {
  type SaveEnvelope,
  type SaveRepository,
  validateSaveEnvelope,
} from '@sunny-court/persistence/legacy-p01';

interface SaveSlotRecord {
  slot: string;
  latest: SaveEnvelope;
  backup?: SaveEnvelope;
}

interface SunnyCourtSaveDatabase extends DBSchema {
  slots: {
    key: string;
    value: SaveSlotRecord;
  };
}

export class IndexedDbSaveRepository implements SaveRepository {
  readonly #databaseName: string;
  readonly #database: Promise<IDBPDatabase<SunnyCourtSaveDatabase>>;

  constructor(databaseName = 'sunny-court-manager-saves') {
    this.#databaseName = databaseName;
    this.#database = openDB<SunnyCourtSaveDatabase>(databaseName, 1, {
      upgrade(database) {
        database.createObjectStore('slots', { keyPath: 'slot' });
      },
    });
  }

  async saveAtomic(slot: string, envelopeValue: SaveEnvelope): Promise<void> {
    const envelope = validateSaveEnvelope(envelopeValue);
    const database = await this.#database;
    const transaction = database.transaction('slots', 'readwrite');
    const store = transaction.objectStore('slots');
    const current = await store.get(slot);
    await store.put({
      slot,
      latest: structuredClone(envelope),
      ...(current ? { backup: structuredClone(current.latest) } : {}),
    });
    await transaction.done;
  }

  async loadLatest(slot: string): Promise<SaveEnvelope | undefined> {
    const database = await this.#database;
    const latest = (await database.get('slots', slot))?.latest;
    return latest ? validateSaveEnvelope(structuredClone(latest)) : undefined;
  }

  async loadBackup(slot: string): Promise<SaveEnvelope | undefined> {
    const database = await this.#database;
    const backup = (await database.get('slots', slot))?.backup;
    return backup ? validateSaveEnvelope(structuredClone(backup)) : undefined;
  }

  async close(): Promise<void> {
    (await this.#database).close();
  }

  async destroy(): Promise<void> {
    await this.close();
    await deleteDB(this.#databaseName);
  }
}
