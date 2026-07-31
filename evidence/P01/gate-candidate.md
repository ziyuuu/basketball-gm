# P01 Gate Candidate Status

- Frozen failed baseline: `32861501d8df84814b18959d527fac033c659729`
- Rejected R1 candidate: `6984260a0d466e00eba1368fdbcb58ecde4c1078`
- Latest independent decision: P00 `CONDITIONAL`, P01 `FAIL`
- R2 implementation status: `REMEDIATION_CANDIDATE_READY`
- R2 Gate decision: `NOT_REVIEWED`
- Next phase allowed: `NO FORMAL PROMOTION YET`

R1's deterministic event IDs remain intact. R2 fixes the independently confirmed annual-grant
time defect by deriving every budget entry from the resolved `Week`, then enforcing calendar
bounds, resolved-week bounds, school-year mapping, monotonic ledger order, and exact year-end
grant weeks in the state Schema.

Implementation-thread evidence meets the P01 R2 candidate thresholds:

- 1,000/1,000 three-year runs completed;
- exactly 120 calendar and 96 operation weeks per run;
- zero illegal terminal states;
- zero replay mismatches in sampled repeats;
- annual grants occur at exactly weeks 40, 80, and 120;
- no persisted budget or match entry exceeds the resolved calendar;
- checksummed saves with grants at 41/81/121 are rejected before restore;
- globally unique event IDs with zero revision/week/type mismatches;
- year-end lifecycle event IDs remain distinguishable after save and restore;
- failed persistent commands leave state/RNG/log/revision unchanged;
- latest plus previous-good backup exists;
- domain has no DOM/React/platform dependency.

An independent reviewer must approve P00, check out the R2 candidate directly, rerun all evidence,
validate manifests, and issue the P01 Gate decision. This report does not self-promote P01, create
approval history, or allow P02.
