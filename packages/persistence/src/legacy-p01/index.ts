import {
  CommandAuditLogSchema,
  GameSession,
  type CommandAuditRecord,
} from '@sunny-court/application/legacy-p01';
import {
  CONTENT_PACK_HASHES,
  ENGINE_VERSION,
  GameStateSchema,
  RngStateBundleSchema,
  SAVE_SCHEMA_VERSION,
  stableHash,
  type GameState,
  type RngStateBundle,
} from '@sunny-court/domain/legacy-p01';
import { z } from 'zod';

export const SaveEnvelopeSchema = z
  .object({
    schemaVersion: z.literal(SAVE_SCHEMA_VERSION),
    engineVersion: z.literal(ENGINE_VERSION),
    contentPackHashes: z.record(z.string().min(1), z.string().min(1)),
    saveId: z.string().min(1),
    parentSaveId: z.string().min(1).optional(),
    createdAt: z.string().datetime(),
    committedAt: z.string().datetime(),
    snapshotHash: z.string().min(1),
    checksum: z.string().min(1),
    snapshot: GameStateSchema,
    rng: RngStateBundleSchema,
    recentCommandLog: CommandAuditLogSchema,
  })
  .strict();

export type SaveEnvelope = z.infer<typeof SaveEnvelopeSchema>;

export class SaveIntegrityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SaveIntegrityError';
  }
}

function withoutChecksum(envelope: SaveEnvelope): Omit<SaveEnvelope, 'checksum'> {
  const { checksum: _checksum, ...payload } = envelope;
  return payload;
}

export function calculateSaveChecksum(envelope: SaveEnvelope): string {
  return stableHash(withoutChecksum(envelope));
}

export interface CreateSaveEnvelopeOptions {
  session: GameSession;
  saveId: string;
  parentSaveId?: string;
  createdAt?: string;
  committedAt?: string;
  contentPackHashes?: Readonly<Record<string, string>>;
}

export function createSaveEnvelope(options: CreateSaveEnvelopeOptions): SaveEnvelope {
  const createdAt = options.createdAt ?? new Date().toISOString();
  const committedAt = options.committedAt ?? createdAt;
  const snapshot = options.session.state();
  const base = {
    schemaVersion: SAVE_SCHEMA_VERSION,
    engineVersion: ENGINE_VERSION,
    contentPackHashes: {
      ...(options.contentPackHashes ?? CONTENT_PACK_HASHES),
    },
    saveId: options.saveId,
    ...(options.parentSaveId ? { parentSaveId: options.parentSaveId } : {}),
    createdAt,
    committedAt,
    snapshotHash: stableHash(snapshot),
    checksum: 'pending',
    snapshot,
    rng: options.session.rngSnapshot(),
    recentCommandLog: options.session.recentCommandLog(),
  };
  const parsed = SaveEnvelopeSchema.parse(base);
  parsed.checksum = calculateSaveChecksum(parsed);
  return SaveEnvelopeSchema.parse(parsed);
}

export function validateSaveEnvelope(value: unknown): SaveEnvelope {
  const envelope = SaveEnvelopeSchema.parse(value);
  const actualSnapshotHash = stableHash(envelope.snapshot);
  if (envelope.snapshotHash !== actualSnapshotHash) {
    throw new SaveIntegrityError(
      `Snapshot hash mismatch: expected ${envelope.snapshotHash}, got ${actualSnapshotHash}.`,
    );
  }
  const actualChecksum = calculateSaveChecksum(envelope);
  if (envelope.checksum !== actualChecksum) {
    throw new SaveIntegrityError(
      `Save checksum mismatch: expected ${envelope.checksum}, got ${actualChecksum}.`,
    );
  }
  return SaveEnvelopeSchema.parse(structuredClone(envelope));
}

export function restoreSession(envelopeValue: unknown, auditClock?: () => string): GameSession {
  const envelope = validateSaveEnvelope(envelopeValue);
  return new GameSession({
    state: envelope.snapshot,
    rng: envelope.rng,
    recentCommandLog: envelope.recentCommandLog,
    ...(auditClock ? { auditClock } : {}),
  });
}

export interface SaveRepository {
  saveAtomic(slot: string, envelope: SaveEnvelope): Promise<void>;
  loadLatest(slot: string): Promise<SaveEnvelope | undefined>;
  loadBackup(slot: string): Promise<SaveEnvelope | undefined>;
}

interface SlotRecord {
  latest: SaveEnvelope;
  backup?: SaveEnvelope;
}

export class InMemorySaveRepository implements SaveRepository {
  readonly #slots = new Map<string, SlotRecord>();

  async saveAtomic(slot: string, envelopeValue: SaveEnvelope): Promise<void> {
    const envelope = validateSaveEnvelope(envelopeValue);
    const current = this.#slots.get(slot);
    this.#slots.set(slot, {
      latest: structuredClone(envelope),
      ...(current ? { backup: structuredClone(current.latest) } : {}),
    });
  }

  async loadLatest(slot: string): Promise<SaveEnvelope | undefined> {
    const latest = this.#slots.get(slot)?.latest;
    return latest ? validateSaveEnvelope(structuredClone(latest)) : undefined;
  }

  async loadBackup(slot: string): Promise<SaveEnvelope | undefined> {
    const backup = this.#slots.get(slot)?.backup;
    return backup ? validateSaveEnvelope(structuredClone(backup)) : undefined;
  }
}

export type { CommandAuditRecord, GameState, RngStateBundle };
