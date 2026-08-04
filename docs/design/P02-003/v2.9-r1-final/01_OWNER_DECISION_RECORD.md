# Owner Decision Record — v2.9-R1

Date: 2026-08-04

## D1 — bodyImpact / strength

Decision: retain the gameplay concept as an explicit `strength` ability.

Interpretation:

- the product has a strength attribute;
- not introducing weight is a product/aesthetic boundary for an anime high-school-girls game;
- strength and weight are not synonyms;
- new physical snapshots use strength plus height plus wingspan;
- legacy bodyImpact is not treated as an authoritative strength value.

## D2 — versioning and future ability expansion

Decision: versioned dual snapshot variants.

Requirements:

- exact legacy P02-002 snapshot remains valid for old contract tests;
- new Model B uses a new strict variant;
- future ability expansions use new explicit profile versions;
- old engines must not silently ignore new abilities;
- new engines must not guess missing old abilities.

## D3 — wingspan on perimeter defense and steals

Decision: wingspan has a limited effect on:

- mid-range contest;
- three-point contest;
- pass interception;
- steal attribution.

It must not be counted twice in turnover occurrence and steal attribution.

## D4 — no rotation chain

Decision: no defensive rotation model.

HELPD:

- is a temporary help action;
- ends with immediate abstract recovery;
- does not create a persistent assignment change;
- does not expose a different offensive player;
- does not require a beneficiary.

## D5 — assist meaning

Owner clarification:

> An assist concerns a player receiving a pass and directly attacking/scoring. It is not determined by whether a separate opportunity-creation fact exists.

Normative interpretation:

- CreationFact cannot be a hard assist-break rule;
- an eligible last pass remains a candidate through receiver creation actions;
- the existing attribution formula handles scorer self-creation;
- a later pass, possession/segment boundary, turnover or intervening missed shot ends/replaces the candidate.

## D6 — breakdown metrics

Decision: retain two metrics.

- `defensiveBreakdownOpportunityEvents`: the defense created an actual conceded-advantage event;
- `defensiveBreakdownEvents`: the conceded advantage later resulted in a made field goal.

HELPD NO_EFFECT is not a breakdown.

## D7 — limited defensive duties

Decision: explicit but bounded position-duty bias.

Owner direction:

- interior players significantly increase rim-protection participation;
- forwards have moderate rim protection and interception;
- perimeter players have increased ball/pass stealing responsibility;
- routine rim help, wing obstruction and pass interception should not automatically create an open-player penalty.

Implementation interpretation:

- position duty changes availability and candidate selection;
- no hidden direct position success bonus;
- risky PRESS/DOUBLET may retain explicit failure consequences;
- ordinary HELPD/CONTEST/STLTRY failure is no effect rather than automatic leak.
