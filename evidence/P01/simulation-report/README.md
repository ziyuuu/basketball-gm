# P01 R1 Simulation Verification

Command:

```bash
pnpm sim:batch -- --runs 1000 --seed-prefix p01-r1-gate --replay-samples 20
```

Result:

- 1,000 requested, 1,000 completed.
- 0 failures.
- 0 calendar-week violations.
- 0 operation-week violations.
- 0 illegal terminal states.
- 20 same-seed replay samples, 0 hash mismatches.
- 24 prototype model-A matches per run.
- 8.621 seconds elapsed on the recorded clean-copy Work runner.

The batch path uses the documented ephemeral adapter: the same validated advance-week command and domain resolver, in-place throwaway state, validation at every school-year checkpoint, and final full Schema validation. A failed run is discarded and never written to a player save.

The implementation thread also ran the same `r1-gate-verify` seed twice through
`pnpm sim:three-years`. Both runs produced:

- state hash `fnv64:a7c9126822a0486a`;
- replay hash `fnv64:a40c9b40a61a8ec8`.

These are candidate reproduction results and still require an independent Gate rerun.
