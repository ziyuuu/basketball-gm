# P02-002 Scope Snapshot

## Identity

- Task: GitHub Issue #11, `[P02-002] 比赛合同、确定性身份、定点工具与键控 RNG`
- Parent main: `99c5b56a570d8e02b79dc006230f25c57c823595`
- Parent tree: `5b82f6d2485965a5a735aaaefa5b6daafff7a624`
- Branch: `task/p02-002-match-contract-keyed-rng`
- Node: `v24.14.0`
- pnpm: `11.7.0`
- P02 roster rule: exactly 12 active players; official/friendly register all 12 and scrimmage is a
  deterministic 6-vs-6 split of those 12.

## Included

- Pure `domain/core` canonical V2, SHA-256, fixed-point, and sequential `nextUint32` primitives.
- Pure `domain/match` closed Schema, deterministic identity, keyed match draw, and generic
  effect-contract helpers.
- Exact `@sunny-court/domain/core` and `@sunny-court/domain/match` package subpaths without a root
  export cutover.
- Unit, golden, package-export, boundary, Legacy P01 regression, simulation, and evidence checks.

## Explicitly excluded

- No MatchSession, resolver, possession/segment settlement, match formula, automatic rotation,
  opponent strategy implementation, box-score reducer, MatchCommand handler, or real match run.
- No GameState V2, SaveEnvelope V2, RulesContext, content-p02, adapter, migration, global match
  stream integration, application, persistence, CLI, or Web-default entrypoint change.
- No training, growth, roster product logic, recruitment, week settlement, feedback, Card/deck,
  LLM/Agent/network feature, P02-003, Gate B, Site deployment, or Web playable demo.
- No P01 Engine `0.1.2-p01-r2`, Save Schema `0.1.0`, legal public root API, persistence namespace,
  Legacy P01 22-player fixture, frozen state/replay hash, or P00/P01/P01-M1 evidence change.

## Candidate state

This is implementation-thread evidence. It records a Draft-PR candidate only after the exact commit
is created and pushed. It is not an independent review, Ready transition, merge authorization, or
P02 completion decision.
