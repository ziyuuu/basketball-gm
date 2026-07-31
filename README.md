# Sunny Court Manager

Formal engineering repository for a Web-first, single-player Chinese high-school girls' basketball management game.

The current implementation covers:

- **P00** — auditable monorepo baseline, strict TypeScript, package boundaries, CI, task/Gate templates, and a content-schema spike.
- **P01** — a headless three-school-year rules sandbox with deterministic RNG streams, atomic commands, versioned saves, prototype training/growth/graduation, match model A, and a CLI runner.

The T00 visual prototype is intentionally separate. This repository does not reuse its temporary page architecture or fake gameplay.

## Gate status

The combined baseline at `32861501...` received P00 `CONDITIONAL` and P01 `FAIL`. The current R1
remediation branch fixes the confirmed event-audit ID defect and refreshes reproducibility
evidence. It is still a candidate awaiting independent P00/P01 review; P02 is not authorized.

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
  adr/
evidence/
  P00/
  P01/
```

See [ARCHITECTURE.md](./ARCHITECTURE.md) and [SCOPE_LEDGER.md](./SCOPE_LEDGER.md) before changing package boundaries or phase scope.
