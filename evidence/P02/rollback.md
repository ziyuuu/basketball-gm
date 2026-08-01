# P02-001 Rollback

- Before merge: close the P02-001 PR and discard `task/p02-001-architecture-scaffold`; main stays
  at `5f3ed1cdd4a816e0c482f5161e86706eda1f4c60`.
- After merge: create a normal revert PR. Do not reset, force-push, rewrite history, delete remote
  data, or alter historical evidence.
- A revert restores the pre-P02-001 P01 root layout/exports while preserving P01-M1 integrity
  fixes. It must pass `pnpm check`, the two frozen golden pairs, the P01-M1 attack/boundary matrix,
  and existing Node/IndexedDB persistence contracts.
- P02-001 creates no V2 save namespace or migrated save, so rollback cannot require save migration
  or cleanup. Historical P00/P01/P01-M1 evidence remains immutable in either outcome.
