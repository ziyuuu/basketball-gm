# P01 R2 Year-End Time Integrity Remediation

## Rejected R1 candidate

- Commit: `6984260a0d466e00eba1368fdbcb58ecde4c1078`
- Independent decision: P01 `FAIL`
- Confirmed defect: annual grants were recorded at weeks 41/81/121. The generic ledger helper
  derived a week from `resolvedCalendarWeeks + 1`; school-year settlement called it after the
  resolved counter had already advanced.
- R1 event ID repair passed independent review and remains unchanged.

## R2 contract

Every resolved budget entry now receives the actual `Week` being settled. No budget timestamp is
derived from mutable counter order.

The state Schema also validates:

- P01 calendar, operation, exam, and school-year metric bounds;
- budget sequence position and nondecreasing ledger weeks;
- the initial grant at school year 1, week 0;
- every later budget entry at or before the resolved calendar;
- absolute-week to school-year mapping;
- annual grants at exactly weeks 40, 80, and 120;
- match results at or before the resolved calendar;
- exactly 120 resolved weeks for a terminal three-year run.

## Regression evidence

- the original R1 implementation produces grants at 41/81/121 and fails the new tests;
- R2 produces grants at 40/80/120;
- a future-dated weekly budget entry is rejected by `GameStateSchema`;
- terminal saves with a grant changed to 41, 81, or 121 are rejected even after both
  `snapshotHash` and the full save checksum are recomputed;
- save restore cannot bypass the state Schema;
- 25/25 tests pass;
- same-seed double run has equal state and replay hashes;
- 1,000/1,000 explicit batch runs complete with zero replay mismatches or illegal terminal states.

## Compatibility decision

Correcting the ledger changes state and replay identity, so the engine version is
`0.1.2-p01-r2`. R1 was never promoted, and its prototype saves contain rejected annual-grant
timestamps. R2 deliberately rejects pre-R2 saves instead of representing them as time-integrity
compliant.

## Gate boundary

This file records implementation evidence only. P00 remains `CONDITIONAL`, P01 R2 requires a new
independent review, and P02 remains prohibited until both Gates pass.

## Subsequent outcome

On 2026-07-31 the R2 candidate
`f008514ef4b6c0f0af78bdf8a5a2dff86aaa2750` passed the independent technical review used by this
personal project. The owner accepted the result under the simplified governance flow and merged
PR #1 as `6547fbf51b2a440fd9602eed82c869d70b1181e1`.

The paragraph above remains the candidate-time boundary and is not rewritten as a historical
approval. No missing GitHub Review record is implied.
