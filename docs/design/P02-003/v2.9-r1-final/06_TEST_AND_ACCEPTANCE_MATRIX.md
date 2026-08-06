# Test and Acceptance Matrix

## A. Schema

### Positive

- legacy snapshot parses unchanged;
- physical snapshot parses with exact version strings;
- all 11 abilities accept integer 0..100;
- height/wingspan boundary values parse;
- Model B accepts Physical variant.

### Negative

Reject:

- unknown ability key;
- missing strength;
- missing height/wingspan;
- float physical dimensions;
- physical value outside range;
- Model B legacy variant;
- bodyImpact in Physical variant;
- weight field;
- primary/secondary duplicate position.

## B. No fabricated body data

Verify:

- changing primaryPosition does not change physical profile;
- changing rarity does not change physical profile;
- fixture builder requires explicit physical data;
- no fallback derives strength from bodyImpact;
- no fallback derives height from slot.

## C. Strength monotonicity

Fixed other inputs:

- higher strength does not lower POSTUP;
- higher strength does not lower SCREEN;
- higher strength does not lower BOXOUT;
- higher strength does not lower inside defensive control;
- higher strength does not alter three-point offense.

## D. Height/wingspan monotonicity

Fixed other inputs:

- higher height does not lower inside defense;
- higher height does not lower rebound execution;
- higher absolute wingspan does not lower block execution;
- higher wingspan advantage does not lower mid/three defense;
- higher wingspan advantage does not lower interception/steal execution;
- dimensions do not alter pass-selection tendency;
- dimensions do not alter shooting ability.

## E. Single consumption

- wingspan enters shot defense once;
- CONTEST adds no second wingspan subtraction;
- BLOCK attribution cannot change made/missed result;
- wingspan does not increase both pass turnover occurrence and steal attribution;
- HELPD does not consume physical values;
- one HELPD source contributes at most one opportunity delta.

## F. HELPD participants and keys

Positive:

- helper belongs to defense lineup;
- helper differs from direct defender;
- candidate input reorder does not change result;
- helper key is BALL_HANDLER 3000+ordinal;
- execution key is DEFENSIVE_ACTION 1000+ordinal.

Negative:

Reject:

- empty helper candidate after HELPD selected;
- helper outside lineup;
- helper equals direct defender;
- beneficiary field;
- creator field;
- HELPD CreationFact;
- HELPD beneficiary draw.

## G. HELPD outcomes

SUCCESS:

- delta -6000;
- one DefensiveActionFact;
- no CreationFact;
- no breakdown;
- next direct matchup unchanged.

NO_EFFECT:

- delta 0;
- one DefensiveActionFact;
- no CreationFact;
- no breakdown;
- no positive opportunity delta;
- next direct matchup unchanged.

## H. Defensive duty

- duty derived from assigned slot;
- substitution recomputes duty;
- swapping slot changes availability distribution;
- slot does not alter final execution formula;
- candidate tie resolves by UTF-16 playerId;
- duty tables enter rules/content hash.

## I. Block candidate

- C receives highest candidate modifier;
- PF next, SF moderate;
- high actual execution SF can still beat low execution C after modifiers;
- candidate input reorder stable;
- no actor draw;
- final block probability excludes candidate modifier.

## J. Pass interception

- only PASS-family pressured turnover uses interception candidates;
- PG/SG receive larger candidate modifiers;
- SF remains viable;
- candidate modifier not added to steal probability;
- no extra draw;
- FIBA-style first-deflector approximation is deterministic;
- unforced/dead-ball turnover cannot produce steal.

## K. Assist

Positive eligibility:

- last PASS receiver makes in same segment;
- PASS → DRIVE → made shot remains eligible;
- PASS → POSTUP → made shot remains eligible;
- CreationFact between pass and make does not clear candidate;
- HELPD between pass and make does not clear candidate.

Invalid:

- later successful pass;
- scorer not receiver;
- segment changed;
- prior missed SHOT;
- ORB then score;
- turnover;
- self-assist;
- no PASS fact.

Attribution:

- exactly one ASSIST_ATTRIBUTION draw;
- failed attribution produces no ASSIST;
- at most one ASSIST per made SHOT.

## L. Fact and ledger

Reject:

- fact source outside match;
- wrong coordinates;
- HELPD source with zero or two DefensiveActionFacts;
- HELPD source with CreationFact;
- two ledger contributions from same source;
- cross-team defensive participants.

## M. Breakdown metrics

- HELPD NO_EFFECT not counted;
- HELPD SUCCESS not counted;
- PRESS/DOUBLET FAILED_BREAKDOWN counted as opportunity;
- made linked field goal realizes one breakdown;
- miss does not realize;
- unrelated scorer does not realize;
- zero denominator is null/not-applicable.

## N. Identity and replay

Within new version:

```text
step == runToEnd == replay
```

Compare:

- Event arrays;
- Fact arrays;
- Transcript;
- Anchors;
- final result;
- hashes.

Across versions:

- legacy hash unchanged;
- physical-version hash differs;
- no cross-version event equality requirement.

## O. Regression

Must pass:

- P02-002 schema/canonical/fixed-point/RNG/effect tests;
- Legacy P01 regression;
- existing PASS chain tests;
- existing BOXOUT tests;
- B1–B6 updated focused tests;
- full pnpm check.
