# P02-001 Legacy P01 Mechanical Move Map

| Package                              | P01 source before P02-001                                                   | Legacy source after P02-001                 | Root behavior after P02-001                                                                                                                      |
| ------------------------------------ | --------------------------------------------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `@sunny-court/domain`                | `src/{constants,create-game,errors,hash,model-a,rng,schemas,time,index}.ts` | `src/legacy-p01/` with the same P01 modules | `src/index.ts` and former direct-module paths are thin re-exports; `src/core/rng-primitives.ts` holds only stream-agnostic seed/state primitives |
| `@sunny-court/application`           | `src/index.ts`                                                              | `src/legacy-p01/index.ts`                   | `src/index.ts` re-exports the same Legacy module                                                                                                 |
| `@sunny-court/persistence`           | `src/index.ts`                                                              | `src/legacy-p01/index.ts`                   | `src/index.ts` re-exports the same Legacy module                                                                                                 |
| `@sunny-court/persistence-node`      | `src/index.ts`                                                              | `src/legacy-p01/index.ts`                   | `src/index.ts` re-exports the same Legacy module                                                                                                 |
| `@sunny-court/persistence-indexeddb` | `src/index.ts`                                                              | `src/legacy-p01/index.ts`                   | `src/index.ts` re-exports the same Legacy module                                                                                                 |

All five `package.json` files now expose exact `./legacy-p01` subpaths. `tsconfig.json` and
`vitest.config.ts` define exact Legacy aliases before their root aliases. No implementation is
copied: root and Legacy paths resolve to the same runtime exports/classes.

P01 test files remain P01 regression tests. No CLI code, public command payload, save structure,
adapter semantics, or gameplay resolver was changed for this mechanical isolation.
