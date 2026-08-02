/**
 * Deterministic fixed-point helpers for P02 authority values.
 *
 * Values are stored as safe integer thousandths.  No helper accepts a floating
 * point authority value: callers must choose their explicit rounding boundary.
 */
export const FIXED_POINT_SCALE = 1_000;

export type FixedPointBounds = Readonly<{
  minimum: number;
  maximum: number;
}>;

function assertSafeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value)) {
    throw new Error(`${label} must be a safe integer.`);
  }
}

function assertPositiveSafeInteger(value: number, label: string): void {
  assertSafeInteger(value, label);
  if (value <= 0) throw new Error(`${label} must be greater than zero.`);
}

function assertBounds(bounds: FixedPointBounds): void {
  assertSafeInteger(bounds.minimum, 'bounds.minimum');
  assertSafeInteger(bounds.maximum, 'bounds.maximum');
  if (bounds.minimum > bounds.maximum) {
    throw new Error('bounds.minimum must not exceed bounds.maximum.');
  }
}

function bigintToSafeInteger(value: bigint, label: string): number {
  if (value > BigInt(Number.MAX_SAFE_INTEGER) || value < BigInt(Number.MIN_SAFE_INTEGER)) {
    throw new Error(`${label} exceeds the safe integer range.`);
  }
  return Number(value);
}

function applyBounds(value: number, bounds: FixedPointBounds | undefined): number {
  if (!bounds) return value;
  assertBounds(bounds);
  return clampFixedPoint(value, bounds.minimum, bounds.maximum);
}

/**
 * Rounds a rational number to the nearest integer; exact halves move away from
 * zero.  This is the explicit P02 half-up boundary for signed fixed values.
 */
export function roundHalfUp(numerator: number, denominator: number): number {
  assertSafeInteger(numerator, 'numerator');
  assertPositiveSafeInteger(denominator, 'denominator');

  const numeratorBigInt = BigInt(numerator);
  const denominatorBigInt = BigInt(denominator);
  const negative = numeratorBigInt < 0n;
  const absoluteNumerator = negative ? -numeratorBigInt : numeratorBigInt;
  const quotient = absoluteNumerator / denominatorBigInt;
  const remainder = absoluteNumerator % denominatorBigInt;
  const rounded = remainder * 2n >= denominatorBigInt ? quotient + 1n : quotient;
  return bigintToSafeInteger(negative ? -rounded : rounded, 'rounded fixed-point value');
}

export function clampFixedPoint(value: number, minimum: number, maximum: number): number {
  assertSafeInteger(value, 'value');
  assertSafeInteger(minimum, 'minimum');
  assertSafeInteger(maximum, 'maximum');
  if (minimum > maximum) throw new Error('minimum must not exceed maximum.');
  return Math.min(maximum, Math.max(minimum, value));
}

export function addFixedPoints(left: number, right: number, bounds?: FixedPointBounds): number {
  assertSafeInteger(left, 'left');
  assertSafeInteger(right, 'right');
  const result = bigintToSafeInteger(BigInt(left) + BigInt(right), 'fixed-point addition');
  return applyBounds(result, bounds);
}

/**
 * Multiplies two values expressed with the same scale and rounds once at the
 * resulting authority boundary.
 */
export function multiplyFixedPoints(
  left: number,
  right: number,
  scale = FIXED_POINT_SCALE,
  bounds?: FixedPointBounds,
): number {
  assertSafeInteger(left, 'left');
  assertSafeInteger(right, 'right');
  assertPositiveSafeInteger(scale, 'scale');
  const product = BigInt(left) * BigInt(right);
  const result = roundHalfUpBigInt(product, BigInt(scale));
  return applyBounds(bigintToSafeInteger(result, 'fixed-point multiplication'), bounds);
}

function roundHalfUpBigInt(numerator: bigint, denominator: bigint): bigint {
  const negative = numerator < 0n;
  const absoluteNumerator = negative ? -numerator : numerator;
  const quotient = absoluteNumerator / denominator;
  const remainder = absoluteNumerator % denominator;
  const rounded = remainder * 2n >= denominator ? quotient + 1n : quotient;
  return negative ? -rounded : rounded;
}

/** Serializes a thousandth-point value without a display-locale dependency. */
export function serializeFixedPoint(value: number, scale = FIXED_POINT_SCALE): string {
  assertSafeInteger(value, 'value');
  assertPositiveSafeInteger(scale, 'scale');
  const scaleText = String(scale);
  if (!/^10*$/.test(scaleText)) {
    throw new Error('scale must be a positive power of ten for decimal serialization.');
  }

  const decimalDigits = scaleText.length - 1;
  const negative = value < 0;
  const absolute = Math.abs(value);
  const whole = Math.floor(absolute / scale);
  const fraction = absolute % scale;
  const sign = negative ? '-' : '';
  if (decimalDigits === 0) return `${sign}${whole}`;
  return `${sign}${whole}.${String(fraction).padStart(decimalDigits, '0')}`;
}
