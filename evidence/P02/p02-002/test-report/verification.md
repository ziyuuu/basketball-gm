# P02-002 Verification Report

This is implementation-thread verification, not an independent Gate or review decision.

## Environment and base

- Node: `v24.14.0`
- pnpm: `11.7.0`
- Parent main: `99c5b56a570d8e02b79dc006230f25c57c823595`
- Parent tree: `5b82f6d2485965a5a735aaaefa5b6daafff7a624`
- Branch: `task/p02-002-match-contract-keyed-rng`
- Frozen install: `pnpm install --frozen-lockfile --store-dir /tmp/sunny-court-pnpm-store`

## Baseline

Before P02-002 edits, frozen install and `pnpm check` passed from the exact parent. The parent
suite reported 10 test files / 137 tests; Web and CLI builds passed.

## P02-002 directed contracts

```bash
pnpm exec vitest run \
  tests/p02-002-canonical-v2.test.ts \
  tests/p02-002-fixed-point.test.ts \
  tests/p02-002-rng-contract.test.ts \
  tests/p02-002-effects.test.ts \
  tests/p02-002-match-contracts.test.ts \
  tests/p02-002-package-exports.test.ts
```

Passes the Canonical V2, fixed-point, RNG, effect, protocol-chain, 12-player/scrimmage, and exact
subpath-export coverage recorded in this evidence set: 6 test files / 28 tests.

## Full and Legacy verification

```bash
pnpm check
pnpm --filter @sunny-court/web build
pnpm --filter @sunny-court/sim-cli build
pnpm boundaries
```

`pnpm check` passes formatting, ESLint, TypeScript, the existing boundary checker, the complete
Vitest suite (16 test files / 165 tests), Web build, and CLI build.

```bash
pnpm exec vitest run \
  packages/domain/src/rng.test.ts \
  packages/application/src/index.test.ts \
  packages/persistence/src/index.test.ts \
  packages/persistence-node/src/index.test.ts \
  packages/persistence-indexeddb/src/index.test.ts \
  tests/p01-three-year.test.ts \
  tests/p02-001-boundaries.test.ts \
  tests/p02-001-legacy-subpaths.test.ts
```

Passes 8 test files / 133 tests, including the existing P01-M1 legal and rejection matrix plus the
106 boundary fixtures. The checker and package export conclusions are in
`../boundary-and-exports.md`.

```bash
pnpm sim:three-years -- --seed p01-evidence-001 --json
pnpm sim:three-years -- --seed r2-clean-gate --json
pnpm sim:batch -- --runs 1000 --seed-prefix p02-002-legacy --replay-samples 20
(cd evidence/P00 && sha256sum -c manifest.sha256)
(cd evidence/P01 && sha256sum -c manifest.sha256)
(cd evidence/P01-M1 && sha256sum -c manifest.sha256)
pnpm evidence:manifest -- --phase P02
(cd evidence/P02 && sha256sum -c manifest.sha256)
```

Observed final-run outcomes: both frozen state/replay pairs remain exact; the batch completed
1,000/1,000 with zero failures, replay mismatches, calendar/operation violations, and illegal
terminal states; its measured elapsed time was `8860.03 ms`. Historical P00/P01/P01-M1 manifests
validate without modification; P02's current manifest is regenerated only after its current P02-002
evidence is finalized.
