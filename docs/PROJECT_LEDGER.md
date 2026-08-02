# Project Ledger

> Updated: 2026-08-02

## Current stage

| Item                         | Status                                                    |
| ---------------------------- | --------------------------------------------------------- |
| P00                          | Complete                                                  |
| P01                          | Complete                                                  |
| P02-000                      | Complete; v1.2 roster amendment Owner-approved 2026-08-02 |
| P02 development plan         | v1.2 Owner-approved 2026-08-02                            |
| P01-M1                       | Merged through PR #7; Gate #8 passed                      |
| P02-001                      | Merged through PR #10                                     |
| P02 gameplay implementation  | P02-002 contract-only work in progress; no resolver       |
| Current main                 | `99c5b56a570d8e02b79dc006230f25c57c823595`                |
| Frozen P00/P01 code baseline | `6547fbf51b2a440fd9602eed82c869d70b1181e1`                |
| Accepted R2 candidate        | `f008514ef4b6c0f0af78bdf8a5a2dff86aaa2750`                |
| Engine version               | `0.1.2-p01-r2`                                            |
| Current decision             | 12-player amendment; first playable Site at P04           |
| Current implementation Issue | GitHub #11 (`P02-002`, IN PROGRESS)                       |

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

The Owner-approved `docs/P02_GAMEPLAY_BASELINE.md` v1.2 is the gameplay authority:

- one team plan and one match slot coexist in every operation week;
- exam/wrap weeks have no player activity;
- P02 uses ten abilities, fatigue, and individual chemistry aggregated from the current lineup;
- P02 uses exactly 12 active players; the formal/friendly roster is the entire team, while lineup
  order, starters, duties, tactics, and rotation remain player decisions;
- official, friendly, and scrimmage records are isolated;
- Model B is an incremental quarter/possession-chain session with keyed local randomness;
- full-coach substitutions are manual, instant simulation uses a deterministic assistant policy;
- cards, production match UI, recruitment, full competitions, deeper content, LLM, and Agent work
  remain in later phases.

The separate `docs/P02_DEVELOPMENT_PLAN.md` v1.2 is also Owner-approved. It defines architecture,
migration, test, Issue/PR, Gate, and rollback details without changing the gameplay authority.

## Playable Site decision

- Owner decided on 2026-08-02 that no early P02/P03 Web debug-playable slice will be added.
- The existing public T00 Site remains a visual reference through P03, not a current playable build.
- P04 owns the first playable Web loop. Its accepted merged `main` revision must be deployed and
  verified on the Site before the playable milestone is complete.
- From P04 onward, every `main` merge affecting the playable Web path, player-visible
  rules/content, or release assets must deploy that same revision.
- Each deployed playable build records and displays its phase and source commit. A deployment
  mismatch is `RELEASE_BLOCKED / OUT_OF_SYNC`; pure docs/evidence/CI/headless-only changes are
  exempt from redeployment.

## Next executable task

1. Complete P02-002 from the amended `main` using the existing Issue/PR/Gate flow.
2. Keep P02-002 limited to headless contracts, identity, fixed-point, keyed RNG, and effect
   primitives; P02-003 remains unstarted.
3. Keep the first playable Web deployment assigned to P04 and preserve Legacy P01 output.

P02-002 is the first public Match-contract implementation, not a gameplay resolver or V2 state
cutover. Legacy P01 remains an unchanged 22-player regression fixture; P02 implementation uses
the 12-player rule. Downstream Issues are created progressively, not as prebuilt empty shells.
