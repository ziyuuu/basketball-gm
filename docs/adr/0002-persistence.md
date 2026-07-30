# ADR-0002: repository contract with memory, idb, and Node file adapters

- Status: Accepted for P01
- Date: 2026-07-31

## Decision

Keep save envelopes and repository contracts platform-neutral. Implement:

- an in-memory adapter for transaction tests;
- an `idb`-based IndexedDB adapter for the future Web shell;
- a Node file adapter for CLI fixtures and Gate evidence.

## Alternatives

- Raw IndexedDB: minimal dependency but substantially more transaction and typing boilerplate.
- Dexie: strong higher-level API but more abstraction than P01 needs.

`idb` is the smallest wrapper that retains native IndexedDB transaction semantics.

## Integrity model

Validate the envelope and state hash before mutation, update latest and backup atomically, and never overwrite the only known-good save with malformed input.
