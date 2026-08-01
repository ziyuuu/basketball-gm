# Project Ledger

> Updated: 2026-08-01

## Current stage

| Item                         | Status                                                |
| ---------------------------- | ----------------------------------------------------- |
| P00                          | Complete                                              |
| P01                          | Complete                                              |
| P02-000                      | Complete; gameplay baseline Owner-approved 2026-08-01 |
| P02 development plan         | v1.1 Owner-approved 2026-08-01                        |
| P01-M1                       | Merged through PR #7; Gate #8 passed                  |
| P02-001                      | IMPLEMENTING: ADRs and Legacy/V2 scaffold only        |
| P02 gameplay implementation  | Not started                                           |
| Current main                 | `5f3ed1cdd4a816e0c482f5161e86706eda1f4c60`            |
| Frozen P00/P01 code baseline | `6547fbf51b2a440fd9602eed82c869d70b1181e1`            |
| Accepted R2 candidate        | `f008514ef4b6c0f0af78bdf8a5a2dff86aaa2750`            |
| Engine version               | `0.1.2-p01-r2`                                        |
| Current decision             | Execute P02-001 without starting P02 gameplay         |
| Current implementation Issue | GitHub #9 (`P02-001 architecture scaffold`)           |

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

- P01-M1 closed the crafted annual-grant save integrity gap without changing legal P01 outputs;
  its 17 re-signed attacks and 8 legal boundaries remain required Legacy regressions.
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

1. Complete P02-001 on `task/p02-001-architecture-scaffold` from
   `main@5f3ed1cdd4a816e0c482f5161e86706eda1f4c60`.
2. Form a stable candidate, pass CI, and obtain an independent read-only audit for that exact SHA.
3. Await Owner confirmation before merge.
4. Do not create or start P02-002 before P02-001 merges.

No P02 gameplay code, public match contract, V2 Schema, or balancing fixture is authorized before
P01-M1 passes its Gate and merges. Downstream Issues are created progressively, not as prebuilt
empty shells.
