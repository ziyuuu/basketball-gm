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
- Model B/C.
- Opening 50-select-22 and annual-20 formal probabilities.
- Tournament formats and national competition structure.
- Detailed event system.
- Final reputation formula.
- Production UI, characters, art, or narrative content.
- Fun or balance claims.
- Any LLM/Agent behavior.

## Deferred decisions

| Decision                                                 | Earliest Gate |
| -------------------------------------------------------- | ------------- |
| Final match model and attributes                         | P02           |
| Annual candidate composition and roster sustainability   | P03           |
| Production information architecture and UI state library | P04           |
| Phaser/Canvas presentation value                         | P05           |
| Full one-year balance                                    | P06           |
| Complete three-year MVP balance                          | P07           |
| LLM dialogue                                             | P10           |
| Agent runtime                                            | P11           |
