# Project Ledger

> Updated: 2026-08-01

## Current stage

| Item                         | Status                                                |
| ---------------------------- | ----------------------------------------------------- |
| P00                          | Complete                                              |
| P01                          | Complete                                              |
| P02-000                      | Complete; gameplay baseline Owner-approved 2026-08-01 |
| P02 development plan         | v1.1 Owner-approved 2026-08-01                        |
| P01-M1                       | Implementation candidate; independent Gate pending    |
| P02 implementation           | Not started                                           |
| Approved docs merge on main  | `af5dcd1239a85f601c911629d7a12c9f4cdb170b`            |
| Frozen P00/P01 code baseline | `6547fbf51b2a440fd9602eed82c869d70b1181e1`            |
| Accepted R2 candidate        | `f008514ef4b6c0f0af78bdf8a5a2dff86aaa2750`            |
| Engine version               | `0.1.2-p01-r2`                                        |
| Current decision             | Review P01-M1 candidate through independent Gate M1   |
| Current implementation Issue | GitHub #6 (`P01-M1 annual-grant integrity hardening`) |

## Frozen baseline

- Pure deterministic domain with isolated RNG streams.
- Atomic command and revision boundary.
- Versioned, checksummed, recoverable saves.
- Three school years: 120 calendar weeks and 96 operation weeks.
- Event IDs encode committed revision, actual week, command-local sequence, and event type.
- Annual grants are recorded at weeks 40/80/120.
- Future or misaligned persisted budget/match weeks are rejected.
- P01-R2 frozen install, 25/25 tests, Web/CLI smoke, deterministic replay, and 1,000-run evidence
  passed.

These engineering guarantees are not reopened by gameplay design.

## Historical decisions

- `32861501...`: P01 failed because event IDs were ambiguous and off by one.
- R1 `6984260...`: event IDs were fixed, but P01 still failed because annual grants appeared at
  weeks 41/81/121.
- R2 `f008514...`: corrected year-end time integrity and was accepted before merge through PR #1.
- Earlier P00 `CONDITIONAL` decisions remain historical. The owner later removed branch protection,
  a second account, and a formal GitHub approval record as hard Gates for this personal project.

## Open risks

- The crafted annual-grant save risk has an implementation candidate and implementation evidence,
  but it remains open until independent Gate M1 passes and the Owner confirms the merge.
- The independent R2 decision has no standalone report or GitHub Review record in the repository.
  Do not invent either.
- P01 gameplay values and model A are engineering fixtures, not fun or balance evidence.

## Approved P02-000 decision

The Owner-approved `docs/P02_GAMEPLAY_BASELINE.md` v1.1 is the gameplay authority:

- one team plan and one match slot coexist in every operation week;
- exam/wrap weeks have no player activity;
- P02 uses ten abilities, fatigue, and individual chemistry aggregated from the current lineup;
- official, friendly, and scrimmage records are isolated;
- Model B is an incremental quarter/possession-chain session with keyed local randomness;
- full-coach substitutions are manual, instant simulation uses a deterministic assistant policy;
- cards, production match UI, recruitment, full competitions, deeper content, LLM, and Agent work
  remain in later phases.

The separate `docs/P02_DEVELOPMENT_PLAN.md` v1.1 is also Owner-approved. It defines architecture,
migration, test, Issue/PR, Gate, and rollback details without changing the gameplay authority.

## Next executable task

1. Publish the stable P01-M1 candidate PR from `fix/p01-m1-annual-grant-integrity`.
2. Create and run independent Gate M1 against that exact candidate SHA.
3. After `PASS` and Owner confirmation, merge its PR.
4. Only then create P02-001 from the resulting `main` SHA.

No P02 gameplay code, public match contract, V2 Schema, or balancing fixture is authorized before
P01-M1 passes its Gate and merges. Downstream Issues are created progressively, not as prebuilt
empty shells.
