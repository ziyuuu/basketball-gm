# P02-003 Headless Model B v2.9-R1 FINAL — Package Index

- Project: Basketball GM / Sunny Court Manager
- Slice: P02-003 Headless Model B
- Revision date: 2026-08-04
- Owner status: `OWNER_APPROVED DESIGN AUTHORITY`
- Implementation branch at revision start: `task/p02-003-headless-model-b`
- Implementation HEAD at revision start: `81697e9d26e6bf5ea372b9fffdd427598fc3d87f`
- Implementation tree at revision start: `8b8fab9935407aef53a142be1c845128acddbe30`
- Draft PR: `#15`
- Completed implementation batches: B1–B6
- Pending implementation batches: B7–B8
- Current execution status: `B1R–B6R REQUIRED`
- Current B7 status: `HARD BLOCKED`
- Independent audit of this revision: `NOT YET RUN`
- Final readiness: `NOT READY TO RESUME B7`

## 1. Authority model

This package is a narrow Owner-approved revision of `docs/design/P02-003/v2.9-final/`.

The original v2.9 FINAL directory and its manifest remain immutable historical evidence. This package does not rewrite those bytes. Where this package explicitly replaces a v2.9 FINAL rule, v2.9-R1 is authoritative. All unaffected v2.9 FINAL rules remain in force.

Authority order for P02-003 after this package is committed:

1. `docs/P02_GAMEPLAY_BASELINE.md` v1.2, except the exact player-model clauses superseded by `P02_GAMEPLAY_BASELINE_AMENDMENT.md` in this package;
2. this v2.9-R1 FINAL package;
3. unaffected v2.9 FINAL provisions;
4. P02-002 contracts, except the versioned MatchPlayerSnapshot addition authorized here;
5. Issue #14 batch and Gate procedure, as amended by this revision.

## 2. Package contents

| File | Purpose |
|---|---|
| `DESIGN_AUTHORITY.md` | Authority, supersession and operational stop status |
| `P02_GAMEPLAY_BASELINE_AMENDMENT.md` | Exact Owner amendment to the P02 player-model baseline |
| `01_OWNER_DECISION_RECORD.md` | D1–D7 decisions and interpretation |
| `02_NORMATIVE_DESIGN_R1.md` | HELPD, assist, defensive duties and simplified defense |
| `03_SCHEMA_AND_ATTRIBUTE_CONTRACT.md` | Versioned snapshot, strength, height and wingspan |
| `04_EVENT_FACT_STAT_RNG_CONTRACT.md` | Fact, opportunity ledger, statistics, RNG and replay |
| `05_B1R_B8_IMPLEMENTATION_BOUNDARY.md` | Required remediation before B7 and B8 scope |
| `06_TEST_AND_ACCEPTANCE_MATRIX.md` | Positive, negative, monotonicity and identity tests |
| `07_TRACEABILITY_AND_MIGRATION.md` | Affected v2.9 sections, P02-002 impact and compatibility |
| `08_EXTERNAL_RESEARCH_NOTE.md` | Narrow external evidence used for design direction |
| `09_OWNER_APPROVAL_CHECKLIST.md` | Approval and readiness checklist |
| `manifest.sha256` | Exact SHA-256 manifest for package Markdown files |

## 3. Frozen high-level conclusions

- `bodyImpact` remains valid only in the legacy P02-002 snapshot variant.
- The new Model B input uses an explicit 11-ability profile with `strength`.
- `heightCm` and `wingspanCm` are immutable physical content fields.
- No weight field is introduced.
- No position or rarity-derived body dimensions are permitted.
- HELPD is a temporary help-and-recover defensive action.
- HELPD has no offensive beneficiary and never produces an offensive CreationFact.
- HELPD failure is `NO_EFFECT`, not an automatic defensive leak.
- A successful HELPD applies one capped negative opportunity-quality contribution.
- Assist eligibility depends on the last legal pass and direct continuation to the scorer, not on the presence of a CreationFact.
- Creation actions do not automatically clear an assist candidate.
- Current lineup slot creates a limited defensive-duty bias:
  - C/PF: rim help and block-candidate priority;
  - SF: balanced wing help and interception;
  - PG/SG: pressure and pass-interception priority.
- Position bias changes availability/candidate responsibility, not the final success formula.
- No x/y geometry, persistent assignment graph or second-layer rotation is introduced.
- Behavior IDs, EventTypes and drawKinds remain closed and unchanged.
- New physical inputs and revised facts change new-version replay/hash identities.
- Legacy inputs and legacy replay identities are not rewritten.

## 4. Operational decision

Implementation may resume only for the corrective batches B1R–B6R. B7 remains blocked until the conditions in `05_B1R_B8_IMPLEMENTATION_BOUNDARY.md` are satisfied.
