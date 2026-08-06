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
