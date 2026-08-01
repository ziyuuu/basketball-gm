# ADR-0008: Authoritative numeric, hash, version, and cosmetic-RNG boundaries

- Status: Accepted for P02-001
- Date: 2026-08-01

## Decision

Freeze the future P02 authority rules without implementing fixed-point, canonical V2 hashing, or
V2 persistence in this slice:

- P02 durable abilities, finance, reputation, clocks, and statistics use integers; XP, fatigue,
  and personal chemistry use thousandth-point fixed integers with one half-up rounding boundary
  per approved settlement unit;
- Legacy P01 stable stringify/hash remains its current algorithm and output; V2 canonical/hash
  utilities are a separate future surface and never replace it;
- every future V2 authoritative object declares and validates engine, save-schema, rules, and
  content identities appropriate to its layer;
- only authoritative V2 RNG streams may be persisted; cosmetic randomness is stateless derivation
  or presentation-local state and is excluded from GameState, saves, audit, replay, match hash,
  and result authority.

P02-001 does not introduce `nextUint32`, fixed-point utilities, V2 canonical serialization,
keyed RNG, V2 hash code, engine/version changes, or any V2 Schema.

## Rationale

Deterministic simulation must not depend on binary floating-point display paths or cosmetic calls.
At the same time, the frozen P01 golden hashes are a regression contract, so a V2 identity system
must coexist rather than silently redefine historical save/replay behavior.

## Consequences

- Legacy tests continue to assert the existing `fnv64` results and P01 stream call counts.
- V2 compatibility checks will reject mismatched rules/content rather than trusting a save's own
  declaration.
- Future cosmetic assets may change without changing authoritative basketball outcomes.
- New authority code must live on explicit V2 paths until P02-008B performs the approved cutover.

## Deferred ownership

- P02-002 owns fixed-point/canonical/keyed-RNG implementation and golden tests.
- P02-004 owns V2 version constants, V2 content hashes, authoritative RNG bundle, and restore
  context.
- P02-008A owns V2 save/replay integration; P02-008B owns default entrypoint cutover.

## Rollback

This slice does not alter persisted numeric values, P01 hashing, engine version, or save schema.
A normal revert removes only this decision record and the Legacy scaffold; no save migration or
historical evidence rewrite is permitted.

## Traceability

- `docs/P02_GAMEPLAY_BASELINE.md` §12.3, §15.3, §17.1, §21.13–14
- `docs/P02_DEVELOPMENT_PLAN.md` §3.1–3.3, §4.5, §4.8, §7.2–7.3
- GitHub Issue #9, ADR-0008 acceptance
