# P02-002 Legacy P01 Zero-Drift Simulation Report

P02-002 does not run a P02 match resolver. These frozen P01 runs establish that the pure contract
and primitive additions did not change Legacy engine output:

- both named golden seeds retained their frozen state/replay hashes and `120/96/24/24` weeks/matches
  with budget `208560`;
- `p02-002-legacy-*` batch completed `1000/1000` runs with zero failures, replay mismatches,
  calendar/operation violations, and illegal terminal states;
- `elapsedMilliseconds` is an observed environment value, not a P02 performance claim.
