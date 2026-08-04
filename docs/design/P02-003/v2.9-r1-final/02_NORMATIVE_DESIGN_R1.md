# Normative Design v2.9-R1

## 1. Scope

This document replaces only:

- HELPD participant/result/fact rules;
- assist candidate clearing rules;
- physical/body execution inputs;
- limited defensive-duty responsibility;
- associated statistics and traceability.

All other v2.9 FINAL state-machine, basketball-event, PASS-chain, BOXOUT-classification and timing rules remain unchanged.

## 2. Defensive duty by current lineup slot

Duty is derived from the player's current assigned lineup slot, not primaryPosition.

| Slot | Duty |
|---|---|
| C | `RIM_ANCHOR` |
| PF | `RIM_HELPER` |
| SF | `WING_HELPER` |
| SG | `PERIMETER_INTERCEPTOR` |
| PG | `POINT_OF_ATTACK` |

A player in an off-position slot:

- receives that slot's duty availability;
- still receives the existing position-mismatch execution penalty where applicable;
- does not inherit dimensions from that slot.

### 2.1 Duty availability

Compute:

```text
effectiveSceneAvailabilityMilli =
roundHalfUp(
  ordinarySceneAvailabilityMilli
  × defensiveDutyAvailabilityMilli,
  1000
)
```

Use the existing behavior-weight formula with `effectiveSceneAvailabilityMilli`.

| Slot | HELPD | CONTEST | PRESS | STLTRY |
|---|---:|---:|---:|---:|
| C | 1000 | 1000 | 300 | 250 |
| PF | 900 | 950 | 500 | 450 |
| SF | 700 | 850 | 700 | 700 |
| SG | 400 | 750 | 850 | 900 |
| PG | 300 | 700 | 900 | 1000 |

These are `[FROZEN-FIRST-CANDIDATE]` values. B8 may calibrate numbers only through a version bump and complete scenario rerun.

## 3. HELPD

### 3.1 Meaning

HELPD is:

> A non-primary defender temporarily helps, collapses, delays or obstructs the current handler, then immediately returns to the existing abstract defensive responsibility.

HELPD is not:

- a switch;
- a persistent double team;
- a weak-side rotation;
- an open-player generator;
- a beneficiary-selection event.

### 3.2 Participants

```text
handlerId
onBallDefenderId
helperId
```

Constraints:

```text
handlerId belongs to offense current lineup
onBallDefenderId belongs to defense current lineup
helperId belongs to defense current lineup
helperId != onBallDefenderId
```

No `creatorId`, `beneficiaryId` or `helperAssignmentId` exists for HELPD.

### 3.3 Helper selection

Reuse:

```text
drawKind = BALL_HANDLER
localIndex = 3000 + defenseBehaviorSelectionOrdinal
```

Candidates:

```text
defense current lineup - onBallDefenderId
```

Candidate base weights by assigned slot:

| Slot | Weight |
|---|---:|
| C | 1000 |
| PF | 850 |
| SF | 650 |
| SG | 350 |
| PG | 250 |

Process:

1. derive candidate assigned slot from the current Anchor lineup;
2. exclude on-ball defender;
3. sort candidates by playerId UTF-16;
4. weighted keyed selection;
5. no candidate means HELPD scene availability must have been zero and the behavior is illegal.

### 3.4 Execution

```text
HELP_DEFENSE =
  0.40 interiorDefense
+ 0.25 perimeterDefense
+ 0.20 tacticalUnderstanding
+ 0.15 athleticism
```

```text
OFFENSE_HANDLING =
  0.50 ballHandling
+ 0.30 playmaking
+ 0.20 tacticalUnderstanding
```

```text
P_success =
clamp(
  0.50 + 0.002 × (HELP_DEFENSE - OFFENSE_HANDLING),
  0.20,
  0.80
)
```

HELPD does not consume strength, height or wingspan. Those factors are consumed in the actual contest/block/rebound stage.

RNG:

```text
drawKind = DEFENSIVE_ACTION
localIndex = 1000 + defenseBehaviorSelectionOrdinal
```

Results:

```text
SUCCESS
NO_EFFECT
```

### 3.5 Result consumption

SUCCESS:

```text
rawDelta = -10000
perEventEffective = -6000
```

NO_EFFECT:

```text
rawDelta = 0
perEventEffective = 0
```

Both outcomes:

- consume normal HELPD behavior time;
- leave handler unchanged;
- end with helper recovered;
- create no offensive CreationFact;
- create no beneficiary;
- create no pass or assist candidate;
- create no turnover or foul;
- create no defensive breakdown opportunity.

### 3.6 Required replacement of v2.9 text

Replace `05 §C.9` HELPD row with this section.

Delete from `06 §F.2`:

- HELPD beneficiary selection;
- HELPD use of `BALL_HANDLER 2000..2999`.

Replace the `06 §F.3` actor statement with:

> Offensive creation actors may populate CreationFact.creatorId. Defensive actors populate defensive-action or defensive-attribution facts only. A defensive actor must never populate an offensive CreationFact creator field.

