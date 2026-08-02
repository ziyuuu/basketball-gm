/**
 * P02 canonical encoding and SHA-256 implementation.
 *
 * This intentionally does not import Node crypto.  The domain package remains
 * portable and pure while identities are synchronous and deterministic.
 */
export type CanonicalV2Primitive = null | boolean | number | string;

/** A recursive index signature avoids relying on a compiler-specific recursive Record alias. */
export interface CanonicalV2Object {
  readonly [key: string]: CanonicalV2Value;
}

export type CanonicalV2Value =
  CanonicalV2Primitive | readonly CanonicalV2Value[] | CanonicalV2Object;

const SHA256_ROUND_CONSTANTS = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

const SHA256_INITIAL_STATE = new Uint32Array([
  0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
]);

export const SHA256_HASH_PATTERN = /^sha256:[a-f0-9]{64}$/;

/** JavaScript string comparison is intentionally UTF-16-code-unit lexicographic. */
export function compareUtf16CodeUnits(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

export function sortUtf16CodeUnitKeys(keys: readonly string[]): string[] {
  return [...keys].sort(compareUtf16CodeUnits);
}

function assertWellFormedUnicode(value: string): void {
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (Number.isNaN(next) || next < 0xdc00 || next > 0xdfff) {
        throw new Error('Canonical V2 strings must not contain an unpaired high surrogate.');
      }
      index += 1;
      continue;
    }
    if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
      throw new Error('Canonical V2 strings must not contain an unpaired low surrogate.');
    }
  }
}

