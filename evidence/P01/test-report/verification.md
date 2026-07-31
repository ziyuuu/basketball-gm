# P01 Verification Report

- Date: 2026-07-31
- Test runner: Vitest 4.1.10
- Result: 8 files passed, 25 tests passed
- Duration: 12.20 seconds in the recorded clean-copy full run

## Covered behavior

- content Schema acceptance and rejection;
- deterministic RNG replay, snapshots, and cosmetic/match isolation;
- model A structured-result and score-stat invariants;
- command commit, revision conflict, budget rejection, and zero-contamination checks;
- duplicate event ID and committed-revision mismatch rejection in the accepted command audit tail;
- training-plan command without RNG consumption;
- save round-trip, accepted-command-tail restoration, and year-end event-ID distinguishability;
- memory, Node file, and IndexedDB latest/backup behavior;
- three-year calendar and lifecycle closure;
- annual grants at exactly weeks 40/80/120 and no ledger entry after the resolved calendar;
- rejection of future-dated state entries;
- rejection before restore of checksummed saves containing annual grants at 41/81/121;
- global event ID uniqueness plus revision/week/sequence/type alignment across a full run;
- grade advancement and graduation/archive transition;
- year-two save recovery to the uninterrupted terminal hash;
- 1,000-run completion and replay sample.

No test claims final fun, balance, official character quality, recruitment sustainability, or real tournament fidelity.
