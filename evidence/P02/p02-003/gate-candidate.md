# P02-003 v2.10-energy-r2 Fixup Candidate Record

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

## 2026-08-06 定点实现修复 v2.10-energy-r2

### Identity

- **Candidate**: 50c3077918ca74806df4d6364744763c9d8c3377
- **Tree**: 9d2fedc4ea8bb8d11fdcdd5b23b8cd17bd92f43c
- **Parent**: aca6307974492efaccd636880fceab16aa42d5c5
- **Branch**: `task/p02-003-headless-model-b`
- **Draft PR**: [#15](https://github.com/ziyuuu/basketball-gm/pull/15)
- **Original implementation**: acf9bbb58d6177a561d3a790bcbe530bcf06975f (v2.10-energy-r1)

### v2.10-energy-r1 Rejection Summary

The v2.10-energy-r1 Candidate `acf9bbb` (evidence commit `aca6307`) was returned to development with 5 hard blockers:

1. **B7 test failures (4/13)**: `handlerFromCurrentPossession` recovered possession-origin players from REBOUND/STEAL/POSSESSION_HANDLER facts without verifying they were still in the current lineup after neutral rotation substitutions, causing "actor must occupy a current lineup slot" errors.
2. **Evidence control-character corruption**: BEL (0x07), TAB (0x09), and form-feed (0x0C) bytes embedded in multiple evidence files; truncated 39-char Candidate hash.
3. **Manifest not regenerated**: `manifest.sha256` still matched the pre-implementation `1afee43` tree.
4. **Evidence content contradictions**: `known-issues.md` top section claimed "not yet implemented" while bottom section described implementation; `scope-snapshot.md` retained "(to be filled after commit)" placeholder.
5. **PR #15 outdated**: Still showed pre-implementation Candidate `1afee43` and 13 files.

### r2 Fixes

1. **B7 handler lineup check** (`runner.ts:341-371`): `handlerFromCurrentPossession` now verifies recovered players are still in the current offense lineup before returning them. If a player was subbed out by neutral rotation, the function falls through to `selectModelBHandler` which correctly filters by eligible lineup players.
2. **Evidence corruption cleaned**: All control characters removed from all files; truncated hash restored; stale placeholders and contradictions resolved.
3. **File count corrected**: 17 files modified across the implementation (15 in `acf9bbb` + 2 in `aca6307`).

### Modified Files in r2

| File                                        | Change                                                   |
| ------------------------------------------- | -------------------------------------------------------- |
| packages/domain/src/match/model-b/runner.ts | Fix handlerFromCurrentPossession lineup membership check |

### Implementation Summary (from v2.10-energy-r1)

1. **Energy initialization**: All players start at 0 consumed. pre-match fatigueMilli {0,10000,80000,100000} all yield genesis 0.
2. **Energy consumption**: base = seconds × 100 × (1000-stamina×3)/1000. Behavior = intensity × duration × stamina factor.
3. **Energy tier penalty**: 7 bands indexed by floor(remaining%), applied per-ability to 10 of 11 abilities.
4. **Recovery**: bench 50/s, quarter break 5k, halftime 20k, OT break 5k, timeout 0.
5. **Position**: primary-only. secondaryPosition is compat-only. Forced mismatch: unified -8000.
6. **44-behavior intensity registry**: LIGHT/MODERATE/HEAVY assignments for all behaviors.
7. **Determinism**: step/runToEnd/replay identity preserved.
8. **Version**: v2.10-energy-r1. Legacy hash preserved.

### Test Results

| Suite                 | Pass/Fail   |
| --------------------- | ----------- |
| B1 registries         | 17/17       |
| B2 session            | 12/12       |
| B3 clock rules        | (unchanged) |
| B4 behavior selection | (unchanged) |
| B5 basketball results | (unchanged) |
| B6 state rules        | 7/7         |
| B7 runner             | 13/13       |
| Energy/mismatch (NEW) | 63/63       |
| **Total**             | **149/149** |

### Verification

- pnpm typecheck: pass
- pnpm build (Web + CLI): pass
- sim:batch: 0 failures, 0 replay mismatches
- pnpm check: pass
- pnpm evidence:manifest: 36/36 verified
- Git diff --check: pass

### Not Yet Complete (B8 [CALIBRATE])

1. Stamina curve / consumption rate / recovery amounts calibration
2. Forced-mismatch penalty value calibration
3. Directional scenario S9-S11 runs with calibrated values
4. 64-seed scenario re-runs
5. Gate B performance measurements

### v2.10-energy-r2 Rejection Summary

The v2.10-energy-r2 Candidate `4d35aea` was returned to development with 2 hard blockers:

1. **CI #113 Prettier failure**: `behavior-selection.ts` and `effective-values.ts` failed `pnpm format:check`, blocking lint/typecheck/tests/build from executing in CI.
2. **Manifest cross-platform invalidity**: `manifest.sha256` was generated from Windows CRLF working-tree bytes, not canonical Git blob (LF) bytes. Verification succeeded on Windows (36/36) but would produce 0/36 on Linux/CI.

### 2026-08-06 定点实现修复 v2.10-energy-r3

#### Identity

- **Candidate**: 228ff420ee2bb3bf1a9dbbe54d9850cba10ca416
- **Tree**: 034c99ceb57492aa14f08fc16fb9eb7dd2bcbd34
- **Parent**: 4d35aea735348833d314cd63d73b4bd0b0f2baff
- **Branch**: `task/p02-003-headless-model-b`
- **Draft PR**: [#15](https://github.com/ziyuuu/basketball-gm/pull/15)

#### r3 Fixes

1. **Prettier formatting** (`behavior-selection.ts`, `effective-values.ts`): Reformatted to match project Prettier config, resolving CI #113 failure.
2. **Cross-platform manifest**: `scripts/generate-evidence-manifest.mjs` now normalizes `\r\n` → `\n` before SHA-256 hashing, and uses `/` path separators. Manifest hashes now match canonical Git blob hashes on all platforms.

#### Modified Files in r3

| File                                                    | Change                                  |
| ------------------------------------------------------- | --------------------------------------- |
| packages/domain/src/match/model-b/behavior-selection.ts | Prettier formatting                     |
| packages/domain/src/match/model-b/effective-values.ts   | Prettier formatting                     |
| scripts/generate-evidence-manifest.mjs                  | CRLF→LF normalization, `/` paths        |
| evidence/P02/manifest.sha256                            | Regenerated (36 entries, LF-normalized) |

### Status

```text
P02-003 v2.10-energy-r3:
IMPLEMENTED / SELF-VERIFIED
AWAITING CI CONFIRMATION

INDEPENDENT REVIEW: NOT STARTED
B8 / GATE B / PR READY / MERGE / P02-004: BLOCKED
```
