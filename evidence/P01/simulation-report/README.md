# P01 R2 Simulation Verification

Command:

```bash
pnpm sim:batch -- --runs 1000 --seed-prefix p01-r2-clean-gate --replay-samples 20
```

Result:

- 1,000 requested, 1,000 completed.
- 0 failures.
- 0 calendar-week violations.
- 0 operation-week violations.
- 0 illegal terminal states.
- 20 same-seed replay samples, 0 hash mismatches.
- 24 prototype model-A matches per run.
- 8.574 seconds elapsed on the recorded clean-copy Work runner.

The batch path uses the documented ephemeral adapter: the same validated advance-week command and domain resolver, in-place throwaway state, validation at every school-year checkpoint, and final full Schema validation. A failed run is discarded and never written to a player save.

The implementation thread also ran the same `r2-clean-gate` seed twice through
`pnpm sim:three-years`. Both runs produced:

- state hash `fnv64:8cbf99e1aa4068d4`;
- replay hash `fnv64:62713a07383cbf50`;
- annual grants at weeks 40, 80, and 120;
- maximum persisted ledger week 120.

These are implementation-thread reproduction results. The R2 candidate was subsequently
reproduced independently and accepted, but this report remains implementation evidence rather
than a substitute for the external review.
