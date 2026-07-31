# P00/P01 Execution Plan

> Status date: 2026-07-31
> Authority: development plan v0.6 plus `VISUAL-BASELINE-V2`
> Objective: establish the formal engineering baseline, then prove a no-UI/no-API three-school-year rules skeleton.

The combined baseline `32861501...` was independently rated P00 `CONDITIONAL` and P01 `FAIL`.
R1 is a remediation candidate only. It does not rewrite that Gate history or authorize P02.

## Execution strategy

P00 and P01 remain separate Gates even when implemented in one continuous Work session:

1. Implement and verify P00 on `phase/p00-baseline`.
2. Independently review the P00 evidence before promoting it to `main`.
3. Start P01 from the approved P00 baseline on `phase/p01-domain-save`.
4. Independently review P01 before promotion.

No P01 result retroactively excuses a P00 failure.

## P00 task packages

| Task                  | Scope                                                                          | Deliverables                                          | Automated acceptance                                            | Exit state                    |
| --------------------- | ------------------------------------------------------------------------------ | ----------------------------------------------------- | --------------------------------------------------------------- | ----------------------------- |
| P00-001 Repository    | New formal repository, workspace layout, phase/task naming                     | root config, `apps/`, `packages/`, Git templates      | workspace discovery and clean install                           | repository skeleton usable    |
| P00-002 Toolchain     | Node/pnpm/TS pins, strict TS, format/lint/test/build                           | lockfile, tsconfig, ESLint, Prettier, Vitest, scripts | deliberate TS/lint errors would fail; clean tree passes         | one-command local check       |
| P00-003 CI/boundaries | CI job, cache, graph-cycle and forbidden-dependency checks, model-key scan     | workflow and boundary script                          | `domain` cannot import UI/DOM/Node/persistence/model packages   | CI-equivalent local pass      |
| P00-004 Governance    | architecture, scope ledger, contribution, ADR, task/PR/Gate/evidence templates | Markdown baselines and templates                      | required-file validation                                        | auditable workflow            |
| P00-005 Schema spike  | content manifest and unique-character definition Schema                        | package and tests                                     | valid fixture accepted; missing approval/duplicate IDs rejected | content boundary demonstrated |

### P00 Gate

P00 passes only when:

- `pnpm install --frozen-lockfile` and `pnpm check` pass in a clean environment.
- There are no package cycles.
- `domain` has no forbidden outward dependency.
- production sources have no model SDK or API-key contract.
- scope ledger covers all frozen and deferred items.
- Web and sim CLI shells start from the README commands.
- CI records OS, CPU architecture, Node, and pnpm versions.
- remote `main` protection is enabled before final Gate promotion.

P00 does **not** require production UI, gameplay balance, formal characters, or any LLM code.

## P01 task packages

| Task                         | Scope                                                                         | Deliverables                         | Automated acceptance                                      | Exit state                 |
| ---------------------------- | ----------------------------------------------------------------------------- | ------------------------------------ | --------------------------------------------------------- | -------------------------- |
| P01-001 Entities/invariants  | School, Team, Player, Season, Week, budget, reputation, archives, results     | schemas, state factory, reason codes | schema and cross-entity invariant tests                   | serializable minimal state |
| P01-002 Time/lifecycle       | 2 terms × 20 weeks × 3 years, training/exam phases, grade advance, graduation | time FSM and lifecycle events        | exactly 120/96 weeks; grade and archive invariants        | three-year time closes     |
| P01-003 Determinism          | root seed, isolated streams, call counters, stable state hash                 | RNG service and replay tests         | same seed/commands = same hash; cosmetic stream isolation | deterministic rules        |
| P01-004 Command transactions | typed command envelope, expected revision, cloned transaction, audit          | application session                  | failure leaves state/RNG/log/revision unchanged           | atomic rules boundary      |
| P01-005 Persistence          | versioned envelope, checksum, backup, memory/file/IndexedDB adapters          | save package and fixtures            | round-trip, corruption rejection, backup recovery         | recoverable save baseline  |
| P01-006 Model A/CLI          | prototype training, growth, budget, match A, single and batch runners         | CLI and reports                      | stats invariants; readable summary; 1,000 runs complete   | headless proof             |

### P01 Gate metrics

| Metric                                 |                        Required |
| -------------------------------------- | ------------------------------: |
| Three-year batch completion            |                   1,000 / 1,000 |
| Illegal terminal states                |                               0 |
| Calendar weeks per run                 |                             120 |
| Operation weeks per run                |                              96 |
| Same-seed replay hash mismatch         |                               0 |
| Failed-command state/RNG contamination |                               0 |
| Duplicate domain event IDs             |                               0 |
| Event ID revision/week/type mismatch   |                               0 |
| Ambiguous IDs after save/restore       |                               0 |
| Save round-trip mismatch               |                               0 |
| Recoverable previous-good backup       | at least 1 per overwritten slot |
| DOM/React dependency in domain         |                               0 |

P01 Gate explicitly does not judge fun, final balance, official characters, real tournament formats, or UI.

## Evidence and review

Implementation produces evidence under `evidence/P00` and `evidence/P01`. The implementation report records commands and outputs but may not self-approve the Gate. Final promotion requires an independent reviewer to:

1. verify Git identity, branch, commit, upstream, and cleanliness;
2. run the documented clean install/check commands;
3. inspect boundaries and scope exclusions;
4. verify evidence hashes and save/replay fixtures;
5. issue `PASS`, `CONDITIONAL`, or `FAIL` plus `P01 YES/NO` or next-phase decision.

## Rollback

- If pnpm workspace complexity blocks P00, retain the package directories and fall back to one repository with root scripts.
- If full event sourcing blocks P01, retain Snapshot plus a bounded accepted-command tail.
- If model A causes unrelated system work to stall, replace it with a deterministic fixed-result adapter while keeping its result Schema.
- A rollback must preserve save versioning, state validation, RNG streams, and the command boundary.
