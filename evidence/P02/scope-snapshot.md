# P02-001 Scope Snapshot

## Identity

- Task: GitHub Issue #9
- Parent main: `5f3ed1cdd4a816e0c482f5161e86706eda1f4c60`
- P01-M1 dependency: PR #7 merged; independent Gate #8 PASS
- Branch: `task/p02-001-architecture-scaffold`
- Engine: `0.1.2-p01-r2` (unchanged)
- Save Schema: `0.1.0` (unchanged)

## Included

- ADR-0004 through ADR-0008 implementing the approved architecture decisions as records only.
- Explicit P01 Legacy package subpaths for domain, application, persistence, Node persistence, and
  IndexedDB persistence.
- Thin P01 root compatibility re-exports, exact package exports, TypeScript paths, and priority
  Vitest aliases.
- Stateless, stream-agnostic RNG seed/state primitives under `domain/core`; P01 stream names,
  bundle Schema, call counts, and sequential behavior stay in Legacy.
- Boundary checks with symbol-aware TypeScript-AST import extraction, loader capability/escape
  and dynamic-code analysis, package/TypeScript alias resolution, resolved module/package graphs,
  transitive Legacy/V2 reachability, runtime-object constructor-chain propagation, two positive
  fixtures, and 103 demonstrably failing negative fixtures.
- P01 root/Legacy identity and persistence-contract regression coverage.
- P02 implementation evidence and independent P02 manifest support.

## Excluded

- MatchInput, MatchAnchor, MatchEvent, MatchSession, match resolver, fixed-point, canonical V2
  hash, keyed RNG, V2 GameState, V2 SaveEnvelope, V2 storage adapters, or migration.
- Training, growth, roster, tactics, rotation, weekly settlement, feedback, FULL_COACH, UI, LLM,
  Agent, network, content-p02, or any gameplay-value adjustment.
- Root default-entry cutover, CLI cutover, P01 storage rename, and deletion of root compatibility
  wrappers; these belong to P02-008B.

## Frozen regression obligation

The P01 root APIs remain P01. `state`, RNG snapshots/call counts, events/audit, replay, saves,
latest/backup semantics, frozen golden hashes, Engine `0.1.2-p01-r2`, Save Schema `0.1.0`, and the
IndexedDB default name `sunny-court-manager-saves` must remain unchanged.
