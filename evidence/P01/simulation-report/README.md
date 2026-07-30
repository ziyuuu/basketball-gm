# P01 1,000-Run Simulation Evidence

Command:

```text
node apps/sim-cli/dist/cli.js batch --runs 1000 --seed-prefix p01-evidence --replay-samples 20
```

Result:

- 1,000 requested, 1,000 completed.
- 0 failures.
- 0 calendar-week violations.
- 0 operation-week violations.
- 0 illegal terminal states.
- 20 same-seed replay samples, 0 hash mismatches.
- 24 prototype model-A matches per run.
- 8.788 seconds elapsed on the recorded Work runner.

The batch path uses the documented ephemeral adapter: the same validated advance-week command and domain resolver, in-place throwaway state, validation at every school-year checkpoint, and final full Schema validation. A failed run is discarded and never written to a player save.
