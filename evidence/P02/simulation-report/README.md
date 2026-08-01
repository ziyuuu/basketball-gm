# P02-001 Legacy P01 Zero-Drift Simulation Report

P02-001 does not add P02 simulation. These runs prove the P01 Legacy path continues to produce the
frozen results after mechanical isolation.

- `p01-evidence-001`: state `fnv64:d2e562049e32562a`, replay
  `fnv64:321321f346df2bd9`.
- `r2-clean-gate`: state `fnv64:8cbf99e1aa4068d4`, replay
  `fnv64:62713a07383cbf50`.
- Both runs: 120 calendar weeks, 96 operation weeks, 24 exam weeks, 24 matches, and budget
  balance 208560.
- `p02-001-legacy-*`: 1,000/1,000 complete, zero failures, zero replay mismatches, zero calendar
  and operation violations, and zero illegal terminal states.

The structured results are in `golden-summary.json` and `1000-run-summary.json`.
