/**
 * Stateless RNG primitives shared by legacy and future rule implementations.
 *
 * This module intentionally has no stream names, schemas, game-state types, or
 * phase semantics. Legacy P01 owns stream selection, call accounting, and the
 * public DeterministicRng behavior.
 */
export function seedFromText(input: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

export function nextRngState(state: number): number {
  return (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
}
