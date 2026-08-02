# P02-002 Rollback

- Before merge: close the Draft PR and discard `task/p02-002-match-contract-keyed-rng`; `main`
  remains at `99c5b56a570d8e02b79dc006230f25c57c823595`.
- After merge: submit a normal revert PR for the single P02-002 commit. Do not reset, force-push,
  rewrite history, delete remote data, or alter historical evidence.
- The change has no GameState, SaveEnvelope, persistence, storage namespace, adapter, CLI/Web
  default-entry, or Site deployment migration, so rollback needs no data repair.
- Re-run `pnpm check`, the directed P02-002 contracts, the focused Legacy P01 suite, both frozen
  hashes, the 1,000-run legacy batch, and all evidence manifests after a revert.
