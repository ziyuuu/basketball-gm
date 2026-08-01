# P02-001 Owner-Return Boundary Remediation

## Superseded identity

- Owner-rejected candidate: `930fb44cf773934c8a0c1f2a0f801f8f600df053`
- Fresh-audit-rejected candidate: `584143b97270275eefd8159b13639bbb90c2898d`
- Parent main: `5f3ed1cdd4a816e0c482f5161e86706eda1f4c60`
- Disposition: both candidates were rejected and not merged
- Consequence: CI runs #24/#26 and every audit tied to either SHA are invalid for merge
  authorization

## Pre-fix reproduction

The four Owner-provided cases were installed as independent fixtures and run against the old
checker before its implementation changed. Every command incorrectly returned exit 0:

```bash
node scripts/check-boundaries.mjs --fixture tests/fixtures/boundaries/negative-core-imports-v2
node scripts/check-boundaries.mjs --fixture tests/fixtures/boundaries/negative-v2-imports-legacy-root
node scripts/check-boundaries.mjs --fixture tests/fixtures/boundaries/negative-match-imports-resolver
node scripts/check-boundaries.mjs --fixture tests/fixtures/boundaries/negative-cli-resolver
```

The Match fixture imports `fold` from `domain/src/state/fold.mjs`; it has no Legacy, application, or
persistence import. The CLI fixture imports `fold as execute` from the real thin Legacy-compatible
domain root and calls it. Therefore neither fixture depends on the old `resolveCurrentWeek` literal,
and the Match fixture cannot pass because of a simultaneous V2→Legacy violation.

The first replacement candidate still parsed CommonJS loaders by direct callee spelling. Its fresh
detached audit independently placed the following form in each of the same four protected zones:

```js
const load = require;
load('protected-module');
```

All four variants incorrectly returned exit 0. Candidate `584143b97270275eefd8159b13639bbb90c2898d`
and CI run #26 were therefore invalidated before merge authorization.

## Remediation design

- TypeScript AST extraction covers static imports/re-exports, import-equals, import types, dynamic
  imports, `require`, and `require.resolve`; protected paths reject non-static module specifiers.
- A single-file TypeScript `TypeChecker` keys loader capability propagation by actual binding symbol,
  not variable text. Fixed-point analysis follows aliases, reassignment, object destructuring,
  default values, static computed keys, `globalThis`, `module`, `process`, `createRequire`, and
  `getBuiltinModule` while preserving legitimate shadowed parameters.
- `bind`, `call`, and `apply` invocation forwarding retains loader/factory capabilities. Unsupported
  wrappers, containers, returns, exports, member access, dynamic keys, or cross-file loader escape
  fail closed instead of silently losing the edge.
- Relative, workspace-package, `package.json#imports`, `tsconfig.paths`, and `baseUrl` specifiers
  resolve to real source targets, including `.js` to `.ts` mapping and wildcard specificity.
  Conditional package targets and matched-but-unresolved TypeScript aliases fail closed.
- Production source collection covers every `apps/**/src` and `packages/**/src` path, including a
  TypeScript path target in a directory without its own package manifest. Root/baseUrl sources,
  out-of-graph relative targets, test bridges, and triple-slash references cannot hide an edge.
- Workspace `exports`, legacy `browser/module/main/types/typings` entrypoints, and legal deep imports
  without `exports` are resolved or rejected fail-closed. Vite query/glob/HTML module entrypoints
  and Node/CommonJS dynamic loaders cannot bypass the graph.
- A file-level dependency graph propagates Legacy/V2 reachability through thin wrappers and adds
  source-derived package edges and cycle detection.
- The five unqualified package roots remain explicitly classified as Legacy compatibility roots;
  their `exports["."]`, exact `./legacy-p01` export, and thin re-export source are checked.
- The existing domain top-level compatibility files are an exact, content-checked whitelist. New
  production files in the five migrated packages default to V2 unless they are Legacy or core.
- Core cannot directly or transitively reach Legacy or V2, and only the frozen
  `core/rng-primitives.ts` production surface may exist in this slice.
- Match workspace imports are fail-closed to that exact RNG primitive or `domain/match/**`,
  independent of imported function names; placing a mutator elsewhere under `core/**` also fails.
- CLI may retain only the frozen P01 read-only root imports used by the existing runner; arbitrary
  value imports, aliases, subpaths, namespace/default forms, and dynamic imports fail.
- Web, Match, undeclared-dependency, and cycle rules also inspect resolved relative cross-package
  edges.

## Independent negative proof

`tests/p02-001-boundaries.test.ts` now runs two positive and 54 negative fixture roots. The four
Owner-blocking cases, no-suffix root, compatibility-wrapper reachability, approved
`operation-week-session` path, TypeScript path/baseUrl aliases, an unmanifested alias target,
dynamic import, and non-static import cases require exit 1 and independently assert their intended
diagnostic. Separate assertions cover arbitrary resolvers hidden under `core/**`, package-import
aliases and conditions, relative Match/Web edges, a source-derived package cycle, loader aliases,
loader escape, and forwarded CommonJS/Node loader calls. A separate positive fixture proves locally
injected `require` and `globalThis` parameters do not inherit ambient loader capability.

After remediation:

- focused boundary suite: 56/56 passed;
- full `pnpm check`: 10 files / 87 tests passed, including Web and CLI builds;
- directed regression: 8 files / 83 tests passed;
- both frozen state/replay hash pairs remained unchanged;
- 1,000/1,000 batch runs completed with every failure/mismatch/violation count at zero;
- P00/P01/P01-M1 evidence trees and manifest file hashes remained unchanged.

This is implementation evidence only. A new remote candidate still requires fresh exact-SHA CI
and a fresh independent detached audit before PR #10 may return to `OWNER_CONFIRMATION`.
