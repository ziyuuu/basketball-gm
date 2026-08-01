# Architecture

## Dependency direction

```mermaid
flowchart TD
  Web["apps/web"]
  CLI["apps/sim-cli"]
  App["packages/application"]
  Domain["packages/domain"]
  Persist["packages/persistence"]
  NodePersist["packages/persistence-node"]
  IDBPersist["packages/persistence-indexeddb"]
  Content["packages/content-schema"]
  Tokens["packages/ui-tokens"]

  Web --> App
  Web --> IDBPersist
  Web --> Tokens
  CLI --> App
  CLI --> NodePersist
  App --> Domain
  Persist --> App
  Persist --> Domain
  NodePersist --> Persist
  IDBPersist --> Persist
  Content --> Domain
```

`packages/domain` is the innermost package. It has no DOM, React, IndexedDB, Node, persistence-adapter, network, or model dependency.

## P02-001 compatibility scaffold

P01 remains the current production behavior. Its five package surfaces are available through
explicit `legacy-p01` subpaths, while the unqualified roots remain thin P01 re-exports until the
separate P02-008B cutover. The only shared domain-core code introduced in P02-001 is a stateless
RNG seed/state primitive; it has no P01 stream names, Schema, GameState, or reverse Legacy import.

No V2 state, MatchSession, storage namespace, Web dependency, or CLI default path is introduced
by this scaffold. The P01 Node latest/backup contract and the IndexedDB default database name
`sunny-court-manager-saves` remain unchanged.

## State-change path

```text
Web / CLI / future Agent
  -> Command schema
  -> Application preconditions
  -> cloned state + cloned RNG streams
  -> pure domain operation
  -> state and invariant validation
  -> atomic session commit
  -> save/report/presenter
```

A failed command leaves the original state, revision, command log, and RNG stream counters unchanged.

The batch simulator has a separate, explicitly throwaway adapter. It validates the same command
envelope and calls the same domain resolver, but commits in-place and validates at school-year
checkpoints to make 1,000+ runs practical. Any thrown batch run is discarded in full; it is never
used for player saves or persistent sessions.

## Determinism boundary

Replay identity is:

```text
engineVersion
+ contentPackHashes
+ saveSchemaVersion
+ rootSeed
+ RNG stream states
+ snapshotHash
+ ordered accepted commands
```

Audit timestamps are excluded from rules calculations. Cosmetic RNG is isolated from training, match, recruitment, events, injury, and career outcomes.

## Persistence

- `packages/persistence` defines the save envelope, integrity checks, repository contract, and in-memory atomic adapter.
- `packages/persistence-node` writes a temporary file, verifies it, rotates the previous good save to a backup, then renames the temporary file.
- `packages/persistence-indexeddb` updates the latest and backup snapshots in one IndexedDB transaction.
- Browser or file storage is never the only conceptual source of truth; export/import remains a later application concern.

## P01 time model

- 3 school years.
- 2 terms per school year.
- 20 calendar weeks per term.
- Weeks 1–16 are `TERM_OPERATION`.
- Weeks 17–20 are `EXAM_WRAP`.
- Total: 120 calendar weeks and 96 operation weeks.
- P01 uses a fixed initial fixture and does not freeze formal annual recruitment.
