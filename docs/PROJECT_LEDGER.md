# Project Ledger

> Updated: 2026-07-31

## Current stage

| Item                  | Status                                     |
| --------------------- | ------------------------------------------ |
| P00                   | Complete                                   |
| P01                   | Complete                                   |
| P02                   | Ready; gameplay design not started         |
| Current main          | `6547fbf51b2a440fd9602eed82c869d70b1181e1` |
| Accepted R2 candidate | `f008514ef4b6c0f0af78bdf8a5a2dff86aaa2750` |
| Engine version        | `0.1.2-p01-r2`                             |
| Next task             | `P02-000 P01/P02 gameplay design baseline` |

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

- A crafted save may delete an annual-grant record or change grant amount/balance fields and pass
  after recomputing hashes because the Schema does not yet require one canonical grant per settled
  school year or validate its amount against `budget.annualGrant`. This is non-blocking for
  gameplay design and must remain tracked.
- The independent R2 decision has no standalone report or GitHub Review record in the repository.
  Do not invent either.
- P01 gameplay values and model A are engineering fixtures, not fun or balance evidence.

## Current decision

The next stage combines the gameplay content already sketched for engineering purposes in P01 with
the match gameplay required by P02. The result is one coherent MVP rules slice, not a research
program comparing three match models.

- Design the P01/P02 gameplay baseline before implementing new rules.
- Use one simplified quarter/possession-chain match model after the design is approved.
- Keep model A only as an engineering regression reference.
- Remove model C from the MVP implementation path.
- Use a small set of deterministic gameplay scenarios instead of a large A/B/C experiment.
- Keep recruitment generation and roster sustainability in P03.

## Next executable task

`P02-000` is design-only. Its authority and required output are defined in
`P01_P02_GAMEPLAY_BASELINE_BRIEF.md`. No gameplay code, public match contract, or balancing fixture
should be frozen before the owner approves that baseline.
