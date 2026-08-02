import { canonicalizeV2, compareUtf16CodeUnits } from '../core/canonical-v2.js';
import { clampFixedPoint, roundHalfUp } from '../core/fixed-point.js';
import { MatchEffectSchema, type MatchEffect } from './schemas.js';

export type MergedEffectModifier = Readonly<{
  target: MatchEffect['target'];
  parameter: MatchEffect['parameter'];
  additiveMilli: number;
  multiplierMilli: number;
  effectKeys: readonly string[];
}>;

function canonicalEffect(effect: MatchEffect): string {
  return canonicalizeV2(effect);
}

/**
 * Normalizes active effects by stable key.  A higher source revision replaces
 * an earlier value; two unequal definitions at the same key/revision are not a
 * valid authority state and are rejected rather than selected by input order.
 */
export function selectActiveMatchEffects(effects: readonly MatchEffect[]): MatchEffect[] {
  const selected = new Map<string, MatchEffect>();
  for (const candidate of effects) {
    const parsed = MatchEffectSchema.parse(candidate);
    const previous = selected.get(parsed.effectKey);
    if (!previous || parsed.sourceRevision > previous.sourceRevision) {
      selected.set(parsed.effectKey, parsed);
      continue;
    }
    if (
      parsed.sourceRevision === previous.sourceRevision &&
      canonicalEffect(parsed) !== canonicalEffect(previous)
    ) {
      throw new Error(
        `Conflicting effect definitions share ${parsed.effectKey} at one source revision.`,
      );
    }
  }
  return [...selected.values()].sort((left, right) =>
    compareUtf16CodeUnits(left.effectKey, right.effectKey),
  );
}

/** Replaces an existing same-key effect; it never creates a same-key stack. */
export function replaceMatchEffect(
  activeEffects: readonly MatchEffect[],
  replacement: MatchEffect,
): MatchEffect[] {
  return selectActiveMatchEffects([...activeEffects, replacement]);
}

function mergedTargetKey(effect: MatchEffect): string {
  return canonicalizeV2({ target: effect.target, parameter: effect.parameter });
}

function roundBigIntHalfUp(numerator: bigint, denominator: bigint): number {
  const quotient = numerator / denominator;
  const remainder = numerator % denominator;
  const rounded = remainder * 2n >= denominator ? quotient + 1n : quotient;
  if (rounded > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error('Merged effect multiplier exceeds the safe integer range.');
  }
  return Number(rounded);
}

/**
 * Merges different sources in a deterministic key order.  Additive modifiers
 * cap at +/-6.000 points and multiplicative modifiers cap at 0.750..1.250.
 */
export function mergeMatchEffects(effects: readonly MatchEffect[]): MergedEffectModifier[] {
  const groups = new Map<string, MatchEffect[]>();
  for (const effect of selectActiveMatchEffects(effects)) {
    const key = mergedTargetKey(effect);
    const group = groups.get(key);
    if (group) group.push(effect);
    else groups.set(key, [effect]);
  }

  return [...groups.entries()]
    .sort(([left], [right]) => compareUtf16CodeUnits(left, right))
    .map(([, group]) => {
      const ordered = [...group].sort((left, right) =>
        compareUtf16CodeUnits(left.effectKey, right.effectKey),
      );
      const first = ordered[0];
      if (!first) throw new Error('Effect merge group cannot be empty.');

      let additiveTotal = 0n;
      let multiplierNumerator = 1n;
      let multiplierDenominator = 1n;
      for (const effect of ordered) {
        if (effect.modifier.mode === 'ADD') {
          additiveTotal += BigInt(effect.modifier.valueMilli);
        } else {
          multiplierNumerator *= BigInt(effect.modifier.multiplierMilli);
          multiplierDenominator *= 1_000n;
        }
      }

      const boundedAddition =
        additiveTotal > 6_000n ? 6_000 : additiveTotal < -6_000n ? -6_000 : Number(additiveTotal);
      const multiplierMilli = clampFixedPoint(
        roundBigIntHalfUp(multiplierNumerator * 1_000n, multiplierDenominator),
        750,
        1_250,
      );

      return {
        target: first.target,
        parameter: first.parameter,
        additiveMilli: boundedAddition,
        multiplierMilli,
        effectKeys: ordered.map((effect) => effect.effectKey),
      };
    });
}

/**
 * Possession durations are consumed only after the caller confirms that a
 * possession was successfully committed.  Rejected, aborted, or failed drafts
 * leave the canonical active effect set untouched.
 */
export function decrementEffectsAfterCommittedPossession(
  effects: readonly MatchEffect[],
  possessionCommitted: boolean,
): MatchEffect[] {
  const active = selectActiveMatchEffects(effects);
  if (!possessionCommitted) return active;

  const next: MatchEffect[] = [];
  for (const effect of active) {
    if (effect.duration.kind !== 'POSSESSIONS') {
      next.push(effect);
      continue;
    }
    if (effect.duration.remainingPossessions === 1) continue;
    next.push(
      MatchEffectSchema.parse({
        ...effect,
        duration: {
          kind: 'POSSESSIONS',
          remainingPossessions: effect.duration.remainingPossessions - 1,
        },
      }),
    );
  }
  return next;
}

/** A small public helper for the documented fixed-point additive effect cap. */
export function clampEffectAdditiveMilli(value: number): number {
  return clampFixedPoint(value, -6_000, 6_000);
}

/** A small public helper for deterministic signed half-up effect calculations. */
export function roundEffectRatioHalfUp(numerator: number, denominator: number): number {
  return roundHalfUp(numerator, denominator);
}
