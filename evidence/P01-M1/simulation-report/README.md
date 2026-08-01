# P01-M1 Simulation Report

The implementation thread ran both frozen P01 seeds and the explicit M1 batch command after the
integrity changes.

- `p01-evidence-001` retained state hash `fnv64:d2e562049e32562a` and replay hash
  `fnv64:321321f346df2bd9`.
- `r2-clean-gate` retained state hash `fnv64:8cbf99e1aa4068d4` and replay hash
  `fnv64:62713a07383cbf50`.
- `p01-m1-gate-*` completed 1,000/1,000 runs with zero failure, replay mismatch, calendar/operation
  violation, or illegal terminal state.

Structured results are in `golden-summary.json` and `1000-run-summary.json`. These are
implementation results and must be reproduced independently before Gate M1 can pass.