function isCanonicalObject(value: object): value is Record<string, unknown> {
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function canonicalize(value: unknown, ancestors: Set<object>): string {
  if (value === null) return 'null';

  switch (typeof value) {
    case 'boolean':
      return value ? 'true' : 'false';
    case 'string':
      assertWellFormedUnicode(value);
      return JSON.stringify(value);
    case 'number':
      if (!Number.isFinite(value))
        throw new Error('Canonical V2 cannot encode a non-finite number.');
      return Object.is(value, -0) ? '0' : String(value);
    case 'object': {
      if (ancestors.has(value)) throw new Error('Canonical V2 cannot encode a cyclic object.');
      ancestors.add(value);
      try {
        if (Array.isArray(value)) {
          return `[${value.map((item) => canonicalize(item, ancestors)).join(',')}]`;
        }
        if (!isCanonicalObject(value)) {
          throw new Error('Canonical V2 only accepts plain objects and arrays.');
        }
        const keys = sortUtf16CodeUnitKeys(Object.keys(value));
        return `{${keys
          .map((key) => {
            assertWellFormedUnicode(key);
            const child = value[key];
            if (child === undefined) {
              throw new Error('Canonical V2 does not omit undefined object properties.');
            }
            return `${JSON.stringify(key)}:${canonicalize(child, ancestors)}`;
          })
          .join(',')}}`;
      } finally {
        ancestors.delete(value);
      }
    }
    case 'undefined':
      throw new Error('Canonical V2 cannot encode undefined.');
    case 'bigint':
      throw new Error('Canonical V2 cannot encode bigint.');
    case 'function':
    case 'symbol':
      throw new Error(`Canonical V2 cannot encode ${typeof value}.`);
    default:
      throw new Error('Canonical V2 received an unsupported value.');
  }
}

export function canonicalizeV2(value: CanonicalV2Value): string {
  return canonicalize(value, new Set());
}

function rotateRight(value: number, amount: number): number {
  return (value >>> amount) | (value << (32 - amount));
}

function paddedSha256Bytes(input: Uint8Array): Uint8Array {
  const bitLength = BigInt(input.length) * 8n;
  const paddingLength = (64 - ((input.length + 1 + 8) % 64)) % 64;
  const result = new Uint8Array(input.length + 1 + paddingLength + 8);
  result.set(input);
  result[input.length] = 0x80;
  for (let index = 0; index < 8; index += 1) {
    const shift = BigInt((7 - index) * 8);
    result[result.length - 8 + index] = Number((bitLength >> shift) & 0xffn);
  }
  return result;
}

/** SHA-256 over UTF-8 text, returned as lowercase hexadecimal. */
export function sha256Hex(input: string): string {
  assertWellFormedUnicode(input);
  const bytes = paddedSha256Bytes(new TextEncoder().encode(input));
  const state = new Uint32Array(SHA256_INITIAL_STATE);
  const words = new Uint32Array(64);

  for (let offset = 0; offset < bytes.length; offset += 64) {
    for (let index = 0; index < 16; index += 1) {
      const byteOffset = offset + index * 4;
      words[index] =
        ((bytes[byteOffset] ?? 0) << 24) |
        ((bytes[byteOffset + 1] ?? 0) << 16) |
        ((bytes[byteOffset + 2] ?? 0) << 8) |
        (bytes[byteOffset + 3] ?? 0);
    }
    for (let index = 16; index < 64; index += 1) {
      const previous15 = words[index - 15] ?? 0;
      const previous2 = words[index - 2] ?? 0;
      const smallSigma0 =
        rotateRight(previous15, 7) ^ rotateRight(previous15, 18) ^ (previous15 >>> 3);
      const smallSigma1 =
        rotateRight(previous2, 17) ^ rotateRight(previous2, 19) ^ (previous2 >>> 10);
      words[index] =
        ((words[index - 16] ?? 0) + smallSigma0 + (words[index - 7] ?? 0) + smallSigma1) >>> 0;
    }

    let [a, b, c, d, e, f, g, h] = state;
    for (let index = 0; index < 64; index += 1) {
      const bigSigma1 = rotateRight(e ?? 0, 6) ^ rotateRight(e ?? 0, 11) ^ rotateRight(e ?? 0, 25);
      const choose = ((e ?? 0) & (f ?? 0)) ^ (~(e ?? 0) & (g ?? 0));
      const temp1 =
        ((h ?? 0) +
          bigSigma1 +
          choose +
          (SHA256_ROUND_CONSTANTS[index] ?? 0) +
          (words[index] ?? 0)) >>>
        0;
      const bigSigma0 = rotateRight(a ?? 0, 2) ^ rotateRight(a ?? 0, 13) ^ rotateRight(a ?? 0, 22);
      const majority = ((a ?? 0) & (b ?? 0)) ^ ((a ?? 0) & (c ?? 0)) ^ ((b ?? 0) & (c ?? 0));
      const temp2 = (bigSigma0 + majority) >>> 0;
      h = g;
      g = f;
      f = e;
      e = ((d ?? 0) + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    state[0] = ((state[0] ?? 0) + (a ?? 0)) >>> 0;
    state[1] = ((state[1] ?? 0) + (b ?? 0)) >>> 0;
    state[2] = ((state[2] ?? 0) + (c ?? 0)) >>> 0;
    state[3] = ((state[3] ?? 0) + (d ?? 0)) >>> 0;
    state[4] = ((state[4] ?? 0) + (e ?? 0)) >>> 0;
    state[5] = ((state[5] ?? 0) + (f ?? 0)) >>> 0;
    state[6] = ((state[6] ?? 0) + (g ?? 0)) >>> 0;
    state[7] = ((state[7] ?? 0) + (h ?? 0)) >>> 0;
  }

  return [...state].map((word) => word.toString(16).padStart(8, '0')).join('');
}

export function canonicalV2Hash(value: CanonicalV2Value): string {
  return `sha256:${sha256Hex(canonicalizeV2(value))}`;
}

export function idHash(domain: string, ...values: readonly CanonicalV2Value[]): string {
  if (domain.length === 0) throw new Error('Identity hash domain must not be empty.');
  assertWellFormedUnicode(domain);
  return canonicalV2Hash({ domain, values });
}

export function isCanonicalV2Hash(value: string): boolean {
  return SHA256_HASH_PATTERN.test(value);
}