Keep HELPD in the 44-ID classification as `SELECTABLE_ONE_DRAW`.

## 4. CreationFact

The allowed CreationFact behavior set remains:

```text
DRIVE
SHAKE
ISO
STEP_BACK
POSTUP
HIGH_POST_CREATION
SCREEN
CUT
HELDKICK
DOUBLECREATE
CREATIVE_PASS
```

HELPD is explicitly forbidden.

The existing constraints remain:

- creator and beneficiary belong to the possession side;
- source event is committed;
- one behavior source produces at most one CreationFact;
- delta records per-event effective value.

## 5. Assist candidate

### 5.1 Establishment

A successful PASS-family action establishes/replaces the candidate:

```text
AssistCandidate {
  passerId
  receiverId
  passFactId
  passSourceEventId
  period
  possessionIndex
  segmentIndex
}
```

PASS-family:

```text
PASS
HPASS
CREATIVE_PASS
ASTOPP
HELDKICK
```

No ASSIST event occurs at pass time.

### 5.2 Eligibility at a made field goal

The candidate is eligible if all are true:

1. scorer equals receiverId;
2. same period;
3. same possessionIndex;
4. same segmentIndex;
5. no later successful pass exists;
6. no turnover occurred after the pass;
7. no prior SHOT/FREE_THROW attempt occurred after the pass;
8. passer and scorer are different players.

CreationFact presence is irrelevant to eligibility.

The following do not automatically clear eligibility:

```text
DRIVE
SHAKE
ISO
STEP_BACK
POSTUP
HIGH_POST_CREATION
HELPD
CONTEST
PRESS
STLTRY
```

### 5.3 Attribution

On eligible made SHOT:

```text
ASSIST_EXECUTION =
  0.60 passer.playmaking
+ 0.20 passer.tacticalUnderstanding
+ 0.20 teamCoordination
```

```text
SELF_CREATION =
  0.45 scorer.ballHandling
+ 0.35 scorer.zonePrimaryAbility
+ 0.20 scorer.athleticism
```

```text
P_assist =
clamp(
  0.55 + 0.0025 × (ASSIST_EXECUTION - SELF_CREATION),
  0.15,
  0.90
)
```

Use the existing:

```text
drawKind = ASSIST_ATTRIBUTION
localIndex = 0
```

Success creates one ASSIST event. Failure creates none.

### 5.4 Candidate ending

The candidate ends when:

- another successful pass replaces it;
- receiver commits a turnover;
- possession ends;
- segment changes;
- any SHOT/FREE_THROW attempt occurs;
- the receiver is not the eventual shooter.

An offensive rebound always creates a new segment and therefore cannot preserve a pre-shot assist candidate.

### 5.5 Required implementation correction

Delete the invariant that an autonomous CreationFact after a pass automatically invalidates the assist.

Replace it with last-pass/same-segment/source-order validation.

## 6. Rim-protection candidate responsibility

BLOCK remains attribution after a missed inside/mid-range SHOT.

Block candidates remain:

- direct defender;
- at most one deterministic help candidate.

Help candidate score:

```text
blockHelpCandidateScore =
BLOCK_EXECUTION
+ dutyCandidateModifier
```

Duty candidate modifier:

| Assigned slot | Modifier |
|---|---:|
| C | +8000 |
| PF | +5000 |
| SF | +2500 |
| SG | +500 |
| PG | 0 |

Take the highest score; tie by playerId UTF-16.

The modifier chooses the candidate. It is not added to block attribution probability.

## 7. Pass-interception responsibility

For a PASS-family `PRESSURED_LIVE_BALL` turnover, select the steal candidate deterministically from the current defense lineup.

```text
PASS_INTERCEPTION_EXECUTION =
  0.50 perimeterDefense
+ 0.20 wingspanAdvantage
+ 0.15 athleticism
+ 0.15 tacticalUnderstanding
```

Duty candidate modifier:

| Assigned slot | Modifier |
|---|---:|
| PG | +6000 |
| SG | +5000 |
| SF | +2500 |
| PF | +1000 |
| C | 0 |

Candidate score:

```text
PASS_INTERCEPTION_EXECUTION + dutyCandidateModifier
```

Take highest; tie by playerId UTF-16.

Then use the existing `STEAL_ATTRIBUTION` draw.

The duty modifier selects responsibility only and is not added to the attribution success probability.

For non-pass pressured turnovers, retain the existing direct-defender steal-candidate rule.

## 8. Simplified defensive boundary

Required:

- slot duty;
- temporary HELPD and recovery;
- deterministic block-help candidate;
- deterministic pass-interception candidate;
- existing CONTEST/STLTRY/PRESS/DOUBLET behavior rules;
- facts sufficient for deterministic statistics.

Forbidden:

- x/y geometry;
- persistent matchup map;
- weak-side chain;
- second helper;
- switch tracking;
- zone rotation;
- low-man/tag/x-out;
- distance-based path simulation.

After HELPD, the next behavior derives direct defense from the unchanged lineup slots.
