# Scope Ledger

## Frozen product facts

| Area        | Binding rule                                                                                                    |
| ----------- | --------------------------------------------------------------------------------------------------------------- |
| Product     | Pure single-player; no IAP, commercial gacha, online competition, account economy, or anti-save-scumming system |
| Player role | Team manager and head coach                                                                                     |
| Setting     | Chinese ordinary high-school girls' basketball team                                                             |
| Lifecycle   | Players have three high-school grades; school/team assets survive cohort turnover                               |
| Calendar    | Two terms per year; 20 weeks per term; 16 operation weeks plus 4 exam/wrap weeks                                |
| Roster      | About 22 active players; formal tournament roster is 12 and later becomes lockable                              |
| Saves       | Manual saves, reloads, multiple slots, and rollback are allowed                                                 |
| Simulation  | Fast result, text presentation, and any future 2D replay must consume the same structured result                |
| LLM         | Optional future enhancement; the non-LLM game must be complete                                                  |
| Visual      | Pixel-management UI/environment plus non-pixel anime character presentation; V2 art remains reference-only      |

## P00 in scope

- pnpm workspace and package boundaries.
- React/Vite Web shell and Node sim CLI shell.
- Node/pnpm/TypeScript version pinning.
- Strict type checking, linting, formatting, unit tests, builds, and CI.
- Architecture, contribution, scope, ADR, task, PR, Gate, and evidence templates.
- Production-source scan for model SDKs/API-key identifiers.
- Content manifest and unique-character Schema spike.
- T00 visual tokens only; no T00 component code.

## P00 out of scope

- Production UI or interaction architecture.
- Basketball formula, final attributes, final character values, final content, or production art.
- Model provider, API keys, LLM SDK, dialogue, memory, or Agent logic.
- Sites deployment and desktop shell.

## P01 in scope

- Serializable `School`, `Team`, `Player`, `Season`, `Week`, budget, reputation, match summary, and career archive states.
- Atomic command bus and stable reason codes.
- Independent deterministic RNG streams.
- Three-year time finite-state machine.
- Prototype training, growth, fatigue, budget, graduation, and career archive.
- Prototype match model A.
- Versioned save envelope, state hash, checksum, rolling backup, and memory/file/IndexedDB adapters.
- Headless single-run and batch CLI.
- Round-trip, replay, invariant, transaction, persistence, and 1,000-run Gate tests.

## P01 explicitly not frozen

- Final basketball attributes or tuning.
- P01 gameplay placeholder rules: weekly decisions, training effects, budget pressure, reputation
  effects, automatic roster selection, and feedback.
- Model B. Model C is not an MVP requirement.
- Opening 50-select-22 and annual-20 formal probabilities.
- Tournament formats and national competition structure.
- Detailed event system.
- Final reputation formula.
- Production UI, characters, art, or narrative content.
- Fun or balance claims.
- Any LLM/Agent behavior.

## Current P01/P02 gameplay baseline scope

P01's engineering guarantees remain frozen. Its placeholder gameplay and P02's match gameplay are
now designed together as one coherent MVP rules slice:

- weekly player decision loop and action budget;
- player attributes, positions, roles, skills, fatigue, morale, focus, and pressure at MVP depth;
- training and recovery choices, growth, costs, and trade-offs;
- active roster of about 22 players into a 12-player match roster, starters, bench, rotation, and
  position fit;
- minimum budget and reputation loops only where they change current decisions;
- match preparation, tactics, one simplified quarter/possession-chain model, settlement, and
  explainable post-match feedback;
- grade progression, graduation, archives, and their feedback to the player;
- a small set of deterministic scenario checks for strength gaps, fatigue, position mismatch,
  tactical fit, and rotation depth.

The baseline is a design deliverable first. It must be approved before gameplay implementation,
public match contracts, or balancing fixtures are frozen.

## Current P01/P02 gameplay baseline exclusions

- parallel A/B/C model research or a production model-C spike;
- formal recruitment generation, annual candidate probabilities, and sustainable roster renewal;
- complete tournament formats, detailed events, facilities, staff, tradition, or school operations;
- production UI, final art/content, full-year or three-year balance claims;
- LLM dialogue, Agent behavior, or model-provider integration.

## Deferred decisions

| Decision                                                 | Earliest Gate              |
| -------------------------------------------------------- | -------------------------- |
| MVP match model and core gameplay attributes             | P01/P02 gameplay baseline  |
| Annual candidate composition and roster sustainability   | P03                        |
| Production information architecture and UI state library | P04                        |
| Phaser/Canvas presentation value                         | P05                        |
| Full one-year balance                                    | P06                        |
| Complete three-year MVP balance                          | P07                        |
| Model-C research, if later evidence justifies it         | Post-MVP research decision |
| LLM dialogue                                             | P10                        |
| Agent runtime                                            | P11                        |
