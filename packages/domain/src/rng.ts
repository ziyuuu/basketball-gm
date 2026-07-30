import { RNG_STREAM_NAMES, type RngStreamName } from './constants.js';
import { RngStateBundleSchema, type RngStateBundle } from './schemas.js';

function seedFromText(input: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

function nextState(state: number): number {
  return (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
}

export class DeterministicRng {
  readonly rootSeed: string;
  readonly #streams: RngStateBundle['streams'];

  constructor(rootSeed: string, snapshot?: RngStateBundle) {
    if (snapshot) {
      const parsed = RngStateBundleSchema.parse(snapshot);
      this.rootSeed = parsed.rootSeed;
      this.#streams = structuredClone(parsed.streams);
      return;
    }

    if (rootSeed.length === 0) throw new Error('Root seed cannot be empty.');
    this.rootSeed = rootSeed;
    this.#streams = Object.fromEntries(
      RNG_STREAM_NAMES.map((name) => [
        name,
        {
          state: seedFromText(`${rootSeed}::${name}`),
          calls: 0,
        },
      ]),
    ) as RngStateBundle['streams'];
  }

  static fromSnapshot(snapshot: RngStateBundle): DeterministicRng {
    return new DeterministicRng(snapshot.rootSeed, snapshot);
  }

  clone(): DeterministicRng {
    return DeterministicRng.fromSnapshot(this.snapshot());
  }

  snapshot(): RngStateBundle {
    return RngStateBundleSchema.parse({
      rootSeed: this.rootSeed,
      streams: structuredClone(this.#streams),
    });
  }

  calls(stream: RngStreamName): number {
    return this.#streams[stream].calls;
  }

  callCounts(): Record<RngStreamName, number> {
    return Object.fromEntries(
      RNG_STREAM_NAMES.map((name) => [name, this.#streams[name].calls]),
    ) as Record<RngStreamName, number>;
  }

  nextFloat(stream: RngStreamName): number {
    const streamState = this.#streams[stream];
    streamState.state = nextState(streamState.state);
    streamState.calls += 1;
    return streamState.state / 0x1_0000_0000;
  }

  nextInt(stream: RngStreamName, minimum: number, maximum: number): number {
    if (!Number.isInteger(minimum) || !Number.isInteger(maximum) || maximum < minimum) {
      throw new Error(`Invalid integer range: ${minimum}..${maximum}`);
    }
    return minimum + Math.floor(this.nextFloat(stream) * (maximum - minimum + 1));
  }

  pick<T>(stream: RngStreamName, values: readonly T[]): T {
    if (values.length === 0) throw new Error('Cannot pick from an empty collection.');
    const selected = values[this.nextInt(stream, 0, values.length - 1)];
    if (selected === undefined) throw new Error('RNG selected an invalid index.');
    return selected;
  }
}
