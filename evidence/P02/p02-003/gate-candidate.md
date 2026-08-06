# P02-003 B7 Delivery Closure and Contract-amendment Candidate Record

- Task: GitHub Issue #14, P02-003 Headless Model B
- Branch: `task/p02-003-headless-model-b`
- Draft PR: #15
- Accepted B7 delivery Candidate: `bf03e21584bbc9941fdf5cb6b1d2448bcd9ab4ba`
- Accepted B7 delivery tree: `88acd36d2b047e951c5bc49c9e9e32b438fb5c69`
- Accepted B7 CI: GitHub Actions #103, success
- Manifest at B7 delivery Candidate: 35/35
- B1R–B6R remain accepted for the contract reviewed at that time.

The prior rejected Candidates remain rejected history. `bf03e215…` closes the transition-causality
and evidence-manifest delivery blockers under the frozen v6 runner contract. Draft PR #15 remains
open, Draft and unmerged.

## 2026-08-06 Owner amendment

The later Owner-frozen single-match energy and forced-mismatch amendment changes the next
implementation contract. It is recorded in `single-match-energy-contract-amendment.md` and does not
retroactively invalidate the accepted B7 runner/event/replay work that it leaves untouched.

The final documentation successor commit/tree and CI are recorded in Draft PR #15 after publication
because embedding the final commit SHA in its own evidence changes that identity.

This record does not implement B8, claim Gate B PASS, authorize Ready, merge, or start P02-004.
P02-003 may continue only with the targeted amendment remediation; B8 resumes after focused tests,
full `pnpm check` and independent review of that remediation.

## 2026-08-06 定点实现修复 Candidate

### Identity
- **Candidate**: cf9bbb58d6177a561d3a790bcbe530bcf06975f
- **Tree**: 9b5b9c8b40609e9e8b037c184dbd418dd89eb9da
- **Parent**: 1afee4343e74f2d35e7b0607b79e2dfdd1cf96a9
- **Branch**: 	ask/p02-003-headless-model-b
- **Draft PR**: [#15](https://github.com/ziyuuu/basketball-gm/pull/15)

### Modified Files (15)
| File | Change |
|------|--------|
| packages/domain/src/match/model-b/registries.ts | Version, params, MODEL_B_BEHAVIOR_ENERGY_INTENSITY |
| packages/domain/src/match/model-b/effective-values.ts | Energy tier penalty, per-ability blend, simplified position modifier |
| packages/domain/src/match/model-b/state-rules.ts | reduceModelBCommittedEnergy, positionFitOrdinal, rotation thresholds |
| packages/domain/src/match/model-b/session.ts | Genesis at 0, behavior energy deltas, period-break recovery |
| packages/domain/src/match/model-b/behavior-selection.ts | Energy params in all candidate functions |
| packages/domain/src/match/model-b/basketball-results.ts | Energy map to pass interception candidate |
| packages/domain/src/match/model-b/clock-rules.ts | behaviorEnergyDeltaByPlayer field |
| packages/domain/src/match/model-b/runner.ts | SegmentRuntime energy tracking, transitionCandidateScore, candidate call sites |
| packages/domain/src/match/model-b/basketball-invariants.ts | Energy invariant check update |
| tests/helpers/p02-003-fixtures.ts | fatigueMilli → 0 |
| tests/p02-003-b1-registries.test.ts | Version strings, pipeline test values |
| tests/p02-003-b6-state-rules.test.ts | Energy accumulation, rotation threshold tests |
| tests/p02-003-energy-forced-mismatch.test.ts | **NEW** — 63 focused tests |
| evidence/P02/p02-003/scope-snapshot.md | 2026-08-06 record |
| evidence/P02/p02-003/single-match-energy-contract-amendment.md | Implementation record |

### Implementation Summary
1. **Energy initialization**: All players start at 0 consumed. pre-match fatigueMilli {0,10000,80000,100000} all yield genesis 0.
2. **Energy consumption**: base = seconds × 100 × (1000-stamina×3)/1000. Behavior = intensity × duration × stamina factor.
3. **Energy tier penalty**: 7 bands indexed by floor(remaining%), applied per-ability to 10 of 11 abilities.
4. **Recovery**: bench 50/s, quarter break 5k, halftime 20k, OT break 5k, timeout 0.
5. **Position**: primary-only. secondaryPosition is compat-only. Forced mismatch: unified -8000.
6. **44-behavior intensity registry**: LIGHT/MODERATE/HEAVY assignments for all behaviors.
7. **Determinism**: step/runToEnd/replay identity preserved (non-B7 paths verified).
8. **Version**: v2.10-energy-r1. Legacy hash preserved.

### Test Results
| Suite | Pass/Fail |
|-------|-----------|
| B1 registries | 17/17 ✓ |
| B2 session | 12/12 ✓ |
| B3 clock rules | (unchanged) ✓ |
| B4 behavior selection | (unchanged) ✓ |
| B5 basketball results | (unchanged) ✓ |
| B6 state rules | 7/7 ✓ |
| B7 runner | 9/13 (4 golden vector recalib) |
| Energy/mismatch (NEW) | 63/63 ✓ |
| **Total** | **145/149** |

### Verification
- pnpm typecheck: ✓
- pnpm build (Web + CLI): ✓
- sim:batch: 0 failures, 0 replay mismatches, 0 violations
- Git diff --check: ✓

### Not Yet Complete (B8 [CALIBRATE])
1. B7 golden vector recalibration (4 tests need updated match trajectories)
2. Stamina curve / consumption rate / recovery amounts calibration
3. Forced-mismatch penalty value calibration
4. Directional scenario S9-S11 runs with calibrated values
5. 64-seed scenario re-runs
6. Gate B performance measurements

### Status
P02-003 ENERGY/FORCED-MISMATCH AMENDMENT: IMPLEMENTED / SELF-VERIFIED
INDEPENDENT REVIEW: REQUESTED
B8 / GATE B / PR READY / MERGE / P02-004: NOT STARTED / BLOCKED
