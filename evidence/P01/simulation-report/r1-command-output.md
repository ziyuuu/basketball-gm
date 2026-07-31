# P01 R1 Command Output

This is implementation-thread output captured from a clean-copy workspace. It is not an
independent Gate run.

## Same-seed run A

```json
{
  "seed": "r1-gate-verify",
  "status": "THREE_YEAR_COMPLETE",
  "calendarWeeks": 120,
  "operationWeeks": 96,
  "examWeeks": 24,
  "schoolYearsCompleted": 3,
  "activePlayers": 0,
  "archivedPlayers": 22,
  "matches": 24,
  "wins": 13,
  "losses": 11,
  "budgetBalance": 208560,
  "stateHash": "fnv64:a7c9126822a0486a",
  "replayHash": "fnv64:a40c9b40a61a8ec8"
}
```

## Same-seed run B

```json
{
  "seed": "r1-gate-verify",
  "status": "THREE_YEAR_COMPLETE",
  "calendarWeeks": 120,
  "operationWeeks": 96,
  "examWeeks": 24,
  "schoolYearsCompleted": 3,
  "activePlayers": 0,
  "archivedPlayers": 22,
  "matches": 24,
  "wins": 13,
  "losses": 11,
  "budgetBalance": 208560,
  "stateHash": "fnv64:a7c9126822a0486a",
  "replayHash": "fnv64:a40c9b40a61a8ec8"
}
```

## Explicit 1,000-run batch

Command:

```bash
pnpm sim:batch -- --runs 1000 --seed-prefix p01-r1-gate --replay-samples 20
```

Output:

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
  "elapsedMilliseconds": 8621.23,
  "failures": []
}
```
