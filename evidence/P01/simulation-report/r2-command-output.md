# P01 R2 Command Output

Environment:

```text
Node v24.14.0
pnpm 11.7.0
```

Same-seed run A:

```json
{
  "seed": "r2-clean-gate",
  "status": "THREE_YEAR_COMPLETE",
  "calendarWeeks": 120,
  "operationWeeks": 96,
  "examWeeks": 24,
  "schoolYearsCompleted": 3,
  "activePlayers": 0,
  "archivedPlayers": 22,
  "matches": 24,
  "wins": 5,
  "losses": 19,
  "budgetBalance": 208560,
  "stateHash": "fnv64:8cbf99e1aa4068d4",
  "replayHash": "fnv64:62713a07383cbf50"
}
```

Same-seed run B produced the identical summary, state hash, and replay hash.

Persisted annual-grant check:

```json
[
  { "schoolYearIndex": 1, "absoluteWeek": 40 },
  { "schoolYearIndex": 2, "absoluteWeek": 80 },
  { "schoolYearIndex": 3, "absoluteWeek": 120 }
]
```

The maximum persisted ledger week was 120 and the terminal resolved calendar was 120.

Explicit batch command:

```bash
pnpm sim:batch -- --runs 1000 --seed-prefix p01-r2-clean-gate --replay-samples 20
```

```json
{
  "requestedRuns": 1000,
  "completedRuns": 1000,
  "failedRuns": 0,
  "replaySamples": 20,
  "replayMismatches": 0,
  "calendarWeekViolations": 0,
  "operationWeekViolations": 0,
  "illegalTerminalStates": 0,
  "averageMatches": 24,
  "averageBudgetBalance": 208560,
  "elapsedMilliseconds": 8573.97,
  "failures": []
}
```
