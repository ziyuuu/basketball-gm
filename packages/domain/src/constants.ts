export const ENGINE_VERSION = '0.1.2-p01-r2';
export const SAVE_SCHEMA_VERSION = '0.1.0';
export const CONTENT_PACK_HASHES = {
  'p01-fixture': 'fixture-only-not-production-content',
} as const;

export const TERMS_PER_SCHOOL_YEAR = 2;
export const WEEKS_PER_TERM = 20;
export const OPERATION_WEEKS_PER_TERM = 16;
export const SCHOOL_YEARS_PER_RUN = 3;
export const CALENDAR_WEEKS_PER_RUN = TERMS_PER_SCHOOL_YEAR * WEEKS_PER_TERM * SCHOOL_YEARS_PER_RUN;
export const OPERATION_WEEKS_PER_RUN =
  TERMS_PER_SCHOOL_YEAR * OPERATION_WEEKS_PER_TERM * SCHOOL_YEARS_PER_RUN;

export const P01_INITIAL_GRANT = 100_000;
export const P01_ANNUAL_GRANT = 50_000;

export const RNG_STREAM_NAMES = [
  'recruitment',
  'generated-player',
  'event',
  'training-growth',
  'injury',
  'match',
  'career-outcome',
  'cosmetic',
] as const;

export type RngStreamName = (typeof RNG_STREAM_NAMES)[number];
