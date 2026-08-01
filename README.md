# Sunny Court Manager

Formal engineering repository for a Web-first, single-player Chinese high-school girls' basketball management game.

The current implementation covers:

- **P00** — auditable monorepo baseline, strict TypeScript, package boundaries, CI, task/Gate templates, and a content-schema spike.
- **P01** — a headless three-school-year rules sandbox with deterministic RNG streams, atomic commands, versioned saves, prototype training/growth/graduation, match model A, and a CLI runner.

The T00 visual prototype is intentionally separate. This repository does not reuse its temporary page architecture or fake gameplay.

## Current status

- P00/P01 are complete on `main@6547fbf51b2a440fd9602eed82c869d70b1181e1`.
- P01-R2 candidate `f008514ef4b6c0f0af78bdf8a5a2dff86aaa2750` passed the independent
  technical review used by this personal project and was merged through PR #1.
- Engine version: `0.1.2-p01-r2`.
- P02-000 gameplay baseline v1.2 is Owner-approved; the 2026-08-02 amendment fixes the entire P02
  team at 12 active players.
- P02 development plan v1.2 is Owner-approved and carries the same 12-player rule.
- P01-M1 annual-grant integrity hardening merged through PR #7 at
  `main@5f3ed1cdd4a816e0c482f5161e86706eda1f4c60`; independent Gate #8 passed for its exact
  candidate before merge.
- P02-001 merged through PR #10 at `main@5eb947f81fe2600c3cd710999e1acc4d4718c63b`.
- P02-002 exists as Issue #11 in `READY / NOT STARTED`; no P02 gameplay, Match contract, or V2
  production state implementation has started yet.

The history is intentionally not rewritten. Baseline `32861501...` failed P01 because of event-ID
integrity. R1 `6984260...` repaired those IDs but still failed P01 because annual grants were
persisted at weeks 41/81/121. R2 corrected the grant weeks to 40/80/120 and added the corresponding
state/save validation.

The repository now uses a personal-project workflow: feature branch, CI, independent audit for key
stages, owner confirmation, then merge. Branch protection, a second account, and a formal GitHub
approval record are not hard Gates. Implementation self-tests still cannot be presented as
independent review.

## Current phase

`P02-000` is complete. The approved baseline defines the weekly team-plan plus match-slot loop,
the P02 player model, Model B, three classified match types, atomic week settlement, and deferred
systems.

Implementation proceeds one dependency-cleared GitHub Issue and one PR at a time. P01-M1 and
P02-001 are complete; P02-002 must start only after the 12-player v1.2 baseline amendment is on
`main`. P02-008 remains split into an explicit V2 functional closure (`008A`) and a separate
default-entry cutover (`008B`).

Legacy P01 still contains its frozen 22-player regression fixture and historical save/evidence
hashes. That value is not the current product rule and must not be carried into P02; P02 uses a
12-player first-year fixed fixture and registers the whole team for formal/friendly matches.

See [Project ledger](./docs/PROJECT_LEDGER.md),
[approved P02 gameplay baseline](./docs/P02_GAMEPLAY_BASELINE.md), and
[P02 development plan](./docs/P02_DEVELOPMENT_PLAN.md).

## Requirements

- Node.js `24.14.x`
- pnpm `11.7.0`

## One-command verification

```bash
pnpm install --frozen-lockfile
pnpm check
```

Inside ChatGPT Work, use a temporary local pnpm store because the runtime home is read-only:

```bash
pnpm install --frozen-lockfile --store-dir /tmp/sunny-court-pnpm-store
pnpm check
```

## Run the Web shell

```bash
pnpm dev:web
```

The Web app is only a P00 engineering shell. It is not the P04 interaction prototype.

## Playable Site release policy

The current public Site is the separate T00 visual reference:
https://sunny-court-t00.yuuuu-g.chatgpt.site

It is not a playable build and is not expected to mirror P00-P03 headless or engineering-only
commits. P04 owns the first playable Web loop. Once that P04 candidate is accepted and merged, the
same `main` revision must be deployed and verified on the Site before the playable milestone is
called complete.

From P04 onward, any `main` change to the playable Web path, player-visible rules/content, or
release assets must publish the same revision. The Site must show its phase and source commit;
documentation, evidence, CI-only, and headless-only changes do not require a new deployment.

## Run one three-year simulation

```bash
pnpm sim:three-years -- --seed demo-001
```

## Run a batch

```bash
pnpm sim:batch -- --runs 1000 --seed-prefix gate-p01
```

## Repository layout

```text
apps/
  web/                         P00 React/Vite shell
  sim-cli/                     P01 Node headless runner
packages/
  domain/                      Pure rules and simulation
  application/                 Atomic command bus
  persistence/                 Save contracts and memory adapter
  persistence-node/            File save adapter
  persistence-indexeddb/       Browser IndexedDB adapter
  content-schema/              P00 content Schema spike
  ui-tokens/                   Frozen T00 visual tokens only
docs/
  EXECUTION_PLAN_P00_P01.md
  PROJECT_LEDGER.md
  P01_P02_GAMEPLAY_BASELINE_BRIEF.md
  P02_GAMEPLAY_BASELINE.md
  P02_DEVELOPMENT_PLAN.md
  adr/
evidence/
  P00/
  P01/
  P01-M1/
```

See [ARCHITECTURE.md](./ARCHITECTURE.md) and [SCOPE_LEDGER.md](./SCOPE_LEDGER.md) before changing package boundaries or phase scope.
