# P02-003 B7 Closure, Energy Amendment and Gate-scope Correction Snapshot

## Authority

| Material                                                                       | Identity                                                           | Role                                                   |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------ | ------------------------------------------------------ |
| `P02-003_v2.9-R2_Sixth_Owner_Reaudit_Corrected_2026-08-05.md`                  | `e6deb02b55ca8dff23687fe56800f1a02bebc16366d265de1eaea2d375b81e97` | B7 observable runner rulings                           |
| `P02-003_v2.9-r2-proposed_full_revision_v6.md`                                 | `29e045ded4e83372d1392946c6e7491665cbddf54e7fa5bd1d89a740bb3bfa68` | B7 frozen observable product contract                  |
| `docs/design/P02-003/P02_SINGLE_MATCH_ENERGY_AND_FORCED_MISMATCH_AMENDMENT.md` | `4cea0864bb3211a767df350c1c3ba9bcf833b83683ab410608627b8b3501d41c` | Later Owner-frozen energy and forced-mismatch override |
| `docs/design/P02-003/P02_003_SCOPE_CORRECTION_AND_GATE_B_DOWNGRADE.md`         | repository file identity                                           | P02-003 acceptance granularity and blocker downgrade   |

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
`bf03e215…`. r4 and r5 remain rejected history. r6 exact SHA remains rejected because CI #129
failed; its actor/target, dual-reason and restoration-policy review findings are downgraded by the
2026-08-07 Owner decision. The correction successor must pass fresh CI before B8 resumes. Gate B,
PR Ready, merge and P02-004 remain blocked.

## 2026-08-07 Gate-scope correction

Included:

- Owner authority fixing P02-003 to observable headless-kernel acceptance;
- documentation/evidence synchronization and formatting repair;
- existing OFFICIAL/FRIENDLY/SCRIMMAGE termination and replay verification.
- full local verification: 24 files / 349 tests, Web/CLI builds, batch 1,000/1,000 and manifest
  36/36.

Explicitly not required for P02-003:

- unique basketball target selection for each non-selectable energy charge;
- dual trigger/assignment reason fields on substitution events;
- product-level restoration and assistant-rotation state machines.

P02-006 retains ownership of formal lineup, restoration and assistant rotation semantics.

## 2026-08-07 v2.10-energy-r6 (from r5 rejection)

**Parent**: `94ed9c584427f9ad85fd0a493a7f521299d0e094` (r5, REJECTED)
**Branch**: `task/p02-003-headless-model-b`
**PR**: #15 Draft

### r6 Scope

- Duration clamping (FT uses `freeThrows.attempted`; PASSTOV/BALLDESTROY/PUTBACK clamped to registry max)
- Target role completion (BOXOUT MODERATE target; ORB/DRB LIGHT targets)
- Forced semantics fix (`forced: true` for FORCED_MISMATCH_NO_PRIMARY; foul-out mismatch detection)
- Cross-boundary oscillation prevention (energy threshold guard using existing frozen parameter)
- Test improvements (101 tests: 94 energy + 7 B6)
- Evidence sync and manifest regeneration

## 2026-08-06 v2.10-energy-r5 (from r4 rejection, REJECTED)

**Parent**: `7d91a296f38ff68b70ada40298d88df68a88159f` (r4 Review Candidate, REJECTED)
**Branch**: `task/p02-003-headless-model-b`
**PR**: #15 Draft

### r5 Scope

- Non-selectable behavior energy wiring (FT, PASSTOV, BALLDESTROY, PUTBACK, BLK, FOUL, ORB, DRB, BOXOUT, BLKLOOSE — 10 behaviors)
- Forced mismatch reason code persistence in SUBSTITUTION event schema
- `canRestorePrimaryPosition()` energy gate removal (10,000 threshold removed)
- Restored-position guard preventing immediate ping-pong substitutions
- Real pipeline tests (84 energy/forced-mismatch tests, up from 72)
- 44-behavior matrix updated with runtime accounting paths for non-selectable behaviors
- Evidence files cleaned of stale r1-r4 placeholder content

## 2026-08-06 定点实现修复 (v2.10-energy-r4)

**Candidate**: 836d531e11f751faacc36d0cf40b55f11ed256bc
**Tree**: 037617061f3a4bbbc6d7ef8e822abc4c935aba2d
**Parent**: 904dc2e70b3c8cdf2d578e3cee3aa73a0cf33c6d
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
- Version bump: p02-003-v2.10-energy-r3 / p02-003-model-b-v2.10-energy-r3
- All [CALIBRATE] values provided as initial runnable defaults
- Cross-platform manifest hashing (CRLF→LF normalization, `/` paths)

### r3 Fixes (from r2 rejection)

1. **Prettier**: Reformatted `behavior-selection.ts` and `effective-values.ts` (CI #113 failure)
2. **Manifest**: `scripts/generate-evidence-manifest.mjs` normalizes line endings before hashing; uses `/` paths

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
- pnpm evidence:manifest: 36/36 verified
