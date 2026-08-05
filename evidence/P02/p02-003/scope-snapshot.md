# P02-003 B7 Second-round Scope Snapshot

## Authority

| Material                                                      | SHA-256                                                            | Role                                                  |
| ------------------------------------------------------------- | ------------------------------------------------------------------ | ----------------------------------------------------- |
| `P02-003_v2.9-R2_Sixth_Owner_Reaudit_Corrected_2026-08-05.md` | `e6deb02b55ca8dff23687fe56800f1a02bebc16366d265de1eaea2d375b81e97` | Owner explanatory rulings and corrected review status |
| `P02-003_v2.9-r2-proposed_full_revision_v6.md`                | `29e045ded4e83372d1392946c6e7491665cbddf54e7fa5bd1d89a740bb3bfa68` | Frozen observable product contract                    |
| `P02-003_v2.9-r2-proposed_package_v6.zip`                     | `2a3ff4e0f465a68faeb7b1650d26ee40bbbafe45fc7af373176f4dfcb8b43e2c` | Pseudocode, vectors, matrices and machine assets      |

The rejected B7 Candidate is `b228ab9c1e46127ba663a01096fc8f365d5cf1f9`, tree
`18fd9f0818b6965d64a92c2fa08a8d432aae2e4b`. It is not restored by the frozen design revision.

## Included

- Model B runner, timing, tail ordering, transition and replay execution.
- Existing Event/Fact/Anchor/session materialization necessary to make the runner's causal output
  authoritative.
- B7 tests, behavior causality matrix and P02-003 evidence.

## Excluded

- B8 calibration, 10,000-match performance work, balance/realism conclusions and fixed-seed B8
  statistics.
- B9, Gate B, PR Ready, merge, P02-004, UI/Site/deploy, saves, security/anti-tamper work and
  unrelated architecture changes.

Status remains: B1R–B6R REMAIN ACCEPTED; B7 REQUEST CHANGES until independent re-review; B8 /
Gate B / PR Ready / merge / P02-004 BLOCKED.
