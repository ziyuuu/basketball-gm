# ADR-0005: MatchSession, anchors, keyed RNG, and transcript control boundaries

- Status: Accepted for P02-001
- Date: 2026-08-01

## Decision

Freeze the following future P02 engineering boundaries without implementing their types or
handlers in this slice:

- a MatchSession is local to one match and advances only from one committed Match Anchor to the
  next legal control boundary;
- an Anchor contains only committed match facts, not a pre-sampled future result;
- match randomness is derived from stable segment keys, not a mutable per-match draw cursor;
- accepted player, assistant, opponent, and rules decisions form a hash-chained transcript with
  identity, previous-anchor, control-boundary, local-revision, effective-fragment, and actor
  bindings;
- match, event, fact, result, and transcript identities are deterministic derivations of verified
  inputs and never wall-clock time, UUIDs, process order, or UI state.

P02-001 creates no MatchInput, MatchAnchor, MatchEvent, MatchSession, keyed-RNG, transcript, or
match resolver production code.

## Rationale

The approved gameplay baseline rejects whole-game future sampling because later decisions must not
replace already committed basketball facts. A bounded local session makes step, instant run, replay,
and future presentation consume one factual history while keeping player intervention from
consuming or reordering outcome randomness.

## Consequences

- Future match code must remain outside mutable GameState and persistence dependencies.
- A neutral command may not resample future outcomes or append an accepted transcript entry.
- Match facts and non-match settlement facts remain distinct identity domains.
- P01 sequential RNG behavior remains a Legacy regression surface and is not replaced here.

## Deferred ownership

- P02-002 owns the explicit contract, identity derivations, keyed RNG primitives, and transcript
  Schema.
- P02-003 owns the headless step/reducer/replay implementation.
- P02-008A owns whole-week integration; P02-009 owns player-facing local command handlers.

## Rollback

This ADR adds no match state or save data. Reverting P02-001 removes only the documented boundary
and scaffold, leaving P01 match model A, RNG, replay, and saves unchanged.

## Traceability

- `docs/P02_GAMEPLAY_BASELINE.md` §1.3, §11.2–11.3, §12.1–12.7, §15.2
- `docs/P02_DEVELOPMENT_PLAN.md` §2.3, §4.3–4.6, §7.2–7.3
- GitHub Issue #9, ADR-0005 acceptance
