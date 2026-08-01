# P02-001 Verification Report

This is implementation-thread verification, not an independent Gate decision.

## Environment

- Node: `v24.14.0`
- pnpm: `11.7.0`
- Parent main: `5f3ed1cdd4a816e0c482f5161e86706eda1f4c60`
- Branch: `task/p02-001-architecture-scaffold`

The first frozen install required an isolated writable XDG data directory because this runtime does
not provide `/root/.local`; it did not change repository files. The successful command was:

```bash
XDG_DATA_HOME=/tmp/p02-001-xdg pnpm install --frozen-lockfile
```

## Baseline before change

`pnpm check` passed with 8 test files / 29 tests, formatting, lint, TypeScript, boundaries, Web
build, and CLI build all successful.

## Owner-return boundary remediation

Remote candidate `930fb44cf773934c8a0c1f2a0f801f8f600df053` was returned without merge after
four false-negative fixtures exposed gaps in the boundary checker. Its CI run #24 and prior audit
PASS are invalid for any later candidate.

Before changing the checker, each isolated fixture below incorrectly exited 0:

- `negative-core-imports-v2`;
- `negative-v2-imports-legacy-root`;
- `negative-match-imports-resolver`, using the unrelated resolver name `fold` and no Legacy import;
- `negative-cli-resolver`, importing and calling `fold` through an alias.

The remediation replaces function-name matching with TypeScript-AST import records, resolved
workspace/package-import/TypeScript-path module edges, explicit Legacy compatibility-root
classification, transitive Legacy/V2 reachability, an exact Match RNG-primitive + `match/**`
allowed surface, and a fail-closed CLI read-only domain import list. Wildcard precedence,
conditional and legacy package entrypoints, `baseUrl`, deep imports, out-of-graph/test bridges,
Vite loaders/HTML entries, Node/CommonJS loaders, triple-slash references, and source-query suffixes
are covered. The fixture suite now has one positive fixture and 38 negative fixtures. The four
Owner-blocking cases plus approved-path, compatibility-wrapper, TypeScript alias,
dynamic/non-static import, relative cross-package, and source-derived cycle cases have explicit
assertions.

## Final checks

```bash
pnpm check
```

Passed: formatting, ESLint, TypeScript, boundary check, Web build, CLI build, and 10 test files /
70 tests. The original 29 tests remain; P02-001 adds 41 scaffold/boundary tests.

```bash
pnpm exec vitest run \
  packages/domain/src/rng.test.ts \
  packages/application/src/index.test.ts \
  packages/persistence/src/index.test.ts \
  packages/persistence-node/src/index.test.ts \
  packages/persistence-indexeddb/src/index.test.ts \
  tests/p01-three-year.test.ts \
  tests/p02-001-boundaries.test.ts \
  tests/p02-001-legacy-subpaths.test.ts
```

Passed: 8 test files / 66 tests. This includes P01-M1's 17 re-signed attack rejections, eight legal
annual-grant boundaries, root/Legacy export identity, memory latest→backup equivalence, Node and
IndexedDB persistence tests, and isolated boundary positive/negative fixtures.

`pnpm boundaries` passed with 9 packages/apps and reports no package cycle, domain isolation, and
Legacy/V2 boundary enforcement. The negative fixtures prove rejection of direct and transitive
V2→Legacy (including no-suffix roots and thin wrappers), Legacy→V2, core→Legacy/V2,
match→application/persistence or mutable state, Web import/dependency, arbitrary-name CLI domain
mutation imports, non-static imports, relative cross-package edges, and manifest- or source-derived
package cycles. Package-import and TypeScript path aliases, wildcard precedence, conditional
targets, `baseUrl`, and unmanifested internal targets are resolved or rejected fail-closed.

Historical integrity checks passed:

```bash
(cd evidence/P00 && sha256sum -c manifest.sha256)
(cd evidence/P01 && sha256sum -c manifest.sha256)
(cd evidence/P01-M1 && sha256sum -c manifest.sha256)
```

All listed historical files validated. Manifest file hashes remained:

- P00: `1767e99b78e7af8e39c3a530352e57d243ce1394c80f7b4eed8374cbeec62d3a`
- P01: `2108049b75f2ecbaa3cc7c2fc0b4605ff5ffd7c6ecd635f22c282113cbfa9716`
- P01-M1: `885002c5dfb78cc9141e66ea651eedd2ebc9912f588cedf37efd73fc9bca971d`
