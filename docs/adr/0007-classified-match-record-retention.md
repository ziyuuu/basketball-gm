# ADR-0007: Classified MatchRecord retention and authority-size budgets

- Status: Accepted for P02-001
- Date: 2026-08-01

## Decision

Future P02 MatchRecords are classified as official, friendly, or scrimmage and retain authority
according to their record scope:

- official and friendly matches retain immutable input, seed, version identities, control strategy,
  accepted transcript, compact events, full box score, and verifiable explanation facts;
- scrimmages retain immutable input, seed, version identities, control strategy, compact accepted
  transcript/hash, score, minutes, growth facts, and observation summary, but discard temporary
  full box score and possession events after a self-sufficient summary is formed;
- official/friendly compact event data targets at most 256 KiB per match;
- a scrimmage persistent summary targets at most 16 KiB per match;
- a terminal 120-week SaveEnvelope targets at most 16 MiB serialized UTF-8 bytes.

Exceeding a target blocks the owning later slice; it does not authorize truncating official or
friendly authority data.

## Rationale

The P02 gameplay baseline requires three match scopes that must not contaminate official records.
It also requires enough formal/friendly evidence for fact explanations and later replay, while
preventing routine scrimmages from making a three-year save unbounded.

## Consequences

- Match kind and record scope are separate, validated concepts in later contracts.
- Scrimmage summaries must stand on their own after detailed temporary data is discarded.
- Presentation caches are not authority and may be discarded independently.
- P02-001 does not add a MatchRecord, event encoding, compression scheme, or persistence field.

## Deferred ownership

- P02-002 owns classified record contracts and identity fields.
- P02-003 owns compact event production and replay behavior.
- P02-007 and P02-008A own classification and committed persistence.
- P02-010 owns worst-case record/read measurements and must enforce the same budgets.

## Rollback

No new match storage is introduced here. Reverting this slice leaves the frozen P01 Model A
summary storage and all existing saves byte-compatible.

## Traceability

- `docs/P02_GAMEPLAY_BASELINE.md` §4, §13.1–13.2, §15.2, §21.14
- `docs/P02_DEVELOPMENT_PLAN.md` §4.7, §7.2, §7.8, §7.11
- GitHub Issue #9, ADR-0007 acceptance
