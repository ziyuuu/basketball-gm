# P00/P01 Execution Plan

> Status date: 2026-07-31
> Authority: development plan v0.6 plus `VISUAL-BASELINE-V2`
> Objective: establish the formal engineering baseline, then prove a no-UI/no-API three-school-year rules skeleton.

P00/P01 are complete at `main@6547fbf51b2a440fd9602eed82c869d70b1181e1`. The accepted R2
candidate is `f008514ef4b6c0f0af78bdf8a5a2dff86aaa2750`, with engine version
`0.1.2-p01-r2`.

The failed history remains binding. Combined baseline `32861501...` received P00 `CONDITIONAL` and
P01 `FAIL` for event-ID integrity. R1 `6984260...` fixed the event IDs, but P01 still failed because
annual grants were persisted at weeks 41/81/121. R2 corrected that defect, passed the independent
technical review used by this personal project, and was merged through PR #1. No GitHub Review
record is invented by this update.

## Execution strategy

P00 and P01 remained separate technical Gates even when implemented in one continuous Work
session:

1. Implement and verify P00 on `phase/p00-baseline`.
2. Independently review the P00 evidence before promoting it to `main`.
3. Start P01 from the approved P00 baseline on `phase/p01-domain-save`.
4. Independently review P01 before promotion.

No P01 result retroactively excuses a P00 failure.

The repository owner subsequently adopted a lighter personal-project governance flow:

1. develop on a scoped task/fix branch;
2. require CI and relevant checks to pass;
3. use an independent audit for key phase or high-risk changes;
4. obtain owner confirmation;
5. merge to `main`.

Branch protection, a second GitHub account, and a formal approval record are no longer hard Gates.
This governance decision removes those items as current blockers; it does not rewrite the earlier
P00 `CONDITIONAL` decisions as historical `PASS` records.

## P00 task packages

| Task                  | Scope                                                                          | Deliverables                                          | Automated acceptance                                            | Exit state                    |
| --------------------- | ------------------------------------------------------------------------------ | ----------------------------------------------------- | --------------------------------------------------------------- | ----------------------------- |
| P00-001 Repository    | New formal repository, workspace layout, phase/task naming                     | root config, `apps/`, `packages/`, Git templates      | workspace discovery and clean install                           | repository skeleton usable    |
| P00-002 Toolchain     | Node/pnpm/TS pins, strict TS, format/lint/test/build                           | lockfile, tsconfig, ESLint, Prettier, Vitest, scripts | deliberate TS/lint errors would fail; clean tree passes         | one-command local check       |
| P00-003 CI/boundaries | CI job, cache, graph-cycle and forbidden-dependency checks, model-key scan     | workflow and boundary script                          | `domain` cannot import UI/DOM/Node/persistence/model packages   | CI-equivalent local pass      |
| P00-004 Governance    | architecture, scope ledger, contribution, ADR, task/PR/Gate/evidence templates | Markdown baselines and templates                      | required-file validation                                        | auditable workflow            |
| P00-005 Schema spike  | content manifest and unique-character definition Schema                        | package and tests                                     | valid fixture accepted; missing approval/duplicate IDs rejected | content boundary demonstrated |

### P00 original Gate

The original P00 plan required:

- `pnpm install --frozen-lockfile` and `pnpm check` pass in a clean environment.
- There are no package cycles.
- `domain` has no forbidden outward dependency.
- production sources have no model SDK or API-key contract.
- scope ledger covers all frozen and deferred items.
- Web and sim CLI shells start from the README commands.
- CI records OS, CPU architecture, Node, and pnpm versions.
- remote `main` protection is enabled before final Gate promotion.

The technical requirements were reproduced successfully for R2. The final branch-protection item
was retired as a hard Gate by the later owner governance decision described above.

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
| Annual-grant absolute weeks            |                       40/80/120 |
| Persisted entries after resolved week  |                               0 |
| Checksummed 41/81/121 save accepted    |                               0 |
| Save round-trip mismatch               |                               0 |
| Recoverable previous-good backup       | at least 1 per overwritten slot |
| DOM/React dependency in domain         |                               0 |

P01 Gate explicitly does not judge fun, final balance, official characters, real tournament formats, or UI.

### P01 outcome

R2 satisfied the P01 technical metrics and was independently reproduced before merge. The
prototype gameplay values used to prove the state machine remain disposable and are explicitly
reopened for the current P01/P02 gameplay design baseline. P01's command, determinism, persistence,
time, audit, and state-integrity guarantees are not reopened.

## Evidence and review

Implementation produces evidence under `evidence/P00` and `evidence/P01`. The implementation report records commands and outputs but may not self-approve the Gate. Final promotion requires an independent reviewer to:

1. verify Git identity, branch, commit, upstream, and cleanliness;
2. run the documented clean install/check commands;
3. inspect boundaries and scope exclusions;
4. verify evidence hashes and save/replay fixtures;
5. issue `PASS`, `CONDITIONAL`, or `FAIL` plus `P01 YES/NO` or next-phase decision.

For the current personal-project flow, that independent decision may exist outside GitHub Review
metadata. The repository must say so explicitly and must never fabricate a review, approval, or
second identity. Key phase promotion still requires independent evidence plus owner confirmation.

## Next phase

P02 is authorized to begin with `P02-000`, a design-only P01/P02 gameplay baseline. It covers the
P01 management placeholders and P02 match gameplay as one MVP rules slice. Parallel A/B/C research
is removed from the MVP path; model B is implemented only after the baseline is approved, model A
stays as a regression reference, and model C is deferred.

See `PROJECT_LEDGER.md` and `P01_P02_GAMEPLAY_BASELINE_BRIEF.md`.

## Rollback

- If pnpm workspace complexity blocks P00, retain the package directories and fall back to one repository with root scripts.
- If full event sourcing blocks P01, retain Snapshot plus a bounded accepted-command tail.
- If model A causes unrelated system work to stall, replace it with a deterministic fixed-result adapter while keeping its result Schema.
- A rollback must preserve save versioning, state validation, RNG streams, and the command boundary.
