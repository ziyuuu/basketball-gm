# P02-003 Single-match Energy Contract Amendment Record

- Owner decision date: 2026-08-06
- Authority:
  `docs/design/P02-003/P02_SINGLE_MATCH_ENERGY_AND_FORCED_MISMATCH_AMENDMENT.md`
- Authority SHA-256: `4cea0864bb3211a767df350c1c3ba9bcf833b83683ab410608627b8b3501d41c`
- Baseline update: `docs/P02_GAMEPLAY_BASELINE.md` v1.3
- Baseline SHA-256: `0b42e8002a6d6c3359128d29ce0fc78f322a8b0f71221882b1e4feeb9f79da23`
- Development-plan update: `docs/P02_DEVELOPMENT_PLAN.md` v1.3
- Development-plan SHA-256: `ff4f6177476968277e17c26f906f2a6490d6be3d383d4596ae67ca03dada1244`
- Draft PR: #15

## Prior B7 delivery closure

The manifest-only Candidate `bf03e21584bbc9941fdf5cb6b1d2448bcd9ab4ba` was independently
rechecked before this amendment:

- `evidence/P02/manifest.sha256`: 35/35 verified;
- GitHub CI run #103: completed / success;
- PR #15: open, Draft, unmerged, mergeable;
- branch lineage: ordinary non-force successor of `3e8b940…`.

This closes the prior B7 evidence-manifest delivery blocker. It does not implement the later
2026-08-06 Owner product amendment and does not pass Gate B.

## Contract changes

- Every Model B match starts all players at 100 energy, independent of pre-match training state.
- Existing Anchor fatigue storage becomes match-consumption bookkeeping; visible energy is derived
  as `100000 - consumedMilli`.
- Time base consumption and actual-participant behavior consumption are separate; pace cannot
  multiply time base consumption.
- Stamina only slows consumption. Recovery is independent from stamina.
- Remaining energy uses fixed 5-point ability penalties per 10-energy band below 80, capped at 30.
- Strength is penalized; stamina and immutable height/wingspan are not.
- Bench, period, halftime, overtime and timeout recovery boundaries are explicit.
- Normal lineup and rotation use primary positions only. Off-position assignment is allowed only
  as a deterministic forced fallback when no primary-position player is available.
- Legacy `secondaryPosition` remains protocol-only compatibility data and has no product effect.

## Replaced Gate inputs

- Removed: pre-match fatigue 10 vs 80.
- Added: all players start at 100; high-stamina vs low-stamina endurance comparison.
- Removed: player-created five-player mismatch.
- Added: deterministic contract tests for legal primary-position fill, forced mismatch only when no
  primary candidate exists, one uniform penalty, reason recording and return to normal rotation.

## Scope and blocking state

This change is documentation, planning and evidence only. It does not modify the accepted B7 runner
semantics, clock, behavior results, Event/Fact, keyed RNG or replay identity.

P02-003 may continue only with the targeted energy/forced-mismatch implementation remediation.
B8 calibration, Gate B, PR Ready, merge and P02-004 remain blocked until that remediation passes
focused tests, full `pnpm check` and independent review.

## Documentation-successor verification

Executed after the authority, plan and evidence edits:

- `git diff --check`: pass;
- `pnpm format:check`: pass;
- P02 evidence manifest: 36/36;
- `pnpm check`: pass;
  - Prettier: pass;
  - ESLint: pass;
  - TypeScript: pass;
  - boundary check: 9 packages/apps, no cycles, domain isolated, Legacy/V2 boundaries enforced;
  - Vitest: 23 files / 255 tests pass;
  - Web build: pass;
  - CLI build: pass.

These results verify the documentation/evidence successor only. They do not claim that the new
energy or forced-mismatch runtime behavior has already been implemented.

## 2026-08-06 定点实现修复 Implementation Record

**Status**: IMPLEMENTED / SELF-VERIFIED
**Candidate**: 228ff420ee2bb3bf1a9dbbe54d9850cba10ca416
**Tree**: 034c99ceb57492aa14f08fc16fb9eb7dd2bcbd34
**Parent**: 4d35aea735348833d314cd63d73b4bd0b0f2baff
**Original implementation**: acf9bbb58d6177a561d3a790bcbe530bcf06975f
**Branch**: `task/p02-003-headless-model-b`
**Version**: v2.10-energy-r3

### What was implemented

1. Energy initialization: all players start at 0 consumed (fatigueMilliByPlayer = 0)
2. pre-match fatigueMilli is compat-only; {0,10000,80000,100000} all yield genesis 0
3. Energy consumption: base (seconds × 100 per stamina factor) + behavior (intensity × duration × stamina factor)
4. Energy tier penalty: 7 bands (0/30/40/50/60/70/80 remaining → 0/-5/-10/-15/-20/-25/-30 penalty)
5. 10 abilities penalized (finishing through strength); stamina/height/wingspan exempt
6. Per-ability blend penalty: height/wingspan terms survive in blended execution
7. Stamina reduces both base and behavior cost; strength reduces neither
8. Bench recovery: 50 milli/s; quarter break: 5k; halftime: 20k; timeout: 0
9. Primary-position-only; forced mismatch unified -8k penalty
10. secondaryPosition is compat-only, no product semantics
11. 44-behavior energy intensity registry (LIGHT/MODERATE/HEAVY)
12. Version: v2.10-energy-r1 (distinct from v2.9-r1-final)
13. Legacy rules/content hash preserved
14. step/runToEnd/replay identity preserved for non-B7 paths

### [CALIBRATE] Initial Parameters

| Parameter                                  | Value  |
| ------------------------------------------ | ------ |
| energyBaseCostPerSecondMilli               | 100    |
| staminaEnergyReductionMilliPerPoint        | 3      |
| energyIntensityCostMilli LIGHT             | 200    |
| energyIntensityCostMilli MODERATE          | 400    |
| energyIntensityCostMilli HEAVY             | 800    |
| benchRecoveryPerSecondMilli                | 50     |
| quarterBreakRecoveryMilli                  | 5_000  |
| halftimeRecoveryMilli                      | 20_000 |
| overtimeBreakRecoveryMilli                 | 5_000  |
| timeoutRecoveryMilli                       | 0      |
| neutralRotationEnergyThresholdMilli        | 60_000 |
| neutralRotationMinimumEnergyAdvantageMilli | 10_000 |
| forcedMismatchPenaltyMilli                 | -8_000 |

### Test Coverage

- Energy initialization (4 pre-match fatigue inputs) ✓
- Energy tier penalty exact boundaries (80→0 through 0→−30) ✓
- Attribute exemptions (stamina/height/wingspan not penalized) ✓
- Per-ability blend penalty (height/wingspan terms preserved) ✓
- Base cost time-only (no match-kind/pace/defense multiplier) ✓
- High stamina consumes less ✓
- Behavior intensity tiers (all 44 behaviors declared) ✓
- Bench/halftime/OT/timeout recovery ✓
- Forced mismatch (unified penalty, secondaryPosition ignored) ✓
- Energy + forced mismatch additive ✓
- Effective ability floor at 0 ✓
- 44 Behavior / 16 EventType / 16 drawKind integrity ✓
- Legacy hash preserved ✓
- New rules/content hash distinct from legacy ✓
