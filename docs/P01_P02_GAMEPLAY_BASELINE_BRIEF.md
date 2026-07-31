# P01/P02 Gameplay Baseline Brief

> Task: `P02-000`
> Status: `READY_FOR_DESIGN`
> Implementation: prohibited until owner approval of the design baseline

## Purpose

Turn the placeholder game rules created to prove P01 engineering into a coherent management-game
slice, and design the P02 match experience that those management decisions feed into.

This task does not reopen the accepted P01 engineering foundation. It decides what the existing
gameplay concepts should mean before contracts, fixtures, formulas, or model B are implemented.

## Player-experience target

During a normal operation week, the player should make a small number of understandable choices
about people, preparation, and trade-offs. Those choices should visibly affect player development,
readiness, lineup options, match behavior, and post-match learning without requiring spreadsheet
micromanagement or a full professional-club economy.

## Questions the baseline must answer

1. What decisions does the player make each week, and how many?
2. Which player attributes, positions, roles, skills, and condition dimensions are necessary at
   MVP depth?
3. How do training and recovery create meaningful growth-versus-readiness trade-offs?
4. How does an approximately 22-player team become a 12-player match roster, starters, bench, and
   rotation?
5. What minimum budget and reputation rules create decisions without becoming a separate economy
   game?
6. What does the player decide before and during a match?
7. How do tactics interact with player fit and opponent behavior without producing one dominant
   answer?
8. What structured match result and post-match explanation help the player learn?
9. How do grade progression, graduation, and archives create short- and long-term feedback inside
   the existing three-year skeleton?

## Required design areas

- weekly loop and action budget;
- player model at MVP depth;
- training, recovery, growth, and condition;
- roster registration, starters, bench, positions, and rotation;
- minimum budget and reputation loops;
- match preparation and tactical choices;
- simplified quarter/possession-chain match flow;
- match settlement, statistics, explanation, and learning feedback;
- grade progression, graduation, and archive feedback;
- relationships among those systems across one week and one school year.

## Scope boundaries

The following are not part of this baseline:

- formal annual recruitment probabilities, candidate generation, or roster sustainability;
- full tournament and national-competition structures;
- detailed random events, facilities, staff, tradition, or school-management subsystems;
- production UI, final content/art, or final numerical balance;
- model C or a parallel A/B/C implementation study;
- LLM dialogue, Agent behavior, or API integration.

The design may state the minimum interfaces later systems will need, but must not design those
systems early.

## Match-model decision

- Target one simplified quarter/possession-chain model for the MVP.
- Model A remains only as an engineering regression reference.
- Model C is removed from the MVP path.
- Replace large comparative experiments with a small scenario suite:
  - clear strength gap;
  - high fatigue versus recovered lineup;
  - correct positions versus position mismatch;
  - tactic suited or unsuited to the opponent;
  - shallow versus deep rotation.

The scenario suite checks that the design responds in the intended direction. It is not a demand
for production balance or statistical research.

## Required deliverable

Produce one owner-reviewable gameplay baseline containing:

1. design principles and intended player experience;
2. the weekly decision loop;
3. concrete MVP rules for every required design area;
4. the minimum data concepts and state transitions those rules require;
5. the match decision loop and player-facing feedback;
6. a table mapping each mechanic to its purpose, cost/trade-off, feedback, and scenario check;
7. explicitly deferred items and unresolved decisions;
8. a recommended implementation sequence after approval.

The document must distinguish:

- frozen project facts;
- proposed design decisions;
- evidence from repository code;
- evidence from external research;
- unresolved owner choices.

Do not hide a major choice inside vague wording such as “appropriately,” “dynamically,” or
“balanced.” Give a concrete MVP rule or present a small set of alternatives with a recommendation.

## Working method

1. Read the live repository, especially `AGENTS.md`, `PROJECT_LEDGER.md`, `SCOPE_LEDGER.md`, this
   brief, P01 schemas/constants/time/model-A code, and P01 evidence.
2. Inspect the actual placeholder mechanics before proposing replacements.
3. Research relevant basketball-management and sports-management games plus credible basketball
   coaching/simulation sources. Cite live sources and distinguish observation from inference.
4. Draft a complete initial model before interviewing the owner.
5. Use the `grill-me` process one consequential question at a time to resolve choices.
6. Revise the complete baseline after the interview; do not implement code or change GitHub.

## Acceptance

The baseline is ready for owner approval when:

- a reader can describe what the player does in a week and around a match;
- each included state or attribute changes at least one real decision or feedback surface;
- training, roster, tactics, condition, budget/reputation, and match feedback form one connected
  loop;
- there is no universal lineup or tactical answer by design;
- scope remains inside existing P01/P02 content;
- implementation can be split into tasks without inventing missing gameplay rules.
