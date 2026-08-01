# P02-001 Owner-Return Boundary Remediation

## Superseded identity

- Owner-rejected candidate: `930fb44cf773934c8a0c1f2a0f801f8f600df053`
- Fresh-audit-rejected candidate: `584143b97270275eefd8159b13639bbb90c2898d`
- Adversarial-review-rejected candidate: `e0d6a1a2e8659bfb0ee7baea8e06c2dbb2b63fbb`
- Fresh-audit-rejected candidate: `001c8166986f769930b2a914a50311bbd8acc99f`
- Formal-review-rejected candidate: `b1e61a09beef00939feaedbfd224d37d0be15521`
- Parent main: `5f3ed1cdd4a816e0c482f5161e86706eda1f4c60`
- Disposition: all five candidates were rejected and not merged
- Consequence: CI runs #24/#26/#28/#30/#32 and every audit tied to those SHAs are invalid for
  merge authorization

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

The next replacement candidate still lost protected capabilities through `new` expressions,
`Proxy`, dynamic code generation, property extraction, and general-purpose forwarding helpers.
Examples included `new Proxy(module.require.bind(null), {})`, `eval`, `Function`, derived
`.constructor` access, `Reflect.get`, and returned/forwarded callable values. Candidate
`e0d6a1a2e8659bfb0ee7baea8e06c2dbb2b63fbb` and CI run #28 were therefore invalidated before
merge authorization.

Candidate `001c8166986f769930b2a914a50311bbd8acc99f` still allowed a dynamic-code loader through
`globalThis.constructor.constructor` and `process.constructor.constructor`; the same capability
loss was reproducible through `module`, `Reflect`, and `Object.getPrototypeOf(Reflect)` constructor
chains. The fresh detached audit obtained exit 0 while Node executed an arbitrary-name state
resolver, so CI run #30 and that audit are invalid for merge authorization.

Candidate `b1e61a09beef00939feaedbfd224d37d0be15521` still downgraded
`module.constructor` to an ordinary function value. The exact review payload called its static
`_load` member with an absolute `__dirname` path, loaded `domain/src/index.cjs`, and executed the
aliased `fold` resolver. The checker incorrectly exited 0, while Node's exit 0 confirmed the bypass
was runtime-executable. CI run #32 and the earlier detached PASS are invalid for merge
authorization.

## Remediation design

- TypeScript AST extraction covers static imports/re-exports, import-equals, import types, dynamic
  imports, `require`, and `require.resolve`; protected paths reject non-static module specifiers.
- A single-file TypeScript `TypeChecker` keys loader capability propagation by actual binding symbol,
  not variable text. Fixed-point analysis follows aliases, reassignment, object destructuring,
  default values, static computed keys, `globalThis`, `module`, `process`, `createRequire`, and
  `getBuiltinModule` while preserving legitimate shadowed parameters.
- `new`, `Proxy`, `Reflect.get`, `Reflect.apply`, `bind`, `call`, and `apply` retain loader and
  dynamic-code capabilities. Function parameters/returns, IIFEs, object/class/array members, static
  and computed property keys, destructuring, and common built-in return paths are analyzed to a
  fixed point. Unsupported loader escape still fails closed instead of silently losing the edge.
- Ambient `eval`, `Function`, `globalThis` aliases, derived Function constructors, and their
  call/apply/bind/new forms are rejected in production source before generated code can hide a
  protected import. Symbol identity preserves legitimate local shadows and injected functions.
- Known runtime objects (`globalThis`, `module`, `process`, and `Reflect`) now propagate a function
  capability through their first static `constructor` access. `Object.getPrototypeOf` preserves
  either function-prototype or constructed-object capability, so a second constructor access cannot
  erase the dynamic-code path. Ordinary instance constructors remain non-codegen positive cases.
- `module.constructor` additionally retains a dedicated Node Module-constructor capability. Its
  static `_load` member becomes a loader capability instead of an ordinary unknown function
  property; the review's non-static absolute target therefore fails closed before execution.
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

`tests/p02-001-boundaries.test.ts` now runs two positive and 104 negative fixture roots. The four
Owner-blocking cases, no-suffix root, compatibility-wrapper reachability, approved
`operation-week-session` path, TypeScript path/baseUrl aliases, an unmanifested alias target,
dynamic import, and non-static import cases require exit 1 and independently assert their intended
diagnostic. Separate assertions cover arbitrary resolvers hidden under `core/**`, package-import
aliases and conditions, relative Match/Web edges, a source-derived package cycle, loader aliases,
loader escape, `new`/`Proxy` forwarding, dynamic code generation, property extraction, container
members, function returns, and call/apply/bind/Reflect forwarding. Separate positive cases prove
locally injected loader-like names and ordinary nested/custom constructors remain legal.
The five runtime-constructor-chain fixtures each exit 1 with exactly the dynamic-code diagnostic;
their runtime forms cover `globalThis`, `process`, `module`, `Reflect`, and
`Object.getPrototypeOf(Reflect)` without relying on a resolver name.
The separate `module.constructor._load` fixture reproduces the formal-review payload, still exits 0
when executed by Node 24.14.0, and now makes the checker exit 1 with exactly the non-static-loader
diagnostic.

After remediation:

- focused boundary suite: 106/106 passed;
- full `pnpm check`: 10 files / 137 tests passed, including Web and CLI builds;
- directed regression: 8 files / 133 tests passed;
- both frozen state/replay hash pairs remained unchanged;
- 1,000/1,000 batch runs completed with every failure/mismatch/violation count at zero;
- P00/P01/P01-M1 evidence trees and manifest file hashes remained unchanged.

This is implementation evidence only. A new remote candidate still requires fresh exact-SHA CI
and a fresh independent detached audit before PR #10 may return to `OWNER_CONFIRMATION`.
