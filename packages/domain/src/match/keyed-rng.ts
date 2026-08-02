import { z } from 'zod';

import { idHash } from '../core/canonical-v2.js';
import type { Uint32Source } from '../core/rng-contract.js';
import { MatchDrawKindSchema, MatchSeedMaterialSchema, SegmentKeySchema } from './schemas.js';

const NonNegativeSafeIntegerSchema = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);

/**
 * A keyed match draw has no mutable cursor.  Its complete identity is local to
 * one immutable match seed and one semantic segment/draw coordinate.
 */
export const MatchDrawKeySchema = z
  .object({
    matchSeed: MatchSeedMaterialSchema,
    period: SegmentKeySchema.shape.period,
    possessionIndex: SegmentKeySchema.shape.possessionIndex,
    segmentIndex: SegmentKeySchema.shape.segmentIndex,
    drawKind: MatchDrawKindSchema,
    localIndex: NonNegativeSafeIntegerSchema,
  })
  .strict();

export type MatchDrawKey = z.infer<typeof MatchDrawKeySchema>;

export function deriveKeyedDrawHash(key: MatchDrawKey): string {
  return idHash(
    'match-keyed-draw-v2',
    [...key.matchSeed],
    key.period,
    key.possessionIndex,
    key.segmentIndex,
    key.drawKind,
    key.localIndex,
  );
}

/** The first 64 bits of the keyed SHA-256 digest, represented exactly as a bigint. */
export function keyedDrawUint64(key: MatchDrawKey): bigint {
  const parsed = MatchDrawKeySchema.parse(key);
  const hash = deriveKeyedDrawHash(parsed);
  return BigInt(`0x${hash.slice('sha256:'.length, 'sha256:'.length + 16)}`);
}

export function keyedDrawUint32(key: MatchDrawKey): number {
  return Number(keyedDrawUint64(key) >> 32n) >>> 0;
}

/** Returns a deterministic value in [0, 1) without a sequential match cursor. */
export function keyedDrawUnitInterval(key: MatchDrawKey): number {
  const upper53Bits = keyedDrawUint64(key) >> 11n;
  return Number(upper53Bits) / 0x20_0000_0000_0000;
}

export function keyedDrawInt(key: MatchDrawKey, minimum: number, maximum: number): number {
  if (!Number.isSafeInteger(minimum) || !Number.isSafeInteger(maximum) || maximum < minimum) {
    throw new Error(`Invalid keyed integer range: ${minimum}..${maximum}`);
  }
  const width = BigInt(maximum) - BigInt(minimum) + 1n;
  if (width > 0x1_0000_0000_0000_0000n) {
    throw new Error('A keyed integer range cannot exceed one uint64 draw domain.');
  }
  const offset = (keyedDrawUint64(key) * width) / 0x1_0000_0000_0000_0000n;
  return Number(BigInt(minimum) + offset);
}

/** Consumes exactly four sequential uint32 values to form the fixed match seed material. */
export function deriveMatchSeedMaterial(source: Uint32Source): [number, number, number, number] {
  const material = [
    source.nextUint32(),
    source.nextUint32(),
    source.nextUint32(),
    source.nextUint32(),
  ];
  return MatchSeedMaterialSchema.parse(material);
}
