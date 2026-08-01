function canonicalize(value: unknown): string {
  if (value === null) return 'null';

  switch (typeof value) {
    case 'string':
      return JSON.stringify(value);
    case 'number':
      if (!Number.isFinite(value)) throw new Error('Cannot hash a non-finite number.');
      return Object.is(value, -0) ? '0' : String(value);
    case 'boolean':
      return value ? 'true' : 'false';
    case 'bigint':
      return JSON.stringify(value.toString());
    case 'undefined':
      return 'null';
    case 'object': {
      if (Array.isArray(value)) {
        return `[${value.map((item) => canonicalize(item)).join(',')}]`;
      }

      const record = value as Record<string, unknown>;
      const entries = Object.entries(record)
        .filter(([, child]) => child !== undefined)
        .sort(([left], [right]) => left.localeCompare(right));

      return `{${entries
        .map(([key, child]) => `${JSON.stringify(key)}:${canonicalize(child)}`)
        .join(',')}}`;
    }
    default:
      throw new Error(`Unsupported hash input: ${typeof value}`);
  }
}

export function stableStringify(value: unknown): string {
  return canonicalize(value);
}

export function stableHash(value: unknown): string {
  const input = stableStringify(value);
  let high = 0x811c9dc5;
  let low = 0x9e3779b9;

  for (let index = 0; index < input.length; index += 1) {
    const code = input.charCodeAt(index);
    high ^= code;
    high = Math.imul(high, 0x01000193) >>> 0;
    low ^= code + index;
    low = Math.imul(low, 0x85ebca6b) >>> 0;
  }

  return `fnv64:${high.toString(16).padStart(8, '0')}${low.toString(16).padStart(8, '0')}`;
}
