# P02-003 v2.9-R1 Verification Report

This is implementation-thread verification, not an independent R1 review or Gate B decision.

## Candidate scope

- Branch: `task/p02-003-headless-model-b`
- R1 design commit: `122e02a056f2153fc799e671f53ee8fdb71c1b2a`
- Erratum 01 and revision base: `8855116aa45f2989a0b5c0079dbd76b662e27706`
- B6R implementation head: `b755fe85c649e119ab90d8cb58407588b8452ec6`
- Final evidence commit/tree and CI are recorded in Draft PR #15 to avoid a self-referential hash.

## Full verification

```bash
pnpm check
pnpm exec vitest run --maxWorkers=1 --no-file-parallelism --reporter=json
pnpm --filter @sunny-court/web build
pnpm --filter @sunny-court/sim-cli build
```

The complete Vitest suite passes 23 test files / 246 tests with zero failures or skipped tests. A
separate JSON reporter run records 49 internal suites, all passing. The full repository quality
gate passes Prettier, ESLint, TypeScript, boundary checks, Vitest, Web build, and CLI build. The two
production builds were also run separately and passed.

## Legacy and identity verification

The unchanged eight-file Legacy/P01-M1 matrix passes 133 tests. It includes the historical P01
legal/rejection and replay contracts plus boundary fixtures. The six P02-002 contract files plus
the B1R/B2R Physical identity files pass 61 tests across eight files. They verify exact Legacy
snapshot compatibility, strict Physical-only Model B input, no implicit conversion, and positive
and negative MatchInput/hash identity behavior.

```bash
pnpm sim:three-years -- --seed p01-evidence-001 --json
pnpm sim:three-years -- --seed r2-clean-gate --json
pnpm sim:batch -- --runs 1000 --seed-prefix p02-003-r1-legacy --replay-samples 20
```

Frozen Legacy hashes remain exact:

| Seed               | State hash               | Replay hash              |
| ------------------ | ------------------------ | ------------------------ |
| `p01-evidence-001` | `fnv64:d2e562049e32562a` | `fnv64:321321f346df2bd9` |
| `r2-clean-gate`    | `fnv64:8cbf99e1aa4068d4` | `fnv64:62713a07383cbf50` |

The Legacy batch completes 1,000/1,000 with zero failures, replay mismatches, calendar/operation
violations, or illegal terminal states; 20 replay samples were checked. Measured elapsed time was
`11901.11 ms`.

## Post-B6R review-remediation verification

The remediation adds two runtime negatives to `tests/p02-003-b2-session.test.ts` and one
source-level TypeScript API contract. The B1R-B6R focused matrix passes 6 files / 73 tests. The
P02-002 contracts plus B1R/B2R Physical identity matrix passes 8 files / 61 tests. An expanded
Legacy/P01/P02 direct regression matrix passes 11 files / 153 tests.

The full `pnpm check` run passes 22 files / 242 tests, Prettier, ESLint, TypeScript, boundary
checks, and both production builds. The Web and CLI builds were also run separately. The two frozen
three-year state/replay hash pairs remain exact, and the 1,000-run Legacy batch remains clean.

## Manifest verification

P00, P01, P01-M1, and the pre-evidence P02 manifest all validate before adding this record. After
the P02-003 evidence set is complete, the P02 manifest is regenerated and validated again. The R1
design and Erratum 01 manifests are also validated without editing their authority files.

## B7 runner/protocol/replay correction verification

The B7 runner no longer emits a fixed Q4 score and otherwise-only `UNFORCED_DEAD_BALL` sequence.
Its selectable behavior set is derived directly from the frozen registry (34 rows), rather than a
runner-local subset. It consumes the existing `SEGMENT_DURATION`, `SHOOTER`, creation/off-ball and
defensive execution keys while dispatching through the accepted behavior selection,
execution-probability, pass/shot/rebound/foul/free-throw and attribution/Fact primitives, including
HELPD, PRESS, DOUBLET, steal, block and last-pass assist paths. Its only public finalization result
is the frozen `MatchProtocolBundleSchema` shape with `input`, full `anchors`, and a parsed
`MatchResultDraft` containing `eventDigest` and `matchResultId`.

`replayMatch(input, authoritativeBundle)` parses the supplied authority, requires the exact input,
re-executes the match, and rejects any non-identical final protocol. The focused B7 suite passes 5/5:
the registry-derived 34-row selectable matrix; OFFICIAL, FRIENDLY and SCRIMMAGE per-object equality
over Events, Facts, Transcript, Anchors, MatchResult and hashes across step/run/replay; and one
minimal protocol/replay consistency negative for modified transcript/result identity. This is replay
verification only, not anti-tamper or player-save protection. The focused run takes 187.68 seconds.

The complete `pnpm check` after this correction passes 23 files / 247 tests, Prettier, ESLint,
TypeScript, boundaries, and both production builds. It takes 241.93 seconds. These measurements are
recorded for B8; they do not claim compliance with B8's 10,000-match performance budget.
