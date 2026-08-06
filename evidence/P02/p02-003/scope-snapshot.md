# P02-003 B7 Closure and 2026-08-06 Contract-amendment Scope Snapshot

## Authority

| Material                                                                       | Identity                                                           | Role                                                   |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------ | ------------------------------------------------------ |
| `P02-003_v2.9-R2_Sixth_Owner_Reaudit_Corrected_2026-08-05.md`                  | `e6deb02b55ca8dff23687fe56800f1a02bebc16366d265de1eaea2d375b81e97` | B7 observable runner rulings                           |
| `P02-003_v2.9-r2-proposed_full_revision_v6.md`                                 | `29e045ded4e83372d1392946c6e7491665cbddf54e7fa5bd1d89a740bb3bfa68` | B7 frozen observable product contract                  |
| `docs/design/P02-003/P02_SINGLE_MATCH_ENERGY_AND_FORCED_MISMATCH_AMENDMENT.md` | `4cea0864bb3211a767df350c1c3ba9bcf833b83683ab410608627b8b3501d41c` | Later Owner-frozen energy and forced-mismatch override |

The rejected B7 Candidate `b228ab9c1e46127ba663a01096fc8f365d5cf1f9` remains rejected
history. The B7 delivery Candidate `bf03e21584bbc9941fdf5cb6b1d2448bcd9ab4ba` verified the P02
manifest 35/35 and passed CI #103.

## Included in the current docs/evidence successor

- Owner-frozen single-match energy and forced-mismatch amendment.
- P02 gameplay baseline v1.3 and development plan v1.3 authority routing.
- Removal of the pre-match fatigue 10 vs 80 and player-created five-player mismatch Gate inputs.
- Replacement endurance scenario and deterministic forced-mismatch contract acceptance.
- Evidence and project-ledger status synchronized to the real B7 Candidate/CI.

## Excluded

- Model B implementation of the new energy/forced-mismatch contract.
- B8 calibration, 10,000-match performance work and fixed-seed B8 statistics.
- Gate B, PR Ready, merge, P02-004, UI/Site/deploy, saves and unrelated architecture changes.

Status: B1R–B6R remain accepted for the contract reviewed at that time; B7 delivery is closed at
`bf03e215…`. The later amendment requires targeted implementation remediation before B8. B8 /
Gate B / PR Ready / merge / P02-004 remain blocked.

## 2026-08-06 定点实现修复 (v2.10-energy-r1)

**Candidate**: (to be filled after commit)
**Parent**: aca6307974492efaccd636880fceab16aa42d5c5
**Branch**: `task/p02-003-headless-model-b`
**PR**: #15 Draft

### Scope

- Single-match energy initialization (all at 0 consumed, pre-match fatigue ignored)
- Energy tier penalty table (7 bands, 10-of-11 abilities penalized)
- Base energy cost (time-only, no pace/defense/kind multiplier)
- Behavior-participant energy cost (44-behavior intensity registry)
- Bench / quarter-break / halftime / OT recovery
- Primary-position-only rotation; secondaryPosition compat-only
- Unified forced-mismatch penalty
- Version bump: p02-003-v2.10-energy-r1 / p02-003-model-b-v2.10-energy-r1
- All [CALIBRATE] values provided as initial runnable defaults

### Test Results

- B1 registries: 17/17 pass
- B2 session: 12/12 pass
- B3 clock rules: (unchanged) pass
- B4 behavior selection: (unchanged) pass
- B5 basketball results: (unchanged) pass
- B6 state rules: 7/7 pass
- B7 runner: 13/13 pass
- Energy/forced-mismatch focused: 63/63 pass
- Total: 149/149 pass
- sim:batch: 0 failures, 0 replay mismatches
- pnpm typecheck: pass, pnpm build: pass
- pnpm check: pass
- pnpm evidence:manifest: 36/36 verified
