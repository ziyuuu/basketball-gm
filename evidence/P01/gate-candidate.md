# P01 Gate Outcome

- Frozen failed baseline: `32861501d8df84814b18959d527fac033c659729`
- Rejected R1 candidate: `6984260a0d466e00eba1368fdbcb58ecde4c1078`
- Accepted R2 candidate: `f008514ef4b6c0f0af78bdf8a5a2dff86aaa2750`
- Merged baseline: `6547fbf51b2a440fd9602eed82c869d70b1181e1`
- Engine version: `0.1.2-p01-r2`
- Current project status: `P01 COMPLETE`
- Next phase allowed: `P02-000 GAMEPLAY BASELINE DESIGN`

R1's deterministic event IDs remain intact. R2 fixes the independently confirmed annual-grant
time defect by deriving every budget entry from the resolved `Week`, then enforcing calendar
bounds, resolved-week bounds, school-year mapping, monotonic ledger order, and exact year-end
grant weeks in the state Schema.

The implementation evidence and independent R2 reproduction met the P01 thresholds:

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

The independent decision was made outside GitHub Review metadata; this file does not fabricate a
missing review record. The owner accepted the result under the simplified personal-project
workflow and merged PR #1. That decision permits P02 design but does not freeze P01's prototype
gameplay values as final design.
