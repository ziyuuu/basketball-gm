# Traceability and Migration

## 1. v2.9 sections affected

| v2.9 authority | v2.9-R1 action |
|---|---|
| `02_FROZEN_DECISIONS.md` F-31/F-33 scope wording | add limited slot duties; keep no complete rotation |
| `03_HEADLESS_MODEL_B_NORMATIVE_DESIGN.md` §7 | replace 10+bodyImpact new-version model with versioned 11+physical profile |
| `04_BEHAVIOR_ATTRIBUTE_MATRIX.md` HELPD row | SUCCESS/NO_EFFECT; no beneficiary/CreationFact |
| `04` physical modifier rows | replace bodyImpact consumption with strength/height/wingspan blends |
| `05_PROBABILITY_AND_PARAMETER_REGISTRY.md` §B | replace affected blends |
| `05` §C.6 | pass interception candidate and physical attribution inputs |
| `05` §C.9 HELPD | full replacement |
| `05` §H | delete HELPD beneficiary use; reserve key |
| `06_EVENT_STAT_FACT_MATRIX.md` §D | HELPD remains outside CreationFact closed set |
| `06` §F.1 assist | remove autonomous CreationFact hard clear |
| `06` §F.2 | remove HELPD beneficiary |
| `06` §F.3 | defensive actors never enter offensive CreationFact |
| `07_BALANCE_AND_REALISM_REGISTRY.md` | add S9–S11 |
| `08_P02-002_TRACEABILITY.md` | add versioned snapshot contract |
| `09_CONTRACT_GAPS.md` | mark intentional P02-002 additive schema change |
| `10_REVIEW_REPORT.md` / `11_OWNER_APPROVAL_CHECKLIST.md` | superseded readiness; new audit pending |
| old `DESIGN_AUTHORITY.md` | historical only |

## 2. P02-002 impact

Changed:

- MatchPlayerSnapshotSchema becomes union;
- MatchInput identity accepts the new strict Physical variant.

Unchanged:

- MatchAnchor;
- MatchEvent;
- MatchEventType;
- MatchDrawKind;
- MatchEffect;
- MatchCommand;
- box score;
- canonical algorithms.

## 3. Compatibility

### Legacy

- no field is added to legacy snapshot;
- no legacy hash is recalculated;
- no legacy replay is migrated;
- old rulesVersion continues to select old semantics.

### Physical v1

- new rulesVersion required;
- new content/rules hash required;
- new MatchInput identity required;
- Model B rejects legacy variant.

## 4. Persistent player schema

Current Legacy P01 PlayerSchema has no authoritative strength/height/wingspan fields.

P02-004 Player/Save V2 must adopt:

```text
abilityProfile
physicalProfile
```

This package defines the contract but does not implement P02-004 persistence.

P02-004 must not:

- restore bodyImpact as size proxy;
- infer dimensions from position/rarity;
- add weight without a new Owner decision.

## 5. Fixture migration

Existing P02-003 fixtures that set every `bodyImpact = rating` are not valid physical content.

New fixtures must explicitly set:

- strength;
- heightCm;
- wingspanCm.

Directional tests may use synthetic values but must label them as fixtures, not content defaults.

## 6. Rules/content version

Required new version label:

```text
p02-003-model-b-v2.9-r1-final
```

Required game rulesVersion:

```text
p02-003-v2.9-r1-final
```

Exact naming may follow repository naming conventions, but old and new versions must differ.

## 7. Manifest

- package Markdown files are hashed in `manifest.sha256`;
- original v2.9 manifest remains untouched;
- any post-freeze byte edit requires:
  - version bump;
  - manifest regeneration;
  - Owner record;
  - independent re-audit.
