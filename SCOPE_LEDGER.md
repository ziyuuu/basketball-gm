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

## Approved P01/P02 gameplay baseline scope

The Owner approved `docs/P02_GAMEPLAY_BASELINE.md` v1.1 on 2026-08-01. P01's engineering
guarantees remain frozen; its placeholder gameplay is replaced by this coherent P02 rules slice:

- every operation week has one team plan and one match slot; exam/wrap weeks have no player
  activity;
- standard/concentrated training, recovery, two minimum team activities, zero to three individual
  specializations, growth, costs, and readiness trade-offs;
- ten trainable abilities, one static body proxy, six fixed behavior tendencies, at most one
  single-level archetype trait, fatigue, and individual chemistry;
- individual chemistry is aggregated from the current on-court players and duties; no pair or
  fixed five-player combination state;
- about 22 active players into a 12-player formal/friendly roster, five starters, duties, position
  fit, deterministic assistant rotation for instant simulation, and manual non-forced
  substitutions in full-coach mode;
- one minimum budget and team-reputation loop;
- official, friendly, and scrimmage slots with strictly classified records;
- match preparation, three tactic axes, one incremental quarter/possession-chain Model B, keyed
  local randomness, settlement, and fact-based feedback;
- grade progression, graduation, and minimum archive data;
- deterministic scenario checks for strength gaps, fatigue, position mismatch, tactical fit, and
  rotation depth.

The separate `docs/P02_DEVELOPMENT_PLAN.md` v1.1 is Owner-approved. Implementation is authorized
only through its dependency-ordered Issue/PR flow, beginning with the non-gameplay P01-M1
integrity task; no later P02 slice may bypass that dependency.

P01-M1 has now merged through PR #7 after Gate #8 passed. The only active follow-on slice is
P02-001 (`task/p02-001-architecture-scaffold`): ADRs, Legacy P01 isolation, boundary enforcement,
and implementation evidence. It does not authorize P02 gameplay, Match/V2 production contracts,
or P02-002.

## Approved P02 exclusions

- complete card/deck/energy/hero/pause systems or production real-time card UI;
- 29 active attributes, complete tendency training, multilevel badges, morale, focus, pressure,
  injuries, and relationship matrices;
- formal recruitment generation, annual candidate probabilities, and sustainable roster renewal;
- complete friendly network, league/cup/national formats, detailed events, facilities, staff,
  tradition, or complex school operations;
- production match UI, five-minute playback, key moments, 2D court, drag interaction, final
  art/content, or one-year/three-year balance claims;
- parallel A/B/C research or a production Model C spike;
- LLM dialogue, Agent behavior, or model-provider integration.

## Deferred decisions

| Decision                                                                      | Earliest Gate              |
| ----------------------------------------------------------------------------- | -------------------------- |
| Annual candidate composition and roster sustainability                        | P03                        |
| Card-playability prototype and production UI-state/IA choice                  | P04                        |
| Whether cards enter the formal match experience; 2D value                     | P05                        |
| Full competition/operations, one-year balance, and injury evaluation          | P06                        |
| Complete three-year MVP balance and archive UI                                | P07                        |
| 29-attribute need, morale/focus/pressure need, tendencies, badges, statistics | P08                        |
| Breakthrough, 5★/6★, hall of fame, tradition, and inheritance                 | P09                        |
| Model-C research, if later evidence justifies it                              | Post-MVP research decision |
| LLM dialogue                                                                  | P10                        |
| Agent runtime                                                                 | P11                        |
