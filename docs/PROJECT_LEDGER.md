# Project Ledger

> Updated: 2026-08-06

## Current stage

| Item                         | Status                                                           |
| ---------------------------- | ---------------------------------------------------------------- |
| P00                          | Complete                                                         |
| P01                          | Complete                                                         |
| P02-000                      | Complete; v1.3 energy/position amendment Owner-frozen 2026-08-06 |
| P02 development plan         | v1.3 Owner-approved 2026-08-06                                   |
| P01-M1                       | Merged through PR #7; Gate #8 passed                             |
| P02-001                      | Merged through PR #10                                            |
| P02-002                      | Merged through PR #13                                            |
| P02-003 design               | v2.9 + R1/R2 rulings + 2026-08-06 energy amendment               |
| P02 gameplay implementation  | B7 delivery closed at `bf03e215…`; amendment remediation next    |
| Current main                 | `45dc1a261172ebfff46f30b122cbdf5621596959`                       |
| Frozen P00/P01 code baseline | `6547fbf51b2a440fd9602eed82c869d70b1181e1`                       |
| Accepted R2 candidate        | `f008514ef4b6c0f0af78bdf8a5a2dff86aaa2750`                       |
| Engine version               | `0.1.2-p01-r2`                                                   |
| Current decision             | Targeted energy/forced-mismatch remediation before B8            |
| Current implementation Issue | GitHub #14 (`P02-003`, IMPLEMENTING / OWNER_AUTHORIZED)          |

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

The Owner-approved `docs/P02_GAMEPLAY_BASELINE.md` v1.3 is the gameplay authority:

- one team plan and one match slot coexist in every operation week;
- exam/wrap weeks have no player activity;
- P02 uses eleven match abilities including strength, single-match energy, and individual chemistry aggregated from the current lineup;
- every match starts at 100 energy; time creates base consumption, actual participants create behavior consumption, and stamina only slows consumption;
- normal lineups use primary positions; deterministic forced mismatch is allowed only when no primary-position player is available;
- P02 uses exactly 12 active players; the formal/friendly roster is the entire team, while lineup
  order, starters, duties, tactics, and rotation remain player decisions;
- official, friendly, and scrimmage records are isolated;
- Model B is an incremental quarter/possession-chain session with keyed local randomness;
- full-coach substitutions are manual, instant simulation uses a deterministic assistant policy;
- cards, production match UI, recruitment, full competitions, deeper content, LLM, and Agent work
  remain in later phases.

The separate `docs/P02_DEVELOPMENT_PLAN.md` v1.3 is also Owner-approved. It defines architecture,
migration, test, Issue/PR, Gate, and rollback details without changing the gameplay authority.

## Approved P02-003 design authority

On 2026-08-03 the Owner approved P02-003 Headless Model B v2.9 FINAL for development after an
independent design audit scored it 95/100 and returned `READY FOR DEVELOPMENT`.

- Original archive SHA-256:
  `822eaef55db5118bc177c84d9fe5c4bbb7512b8ec01b641b6ad13c9940f15591`.
- Reviewable repository mirror and per-file manifest:
  `docs/design/P02-003/v2.9-final/`.
- Implementation entry: GitHub Issue #14 from
  `main@45dc1a261172ebfff46f30b122cbdf5621596959`.
- The design freezes 44 Behavior IDs as 34 selectable and 10 non-selectable, one PASS failure
  chain, BOXOUT as a rule result, the state/shot-clock/RNG semantic contracts, and the
  Event/Fact/Statistic causality without expanding P02-002 Schema enums.

The B7 runner/evidence delivery blocker closed at `bf03e215…` with manifest 35/35 and CI #103.
The 2026-08-06 energy/forced-mismatch amendment is later and not yet implemented. It does not pass
Gate B; P02-004 remains blocked until the targeted remediation, B8 and independent Gate B review.

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

1. Implement the frozen single-match energy and forced-mismatch amendment as an ordinary successor
   on Draft PR #15 without changing accepted runner/Event/Fact/RNG/replay semantics.
2. Pass focused amendment tests, full `pnpm check` and independent review; then resume B8 with the
   revised stamina-endurance scenario and forced-mismatch contract matrix.
3. Create the Gate B audit Issue only after B8 produces an exact candidate SHA and successful CI.
4. Keep P02-004 code blocked until Gate B and Owner merge confirmation; keep the first playable Web
   deployment assigned to P04.

P02-003 is the first gameplay resolver, but it remains headless and does not cut over V2 state,
persistence, the root entrypoint, or the public Site. Legacy P01 remains an unchanged 22-player
regression fixture; P02 uses the 12-player rule.
