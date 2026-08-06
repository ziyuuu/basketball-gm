# External Research Note

Date accessed: 2026-08-04

This note records narrow evidence used to avoid inventing category semantics. It does not import another game's formulas.

## 1. Basketball GM

Source: Basketball GM Manual — Players Customization  
Canonical page: https://basketball-gm.com/manual/customization/players/

Relevant design evidence:

- `hgt` is a gameplay height/length effect and explicitly also reflects standing reach and wingspan;
- `stre` is a separate strength rating;
- strength influences defense, rebounding and low-post scoring;
- jumping, rebounding, defensive IQ and other skills remain separate.

Adopted direction:

- separate strength from length;
- do not let a single body proxy represent all physical effects;
- retain distinct technical skills.

Not adopted:

- Basketball GM's single combined height/wingspan simulation rating;
- professional-player body ranges;
- its full rating dictionary or formulas.

## 2. NBA 2K official materials

Source: NBA 2K Support — NBA 2K26 Cap Breakers Return  
Canonical page: https://support.nba2k.com/hc/en-us/articles/44238406830995-NBA-2K26-Cap-Breakers-Return

Relevant evidence:

- height, weight and wingspan are treated as build dimensions that constrain attribute potential.

Source: NBA 2K25 official gameplay page  
Canonical page: https://nba.2k.com/ja-JP/2k25/the-game/gameplay/

Relevant evidence:

- defensive movement distinguishes ball-handler defense, off-ball movement and passing-lane obstruction.

Adopted direction:

- dimensions and skills are separate categories;
- pass-lane responsibility can be represented separately from on-ball pressure.

Not adopted:

- weight;
- player-controlled movement;
- badge/build-cap systems;
- geometry or animation logic.

## 3. FIBA Statisticians' Manual 2024

Source: FIBA Statisticians' Manual 2024, version 1.0  
Canonical PDF: https://assets.fiba.basketball/image/upload/documents-corporate-fiba-statisticians-manual-2024.pdf

Relevant assist rules:

- an assist is the last pass that leads directly to a teammate scoring;
- only the last pass before a shot can be an assist;
- a receiver may take a balancing dribble and still receive an assist;
- significant receiver action does not map cleanly to a universal hard rule;
- help-side defenders contesting a shot are not by themselves a reason to deny an assist;
- a missed shot and offensive rebound between pass and score ends the assist chain.

Relevant steal rules:

- a steal requires a corresponding turnover;
- interception or deflection of a pass can earn the steal;
- with multiple defenders, the first defender who initiated the deflection receives credit.

Adopted simplification:

- last legal pass + same segment + receiver/scorer identity establishes eligibility;
- existing ASSIST_ATTRIBUTION handles self-creation uncertainty;
- pass interception candidate approximates the initiating defender deterministically;
- no steal on dead-ball/unforced turnover.

## 4. Research boundary

These sources support category separation and attribution semantics only.

The exact P02 coefficients, candidate modifiers, caps and schema versions are Owner-approved project design, not claims about those external products.
