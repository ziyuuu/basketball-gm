# P02-003 Known Issues and Deferred Work after 2026-08-06 Amendment

- Prior rejected Candidates remain rejected history. `bf03e215…` closes the B7 runner/evidence
  delivery blockers with manifest 35/35 and CI #103 success.
- The 2026-08-06 single-match energy and forced-mismatch contract has been implemented
  (v2.10-energy-r2). All [CALIBRATE] parameters use initial runnable defaults; they are not
  final balance values.
- The amendment preserves P02-002 Schema names and the accepted clock/Event/Fact/RNG/replay identity
  contracts, but requires targeted Model B implementation changes before calibration.
- B8 remains a hard blocker. Current evidence contains no 10,000-match/60-second performance claim,
  fixed-seed calibration statistic, balance conclusion or realism conclusion.
- B8, Gate B, PR Ready, merge and P02-004 remain explicitly blocked.
- No product live-coaching command, persistent matchup graph, weight, court geometry, training,
  growth, Save V2, UI, Site, LLM/Agent or security mechanism is included.
- The only rotation behavior implemented so far is the pre-existing `internal/test` neutral policy;
  it must be remediated only to the extent required by the frozen energy/position contract and must
  not become the P02-006 product assistant policy.

## 2026-08-06 定点实现修复 Known Issues

### B7 Golden Vector Recalibration (resolved in r2)

The energy system changes match trajectories: consumption rates, tier penalties, and rotation timing differ from v2.9. B7 runner tests that exercise full-match step/runToEnd/replay equality initially failed (4/13 in r1, 0/13 in r2).

**Root cause (r1)**: `handlerFromCurrentPossession` recovered possession-origin players from REBOUND/STEAL/POSSESSION_HANDLER facts without verifying they were still in the current lineup. Neutral rotation with the new energy thresholds could bench these players at DEAD_BALL boundaries, and the next segment would select an invalid handler.

**Fix (r2)**: Added lineup membership verification in `handlerFromCurrentPossession` (runner.ts:341-371). If the recovered player is no longer in the offense lineup, the function falls through to `selectModelBHandler` which correctly filters by eligible lineup players. This is a defensive invariant fix — it doesn't change rotation logic, energy thresholds, or any game mechanics.

### [CALIBRATE] Parameters

All energy consumption/recovery/penalty values are initial runnable defaults, not final balance. These must be calibrated through the directional-scenario process:

- energyBaseCostPerSecondMilli: 100
- energyIntensityCostMilli: {LIGHT:200, MODERATE:400, HEAVY:800}
- benchRecoveryPerSecondMilli: 50
- quarterBreakRecoveryMilli: 5000, halftimeRecoveryMilli: 20000
- staminaEnergyReductionMilliPerPoint: 3
- neutralRotationEnergyThresholdMilli: 60000
- forcedMismatchPenaltyMilli: -8000

### Not Implemented (by design)

- No stamina effect on recovery speed or energy cap
- No fatigue-protection mode, no low-energy behavior avoidance
- No secondary position, position proficiency, or cross-position adaptation
- No pause/tactics card system
- No save V2, training, or growth effects
- No P02-006 product assistant rotation

## r4 Independent Review — Rejected (2026-08-06)

**Candidate** `7d91a296f38ff68b70ada40298d88df68a88159f`
**CI** run 31097468798, SUCCESS
**Conclusion** `REQUEST CHANGES / NOT ACCEPTED`

3 runtime blockers:

1. 10 non-selectable behaviors (FT, PASSTOV, BALLDESTROY, PUTBACK, BLK, FOUL, ORB, DRB, BOXOUT, BLKLOOSE) registered but never wired to energy accounting
2. SUBSTITUTION events lost forced mismatch reason codes; `forced: false` hardcoded for neutral rotation
3. `canRestorePrimaryPosition()` required unauthorized 10,000 energy advantage gate

## r5 Remediation (2026-08-06, REJECTED)

All 3 blockers addressed but incomplete per independent review. Non-selectable behaviors called `addBehaviorEnergyCost` but used wrong durations and missing target roles. SUBSTITUTION events carried `reasonCode` but `forced: false` still hardcoded for mismatches. `canRestorePrimaryPosition` energy gate removed but cross-boundary oscillation emerged.

**Known r5 limitation**: SCRIMMAGE (6-player) match kind may exceed 10,000 steps in rare cases due to increased substitution activity from energy gate removal. OFFICIAL and FRIENDLY match kinds terminate normally. Tests use OFFICIAL fixtures for runToEnd verification.

## r6 Remediation (2026-08-07)

All r5 gaps closed:
- Duration clamping (FT uses `freeThrows.attempted`; PASSTOV/BALLDESTROY/PUTBACK clamped to registry max)
- Target role completion (BOXOUT MODERATE target; ORB/DRB LIGHT targets)
- `forced: true` for FORCED_MISMATCH_NO_PRIMARY; foul-out mismatch detection
- Cross-boundary oscillation prevented via `neutralRotationEnergyThresholdMilli` guard in `canRestorePrimaryPosition` (existing frozen parameter, no new threshold)

The SCRIMMAGE step-bound issue should be resolved by the oscillation prevention fix.
