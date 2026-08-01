# ADR-0004: Legacy P01 / future V2 isolation and deferred default cutover

- Status: Accepted for P02-001
- Date: 2026-08-01

## Decision

Treat the frozen P01 implementation as an explicit Legacy surface while P02 is developed in
parallel:

- the five P01 package surfaces are available through the fixed `legacy-p01` subpaths;
- the current unqualified package roots remain thin P01 compatibility re-exports;
- no default package root, application entrypoint, persistence adapter, CLI entrypoint, or Web
  state path changes to V2 in P02-001;
- P01 Node persistence and the IndexedDB default name `sunny-court-manager-saves` remain intact;
- future V2 persistence uses a new namespace only when its explicit adapters are introduced.

Only P02-008B may remove the compatibility re-exports and make V2 the default root surface.

## Rationale

P01 golden replays, save integrity evidence, and persistence contracts remain active regression
assets while the P02 contracts are built. Moving the P01 implementation under an explicit path now
creates an auditable boundary without asking callers to accept a half-migrated V2 state model.
Separating the eventual default switch makes a functional V2 rollback independent from a
production-entry rollback.

## Consequences

- P01 callers continue to work through their existing root imports during P02-001 through
  P02-008A.
- New Legacy-internal cross-package imports use explicit `/legacy-p01` paths.
- Future V2 production modules must not import Legacy code; root wrappers are narrow, temporary
  compatibility edges rather than a general exemption.
- No P01 save is migrated, renamed, or reinterpreted in this slice.

## Deferred ownership

- P02-004 owns the explicit V2 Schema, SaveEnvelope, and new storage namespace.
- P02-008A owns the explicit V2 functional closure.
- P02-008B owns the root-export, default adapter, and CLI cutover/removal of these compatibility
  wrappers.

## Rollback

Before merge, close the P02-001 PR and discard its branch. After merge, use a normal revert PR to
restore the P01 root layout and exports; do not reset, force-push, migrate saves, or alter P01
evidence. The P01-M1 integrity fixes and P01 storage semantics remain unchanged either way.

## Traceability

- `docs/P02_DEVELOPMENT_PLAN.md` §2.2, §3.2, §7.2, §7.9B, §10.2–10.3
- `docs/P02_GAMEPLAY_BASELINE.md` §15.3, §19.2
- GitHub Issue #9, Legacy P01 mechanical isolation and rollback acceptance
