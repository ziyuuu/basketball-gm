import { nextRngState } from './rng-primitives.js';

export type SequentialUint32State = Readonly<{
  state: number;
  calls: number;
}>;

export type NextUint32Result = Readonly<{
  value: number;
  state: SequentialUint32State;
}>;

function assertUint32(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0 || value > 0xffff_ffff) {
    throw new Error(`${label} must be an unsigned 32-bit integer.`);
  }
}

function assertCallCount(value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error('calls must be a non-negative safe integer.');
  }
}

export function assertSequentialUint32State(value: SequentialUint32State): void {
  assertUint32(value.state, 'state');
  assertCallCount(value.calls);
}

/**
 * Advances exactly once through the existing LCG transition and increments the
 * matching call count exactly once.  It is deliberately stream-name agnostic.
 */
export function nextUint32(state: SequentialUint32State): NextUint32Result {
  assertSequentialUint32State(state);
  if (state.calls === Number.MAX_SAFE_INTEGER) {
    throw new Error('RNG call count exceeds the safe integer range.');
  }
  const nextState = nextRngState(state.state);
  return {
    value: nextState,
    state: {
      state: nextState,
      calls: state.calls + 1,
    },
  };
}

/** A small stateful adapter for consumers that own an isolated sequential stream. */
export class SequentialUint32Rng {
  #state: SequentialUint32State;

  constructor(initialState: SequentialUint32State) {
    assertSequentialUint32State(initialState);
    this.#state = { ...initialState };
  }

  nextUint32(): number {
    const next = nextUint32(this.#state);
    this.#state = next.state;
    return next.value;
  }

  snapshot(): SequentialUint32State {
    return { ...this.#state };
  }
}

export type Uint32Source = Readonly<{
  nextUint32: () => number;
}>;
