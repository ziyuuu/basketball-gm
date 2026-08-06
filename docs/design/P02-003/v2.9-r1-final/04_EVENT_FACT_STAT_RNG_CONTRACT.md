# Event, Fact, Statistic and RNG Contract

## 1. Closed enums

Unchanged:

- MatchEventType: 16 values;
- MatchDrawKind: 16 values;
- BehaviorId: 44 values;
- behavior classification: 34 selectable + 10 non-selectable.

No new enum value is authorized.

## 2. DefensiveActionFact

Use existing MatchFact container.

```text
DefensiveActionFactPayload {
  type: "DEFENSIVE_ACTION"

  behaviorId:
    | "HELPD"
    | "PRESS"
    | "DOUBLET"

  offenseSide: HOME | AWAY
  defenseSide: HOME | AWAY

  handlerId: string
  primaryDefenderId: string
  supportingDefenderIds: string[]

  result:
    | "SUCCESS"
    | "NO_EFFECT"
    | "FAILED_BREAKDOWN"
    | "FOUL"

  opportunityQualityDelta: integer
  breakdownOpportunity: boolean

  period: integer
  possessionIndex: integer
  segmentIndex: integer
}
```

Top-level MatchFact fields remain authoritative:

- factKind;
- sourceEventIds;
- localFactSequence;
- fact identity/hash.

### 2.1 HELPD fact

```text
behaviorId = HELPD
supportingDefenderIds = [helperId]
```

SUCCESS:

```text
result = SUCCESS
opportunityQualityDelta = -6000
breakdownOpportunity = false
```

NO_EFFECT:

```text
result = NO_EFFECT
opportunityQualityDelta = 0
breakdownOpportunity = false
```

Source:

- exactly the committed HELPD CLOCK_ADVANCED event;
- one HELPD source produces exactly one DefensiveActionFact;
- a HELPD source produces zero CreationFacts.

### 2.2 PRESS and DOUBLET

Existing gameplay results remain unless separately revised:

- successful action records SUCCESS;
- explicit failed advantage records FAILED_BREAKDOWN and positive capped delta;
- DOUBLET foul records FOUL;
- facts enable two-level breakdown statistics.

## 3. Opportunity-quality ledger

Retain:

```text
rawDelta
→ perEventEffective = clamp(rawDelta, -6000, +6000)
→ netPossessionDelta =
  clamp(sum(unique contributors), -6000, +6000)
→ finalOpportunityQuality =
  clamp(base + netPossessionDelta, 0, 100000)
```

Contributors:

- CreationFact opportunityQualityDelta;
- DefensiveActionFact opportunityQualityDelta.

Uniqueness:

- one source event may contribute at most one ledger delta;
- HELPD contributes only through DefensiveActionFact;
- logs/UI/fact-display switches cannot affect ledger application.

## 4. Defensive breakdown metrics

```text
defensiveBreakdownOpportunityEvents =
count(
  DefensiveActionFact
  where breakdownOpportunity == true
)
```

```text
defensiveBreakdownEvents =
count(
  breakdown source
  linked to a later made field goal
  by the linked advantage recipient/handler
  in the same possession
)
```

Rules:

- one source counts at most once;
- a miss counts only as opportunity, not realized breakdown;
- unrelated scorer does not realize the source;
- HELPD SUCCESS/NO_EFFECT never creates breakdown;
- metrics are analysis/Gate outputs, not box-score fields.

Rates:

```text
defensiveBreakdownOpportunityRate =
defensiveBreakdownOpportunityEvents
/ opponentHalfCourtPossessions
```

```text
defensiveBreakdownRate =
defensiveBreakdownEvents
/ opponentHalfCourtPossessions
```

Zero denominator reports null/not-applicable, never fabricated zero success.

## 5. tacticExecutionRate

```text
tacticExecutionOpportunities(side) =
existing offensive tactic opportunities
+ DefensiveActionFact opportunities for side
```

```text
successfulTacticExecutions(side) =
existing successful offensive tactic executions
+ DefensiveActionFact where result == SUCCESS
```

HELPD:

| Result | Opportunity | Success |
|---|---:|---:|
| SUCCESS | +1 | +1 |
| NO_EFFECT | +1 | +0 |

A HELPD source is never counted as an offensive CreationFact opportunity.

## 6. Assist fact/event causality

### Candidate source

The last committed PASS fact in the same:

- period;
- possessionIndex;
- segmentIndex;

whose receiver equals the shooter.

No later PASS fact may exist before the SHOT.

### Invalidating sources

Before the made SHOT, candidate is invalid if there is:

- TURNOVER;
- any prior SHOT;
- any prior FREE_THROW attempt;
- segment change;
- possession change;
- later successful PASS.

CreationFact is not an invalidating source.

### Event

ASSIST event:

- only after made SHOT;
- sourceEventId points to made SHOT;
- playerId equals eligible passer;
- at most one ASSIST per SHOT;
- uses ASSIST_ATTRIBUTION draw.

## 7. RNG and ordinals

All existing semantic ranges remain unchanged.

HELPD still consumes:

```text
BALL_HANDLER 3000 + defenseBehaviorSelectionOrdinal // helper
DEFENSIVE_ACTION 1000 + defenseBehaviorSelectionOrdinal // result
```

HELPD no longer consumes:

```text
BALL_HANDLER 2000 + defenseBehaviorSelectionOrdinal // deleted beneficiary
```

The semantic slot remains reserved/unconsumed. It is not reassigned.

Defensive-duty tables:

- do not add drawKinds;
- do not add ordinals;
- change deterministic candidate weights/availability only.

Block helper and pass interception candidates are deterministic selections and consume no actor draw.

## 8. Replay and hash

For the new rules version:

- Physical MatchInput fields enter canonical MatchInput identity;
- rules/content hash changes;
- matchInputHash changes;
- matchId and downstream Anchor/Event/Fact/Result identities change;
- step/runToEnd/replay must be identical within the new version.

Legacy:

- old MatchInput/replay/hash remain valid under legacy version;
- no migration rewrites historical identity;
- no cross-version equality assertion is permitted.

## 9. Fact switches

If the product supports hiding facts or logs, the simulation must still internally derive the same deterministic ledger and attribution inputs.

A display switch may omit presentation output only. It may not:

- skip a result draw;
- change a candidate;
- change opportunity delta;
- change assist attribution;
- change hashes of the authoritative protocol bundle for the same rules configuration.
