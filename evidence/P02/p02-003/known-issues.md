# P02-003 Known Issues and Deferred Work after 2026-08-06 Amendment

- Prior rejected Candidates remain rejected history. `bf03e215…` closes the B7 runner/evidence
  delivery blockers with manifest 35/35 and CI #103 success.
- The 2026-08-06 single-match energy and forced-mismatch contract is not yet implemented. Current
  code still consumes pre-match fatigue, continuous penalty, pace/defense time-load multipliers,
  secondary-position fit and active off-position behavior from the superseded contract.
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

### B7 Golden Vector Recalibration (4 tests)
The energy system changes match trajectories: consumption rates, tier penalties, and rotation timing differ. B7 runner tests that exercise full-match step/runToEnd/replay equality need updated golden vectors.
- SCRIMMAGE identity test
- FRIENDLY identity test
- OFFICIAL identity test
- Tampered transcript test

**Root cause**: Neutral rotation now triggers at different times (60k energy threshold vs old 70k fatigue threshold) and energy accumulates at different rates. This causes different substitution decisions, which shifts handlers and creates "actor must occupy a current lineup slot" errors in replay.

**Fix**: B8 recalibration pass must re-run and re-capture B7 golden vectors.

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
