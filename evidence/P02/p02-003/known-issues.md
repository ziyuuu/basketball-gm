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
