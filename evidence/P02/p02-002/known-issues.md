# P02-002 Known Issues and Deferred Work

- No implementation blocker is known at candidate formation.
- P02-002 is contracts and pure tools only. P02-003 owns the first headless Model B resolver,
  possession/segment progression, event reducer, statistics, replay execution, and opponent
  strategy implementation.
- MatchAnchor includes only a closed data shape for box-score accumulation mandated by the approved
  contract; it does not aggregate, calculate, settle, or run box scores.
- P02-002 has no GameState V2, SaveEnvelope V2, migration, global match RNG integration,
  application/persistence/CLI/Web integration, or Site deployment.
- A passing implementation-thread test run is not independent review. The Draft PR must remain
  Draft through CI and handoff; this task does not transition Ready, merge, start P02-003, or
  enter Gate B.
