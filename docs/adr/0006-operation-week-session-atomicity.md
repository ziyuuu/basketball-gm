# ADR-0006: OperationWeekSession source identity, CAS, and all-or-nothing settlement

- Status: Accepted for P02-001
- Date: 2026-08-01

## Decision

The future P02 operation-week workflow is a local work session, not an incrementally persisted
GameState mutation:

- OperationWeekSession starts from a cloned committed source and records source revision, state
  hash, authoritative RNG hash, plan/setup or scrimmage input identity, control strategy, and
  content identity;
- normal completion uses expectedRevision/CAS and validates all recorded source identities again;
- training, costs, MatchSession work, records, fatigue, growth, lifecycle effects, and calendar
  advance become global facts only in one successful whole-week commit;
- an explicit exit, local failure, session corruption, watchdog failure, final CAS conflict, or
  global validation failure discards the work copy with zero global pollution.

P02-001 does not create an OperationWeekSession, capability, handler, settlement draft, or V2
state mutation.

## Rationale

The P01 invariant prohibits future budget or match facts from being written before their calendar
week is settled. The approved P02 loop requires much richer work before a week can complete, so
its failure boundary must be explicit before new state or save contracts are introduced.

## Consequences

- No P02 match may be saved mid-session in the approved P02 scope.
- Failed local operations cannot advance revision, consume authoritative global RNG, write ledger
  entries, or append audit facts.
- Application owns CAS and final commit; persistence stores only committed envelopes.

## Deferred ownership

- P02-005 through P02-007 own planned inputs used to create a week session.
- P02-008A owns the OperationWeekSession implementation, one-use completion capability, failure
  injection tests, and whole-week commit.
- P02-009 owns local full-coach commands only after the committed P02 closure is available.

## Rollback

No session or global V2 state exists in P02-001. A normal revert removes the scaffold and ADR
without touching P01 command, audit, save, or latest/backup behavior.

## Traceability

- `docs/P02_GAMEPLAY_BASELINE.md` §12.6, §15.4
- `docs/P02_DEVELOPMENT_PLAN.md` §2.3–2.4, §4.2, §5, §6.2, §7.2, §7.9A
- GitHub Issue #9, ADR-0006 acceptance
