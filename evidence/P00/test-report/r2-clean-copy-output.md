# P00 R2 Clean-Copy Command Output

Environment:

```text
Linux 6.12.13 x86_64
Node v24.14.0
pnpm 11.7.0
```

The candidate working tree was copied without `.git`, `node_modules`, build output, or local
artifacts. Installation used a newly created empty store.

## Frozen install

```text
Scope: all 10 workspace projects
Lockfile is up to date, resolution step is skipped
Packages: +180
Progress: resolved 180, reused 0, downloaded 180, added 180, done
Lockfile passes supply-chain policies (285 entries)
Done in 3.9s using pnpm v11.7.0
```

## Full check

```text
Prettier: PASS
ESLint: PASS
TypeScript: PASS
Boundary check: PASS; 9 packages/apps, no cycles, domain isolated, model/key scan clean
Vitest: PASS; 8 files, 25 tests, 12.20s
Web build: PASS; 17 modules, 226ms
sim-cli ESM build: PASS; 590.95 KB, 82ms
```

## Web smoke

```text
VITE v8.1.5 ready in 148 ms
GET http://127.0.0.1:4173/
HTTP 200
```

The development server was then terminated intentionally.

## CLI and deterministic replay smoke

Two direct runs of seed `r2-clean-gate` both produced:

```text
status: THREE_YEAR_COMPLETE
calendar/operation/exam weeks: 120/96/24
matches: 24
active/archived players: 0/22
state hash: fnv64:8cbf99e1aa4068d4
replay hash: fnv64:62713a07383cbf50
annual grant weeks: 40/80/120
maximum persisted ledger week: 120
```

The explicit 1,000-run command completed 1,000/1,000 runs with zero failures, replay mismatches,
calendar violations, operation-week violations, or illegal terminal states.

This is implementation-thread evidence and is not an independent Gate approval.
