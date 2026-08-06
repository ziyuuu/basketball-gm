# B1R–B8 Implementation Boundary

## 1. Current status

```text
B1–B6 old candidate: implemented
B1R–B6R: required
B7: blocked
B8: blocked
```

This package authorizes corrective implementation on the existing task branch and Draft PR. It does not authorize a second implementation PR.

## 2. B1R — Registry and pure calculations

Required:

- add snapshot/profile version registries;
- add strength;
- add height/wingspan normalization;
- replace affected execution blends;
- add duty availability tables;
- add helper/interception candidate modifiers;
- add DefensiveActionFact payload registry/schema helpers;
- bump Model B registry/rules version;
- regenerate rules/content hash;
- update integrity and monotonicity tests.

Must remain:

- 44 behavior registry;
- existing EventType/drawKind arrays;
- PASS chain;
- BOXOUT classification.

## 3. B2R — P02-002-compatible schema addition and facts

Required:

- exact LegacyMatchPlayerSnapshot schema;
- PhysicalMatchPlayerSnapshotV1 schema;
- union at P02-002 match boundary;
- strict Model B Physical-only assertion;
- new fixture identity;
- DefensiveActionFact builder and validators;
- HELPD source/fact invariants;
- no automatic legacy conversion.

No change:

- MatchAnchor fields;
- MatchEvent types/payloads;
- MatchCommand;
- MatchEffect;
- box score schema.

## 4. B3R — time/state regression

No gameplay timing change.

Required regression:

- new physical fixture genesis;
- shotClock prefix reconstruction;
- possession/segment;
- period AP;
- overtime;
- event/anchor identity.

## 5. B4R — behavior and participants

Required:

- assigned-slot duty derivation;
- duty-adjusted defensive scene availability;
- HELPD helper weighted selection;
- remove HELPD beneficiary selection;
- deterministic block-help candidate;
- deterministic PASS interception candidate;
- stable sorting tests;
- unchanged semantic keys.

## 6. B5R — basketball results and facts

Required:

- HELPD SUCCESS/NO_EFFECT;
- HELPD DefensiveActionFact;
- prohibit HELPD CreationFact;
- opportunity contributor uniqueness;
- replace autonomous-Creation assist break with last-pass/same-segment causality;
- two-level breakdown metrics;
- tacticExecutionRate defensive consumption;
- pass interception steal attribution.

## 7. B6R — lineups, fatigue and effects

Required:

- physical snapshot propagation through substitutions;
- assigned-slot duty recomputation after lineup changes;
- short-handed legal-candidate handling;
- no-candidate HELPD unavailable;
- full regression of foul-out, forced replacement, forfeit, fatigue and effects.

No new product rotation behavior.

## 8. B7 entry gate

B7 may resume only after all are true:

1. v2.9-R1 package is committed with verified manifest;
2. Issue #14 and PR #15 identify v2.9-R1 as authority;
3. B1R–B6R focused tests pass;
4. full `pnpm check` passes;
5. legacy P02-002 contract tests pass;
6. new Physical snapshot identity tests pass;
7. no unresolved design contradiction remains;
8. current candidate SHA/tree are recorded.

Only then may the Owner/design thread issue:

```text
READY TO RESUME B7
```

## 9. B7 requirements

Unchanged core goal:

- stepToNextControlBoundary;
- runToEnd;
- replayMatch;
- finalize/protocol bundle;
- OFFICIAL/FRIENDLY/SCRIMMAGE.

Equality is per authoritative object:

- Events;
- Facts;
- Transcript;
- Anchors;
- draw keys where exposed as evidence;
- MatchResult;
- hashes.

## 10. B8 additions

Existing S1/S2/S3/S4/S6/S7/S8 remain.

Add:

### S9 — physical-factor ablation

Change one factor at a time:

- strength;
- height;
- wingspan;
- athleticism;
- interiorDefense;
- rebounding.

Report distinct expected directions.

### S10 — defensive-duty ablation

Same players, changed assigned slots.

Expected:

- C/PF rim-help participation rises;
- PG/SG PRESS/STLTRY participation rises;
- position alone does not increase success probability;
- actual high-skill off-position players can outperform low-skill nominal positions.

### S11 — assist causality

Cases:

- pass → immediate make;
- pass → creation action → make;
- pass → later pass → make;
- pass → miss → ORB → make;
- pass → turnover;
- no pass → make.

Report candidate eligibility and attribution draw behavior.

## 11. Performance

Existing performance budgets remain.

New work must not add:

- geometry;
- per-frame state;
- persistent assignment graph;
- unbounded fact scanning in hot paths.

Reducers may index PASS/Fact sources by possession/segment rather than repeatedly scanning full match history.
