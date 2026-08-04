# P02-003 Headless Model B v2.9-R1 FINAL — Design Authority

- Owner decision date: 2026-08-04
- Owner decision: `APPROVED AS REVISION AUTHORITY`
- Revision purpose: close HELPD attribution conflict and add explicit strength/height/wingspan and limited defensive duties
- Superseded design: `docs/design/P02-003/v2.9-final/` only where explicitly listed
- Original v2.9 archive identity: retained unchanged as historical evidence
- Implementation issue: GitHub Issue #14
- Implementation branch: `task/p02-003-headless-model-b`
- Revision start HEAD: `81697e9d26e6bf5ea372b9fffdd427598fc3d87f`
- Revision start tree: `8b8fab9935407aef53a142be1c845128acddbe30`
- Draft PR: `#15`
- Independent audit status: `PENDING`
- B7 status: `HARD BLOCKED`
- Readiness: `NOT READY TO RESUME B7`

## 1. Authority effect

This directory is the current P02-003 design authority. It is additive and superseding:

- all rules explicitly replaced in this package use v2.9-R1;
- all v2.9 FINAL rules not mentioned remain authoritative;
- the original v2.9 FINAL files and manifest must not be edited;
- implementation may not mix old and new rules within one rules/content version.

## 2. Authorized contract changes

This revision authorizes exactly the following upstream change:

- versioned addition of a Physical MatchPlayerSnapshot variant containing:
  - an explicit 11-ability profile including `strength`;
  - immutable `heightCm`;
  - immutable `wingspanCm`.

It does not authorize:

- weight;
- body-shape simulation;
- x/y geometry;
- a complete player/save implementation;
- training implementation;
- new Behavior IDs;
- new MatchEventType values;
- new MatchDrawKind values;
- redesign of Canonical V2, fixed point, keyed RNG or effects.

## 3. Frozen gameplay corrections

### 3.1 HELPD

HELPD is a temporary help-and-recover action.

- helper is a defender;
- helper never becomes an offensive creator;
- HELPD has no offensive beneficiary;
- helper immediately returns to the pre-existing abstract defensive responsibility;
- success applies one negative opportunity-quality contribution;
- failure produces no effect;
- HELPD never produces an offensive CreationFact;
- HELPD failure never automatically creates an open shooter or defensive breakdown.

### 3.2 Physical model

- `strength` is a player ability, not weight and not body size;
- height and wingspan are physical content;
- weight is intentionally absent for the anime high-school-girls product direction;
- position and rarity cannot fabricate physical values;
- no training action in P02-003 changes height or wingspan.

### 3.3 Defensive duties

Current lineup slot creates limited defensive responsibility bias.

This bias affects action availability and deterministic attribution candidates. It never adds a hidden position multiplier to final success probabilities.

### 3.4 Assists

- only the last legal pass can be an assist candidate;
- the receiver must be the scorer;
- the pass and score must remain in the same period, possession and segment;
- a later successful pass replaces the candidate;
- an intervening missed shot/ORB segment ends eligibility;
- CreationFact existence does not determine eligibility;
- DRIVE, ISO, POSTUP or another creation action does not automatically clear eligibility;
- the existing `ASSIST_ATTRIBUTION` draw decides whether the eligible pass is credited.

## 4. Frozen engineering boundary

The following remain unchanged:

- 44 Behavior IDs = 34 selectable + 10 non-selectable;
- PASS-family single `TURNOVER_OCCURRENCE` failure chain;
- BOXOUT remains RULE_RESULT with no actor draw;
- 16 MatchEventType values;
- 16 MatchDrawKind values;
- existing semantic ordinal ranges;
- event-driven session and committed-history model;
- step/runToEnd/replay identity equality within one rules version.

## 5. Stop conditions

Development must stop and return to Owner/design review if implementation requires any of:

1. a new Behavior ID, EventType or drawKind;
2. persistent x/y position or a matchup/rotation graph;
3. deriving height, wingspan or strength from position, rarity or bodyImpact;
4. adding weight;
5. using HELPD helper as an offensive creator;
6. producing an offensive CreationFact from HELPD;
7. allowing facts/logging to alter RNG or results;
8. silently accepting legacy snapshots in the new Model B path;
9. rewriting legacy replay/hash identities;
10. proceeding to B7 before B1R–B6R pass.

## 6. Current implementation authorization

Authorized now:

- docs/evidence updates;
- B1R–B6R corrective implementation;
- corrective tests and full regression.

Not authorized now:

- B7;
- B8 calibration/performance;
- PR Ready;
- Gate B;
- merge;
- P02-004.
