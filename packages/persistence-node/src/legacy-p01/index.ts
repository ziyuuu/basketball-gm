import { copyFile, mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

import {
  type SaveEnvelope,
  type SaveRepository,
  validateSaveEnvelope,
} from '@sunny-court/persistence/legacy-p01';

function validateSlot(slot: string): string {
  if (!/^[a-zA-Z0-9_-]+$/.test(slot)) {
    throw new Error(`Invalid save slot: ${slot}`);
  }
  return slot;
}

function isMissingFile(error: unknown): boolean {
  return (
    error instanceof Error &&
    'code' in error &&
    (error as Error & { code?: string }).code === 'ENOENT'
  );
}

export class FileSaveRepository implements SaveRepository {
  readonly #directory: string;

  constructor(directory: string) {
    this.#directory = directory;
  }

  #paths(slotValue: string) {
    const slot = validateSlot(slotValue);
    return {
      latest: join(this.#directory, `${slot}.json`),
      backup: join(this.#directory, `${slot}.backup.json`),
      temp: join(this.#directory, `${slot}.${randomUUID()}.tmp`),
      backupTemp: join(this.#directory, `${slot}.${randomUUID()}.backup.tmp`),
    };
  }

  async saveAtomic(slot: string, envelopeValue: SaveEnvelope): Promise<void> {
    const envelope = validateSaveEnvelope(envelopeValue);
    const paths = this.#paths(slot);
    await mkdir(this.#directory, { recursive: true });

    try {
      await writeFile(paths.temp, `${JSON.stringify(envelope, null, 2)}\n`, {
        encoding: 'utf8',
        flag: 'wx',
      });
      validateSaveEnvelope(JSON.parse(await readFile(paths.temp, 'utf8')));

      try {
        await copyFile(paths.latest, paths.backupTemp);
        validateSaveEnvelope(JSON.parse(await readFile(paths.backupTemp, 'utf8')));
        await rename(paths.backupTemp, paths.backup);
      } catch (error) {
        if (!isMissingFile(error)) throw error;
      }

      await rename(paths.temp, paths.latest);
    } catch (error) {
      await Promise.allSettled([unlink(paths.temp), unlink(paths.backupTemp)]);
      throw error;
    }
  }

  async #load(path: string): Promise<SaveEnvelope | undefined> {
    try {
      const serialized = await readFile(path, 'utf8');
      return validateSaveEnvelope(JSON.parse(serialized));
    } catch (error) {
      if (isMissingFile(error)) return undefined;
      throw error;
    }
  }

  async loadLatest(slot: string): Promise<SaveEnvelope | undefined> {
    return this.#load(this.#paths(slot).latest);
  }

  async loadBackup(slot: string): Promise<SaveEnvelope | undefined> {
    return this.#load(this.#paths(slot).backup);
  }
}
