import {
  addFixedPoints,
  clampFixedPoint,
  multiplyFixedPoints,
  roundHalfUp,
  serializeFixedPoint,
} from '@sunny-court/domain/core';
import { describe, expect, it } from 'vitest';

describe('P02-002 fixed-point primitives', () => {
  it('handles exact legal bounds, clamp, and signed half-up rounding deterministically', () => {
    expect(clampFixedPoint(-5, -5, 5)).toBe(-5);
    expect(clampFixedPoint(5, -5, 5)).toBe(5);
    expect(clampFixedPoint(-7, -5, 5)).toBe(-5);
    expect(clampFixedPoint(7, -5, 5)).toBe(5);
    expect(roundHalfUp(5, 2)).toBe(3);
    expect(roundHalfUp(-5, 2)).toBe(-3);
    expect(roundHalfUp(4, 2)).toBe(2);
  });

  it('adds and multiplies through explicit integer authority boundaries', () => {
    expect(addFixedPoints(900, 200, { minimum: -1_000, maximum: 1_000 })).toBe(1_000);
    expect(addFixedPoints(-900, -200, { minimum: -1_000, maximum: 1_000 })).toBe(-1_000);
    expect(multiplyFixedPoints(1_500, 1_500)).toBe(2_250);
    expect(multiplyFixedPoints(1, 500)).toBe(1);
    expect(multiplyFixedPoints(-1, 500)).toBe(-1);
  });

  it('rejects unsafe or invalid parameters instead of relying on float behavior', () => {
    expect(() => clampFixedPoint(0, 1, -1)).toThrow(/minimum/i);
    expect(() => roundHalfUp(1, 0)).toThrow(/greater than zero/i);
    expect(() => addFixedPoints(Number.MAX_SAFE_INTEGER, 1)).toThrow(/safe integer range/i);
    expect(() => multiplyFixedPoints(1, 1, 0)).toThrow(/greater than zero/i);
    expect(() => serializeFixedPoint(1, 12)).toThrow(/power of ten/i);
  });

  it('serializes fixed values without a locale or floating-point display dependency', () => {
    expect(serializeFixedPoint(0)).toBe('0.000');
    expect(serializeFixedPoint(1_005)).toBe('1.005');
    expect(serializeFixedPoint(-1_005)).toBe('-1.005');
    expect(serializeFixedPoint(12, 1)).toBe('12');
  });
});
