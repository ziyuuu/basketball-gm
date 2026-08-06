# Schema and Attribute Contract

## 1. Versioned MatchPlayerSnapshot

The new schema is an explicit union:

```text
MatchPlayerSnapshotSchema =
  LegacyMatchPlayerSnapshotSchema
  | PhysicalMatchPlayerSnapshotV1Schema
```

## 2. Legacy variant

The legacy variant is byte-compatible with P02-002:

```text
{
  playerId
  primaryPosition
  secondaryPosition
  abilities // original 10 fields
  bodyImpact
  tendencies
  archetypeTrait
  fatigueMilli
  chemistryMilli
}
```

Rules:

- legacy tests/replays remain valid;
- `bodyImpact` remains a legacy field;
- no automatic conversion to new physical values;
- v2.9-R1 Model B must reject the legacy variant at its entry boundary.

## 3. Physical variant

```text
PhysicalMatchPlayerSnapshotV1 {
  snapshotVersion: "P02_MATCH_PLAYER_PHYSICAL_V1"

  playerId: string
  primaryPosition: PG | SG | SF | PF | C
  secondaryPosition: PG | SG | SF | PF | C | null

  abilityProfile: {
    version: "P02_CORE_11_V1"
    values: {
      finishing: 0..100 integer
      shooting: 0..100 integer
      ballHandling: 0..100 integer
      playmaking: 0..100 integer
      perimeterDefense: 0..100 integer
      interiorDefense: 0..100 integer
      rebounding: 0..100 integer
      athleticism: 0..100 integer
      stamina: 0..100 integer
      tacticalUnderstanding: 0..100 integer
      strength: 0..100 integer
    }
  }

  physicalProfile: {
    version: "HEIGHT_WINGSPAN_CM_V1"
    heightCm: 140..220 integer
    wingspanCm: 140..235 integer
  }

  tendencies
  archetypeTrait
  fatigueMilli
  chemistryMilli
}
```

Strict objects are required at each level.

## 4. Future expansion

Future ability content must use a new closed profile version, for example:

```text
P02_CORE_11_V1
P08_EXPANDED_ABILITIES_V2
```

Requirements:

- no unknown-key passthrough;
- no silent omission;
- explicit adapter between versions;
- adapter rules are content/rules authority and hashed;
- an engine supports only declared versions;
- no inference from rarity/position.

## 5. Strength

Definition:

> Functional basketball contact ability: core stability, lower-body leverage, screening stability, box-out stability and low-post contact.

Strength is:

- a match ability;
- separate from height and wingspan;
- available for future training/growth systems;
- consumed by P02-003 but not trained by P02-003.

Strength is not:

- weight;
- body width;
- visual body shape;
- rarity;
- height;
- athleticism.

## 6. Physical normalization

All derived values are integers in `0..100000`.

```text
heightMilli =
clamp(
  roundHalfUp((heightCm - 150) × 100000 / 55),
  0,
  100000
)
```

```text
absoluteWingspanMilli =
clamp(
  roundHalfUp((wingspanCm - 150) × 100000 / 70),
  0,
  100000
)
```

```text
wingspanAdvantageMilli =
clamp(
  roundHalfUp(
    (wingspanCm - heightCm + 10) × 100000 / 30
  ),
  0,
  100000
)
```

No hard rejection is applied to wingspan-minus-height beyond individual field ranges. Content validation may report warnings separately.

## 7. Execution blends

All terms use 0..100000 milli values and total 1000 weight.

### 7.1 Inside offense

```text
INSIDE_OFFENSE =
  500 finishing
+ 150 athleticism
+ 100 strength
+ 100 height
+  50 absoluteWingspan
+ 100 tacticalUnderstanding
```

### 7.2 Inside defense

```text
INSIDE_DEFENSE =
  400 interiorDefense
+ 100 athleticism
+ 100 strength
+ 150 height
+ 150 absoluteWingspan
+ 100 tacticalUnderstanding
```

### 7.3 Mid-range defense

```text
MID_RANGE_DEFENSE =
  450 perimeterDefense
+ 200 interiorDefense
+ 150 athleticism
+ 100 wingspanAdvantage
+ 100 tacticalUnderstanding
```

### 7.4 Three-point defense

```text
THREE_POINT_DEFENSE =
  650 perimeterDefense
+ 150 athleticism
+ 100 wingspanAdvantage
+ 100 tacticalUnderstanding
```

### 7.5 Post-up creation

```text
POSTUP_CREATION =
  400 ballHandling
+ 250 strength
+ 100 height
+  50 absoluteWingspan
+ 200 tacticalUnderstanding
```

### 7.6 Personal rebound

```text
PERSONAL_REBOUND =
  500 rebounding
+ 150 strength
+ 100 athleticism
+ 150 height
+ 100 absoluteWingspan
```

### 7.7 Box-out execution

```text
BOXOUT_EXECUTION =
  550 rebounding
+ 200 strength
+ 150 tacticalUnderstanding
+  50 height
+  50 athleticism
```

The existing BOXOUT result bonus remains `+4000`.

The deterministic boxer is the eligible candidate with highest BOXOUT_EXECUTION, tie by playerId UTF-16.

### 7.8 Inside contact

```text
INSIDE_CONTACT =
  450 finishing
+ 200 strength
+ 150 athleticism
+  50 height
+ 150 ballHandling
```

### 7.9 Inside shot protection

```text
INSIDE_SHOT_PROTECTION =
  450 finishing
+ 150 athleticism
+ 150 strength
+ 100 height
+  50 absoluteWingspan
+ 100 tacticalUnderstanding
```

### 7.10 Block execution

```text
BLOCK =
  450 interiorDefense
+ 150 athleticism
+ 150 height
+ 150 absoluteWingspan
+ 100 tacticalUnderstanding
```

### 7.11 Steal execution

```text
STEAL =
  550 perimeterDefense
+ 200 athleticism
+ 150 tacticalUnderstanding
+ 100 wingspanAdvantage
+ actionPressureModifier
```

### 7.12 Screen execution

```text
SCREEN =
  450 tacticalUnderstanding
+ 350 strength
+ 200 athleticism
```

### 7.13 Inside defensive control

```text
INSIDE_DEFENSIVE_CONTROL =
  400 interiorDefense
+ 150 strength
+ 100 athleticism
+ 100 height
+ 100 absoluteWingspan
+ 150 tacticalUnderstanding
```

### 7.14 Perimeter defensive control

```text
PERIMETER_DEFENSIVE_CONTROL =
  550 perimeterDefense
+ 200 athleticism
+ 200 tacticalUnderstanding
+  50 wingspanAdvantage
```

### 7.15 Unchanged blends

Blends with no old bodyImpact term remain unchanged unless explicitly listed above.

## 8. Single-consumption rules

### Shot defense

Height/wingspan enter the regional defensive execution once. No additional shot-probability subtraction is allowed.

### Block

BLOCK_ATTRIBUTION occurs only after a missed shot. It does not change the shot result.

### Steal

Wingspan enters steal/interception attribution. It does not additionally increase generic turnover occurrence.

### HELPD

HELPD execution uses positioning/awareness/athleticism only. Physical size is consumed later in actual contest/block/rebound stages.

### Rebound

Team offensive-rebound control and personal rebound attribution are separate stages. Within each stage, each factor appears once.

## 9. Forbidden derivations

No code may derive:

- height from position;
- wingspan from position;
- dimensions from rarity;
- strength from bodyImpact;
- body dimensions from art asset;
- weight from any field.
