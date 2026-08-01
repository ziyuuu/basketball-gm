# P01-M1 Scope Snapshot

## Identity

- Task: GitHub Issue #6, `[P01-M1] 加固年度拨款与账本完整性（合法 P01 输出零变化）`
- Roadmap: GitHub Issue #5
- Approved-plan merge baseline: `af5dcd1239a85f601c911629d7a12c9f4cdb170b`
- Branch: `fix/p01-m1-annual-grant-integrity`
- Implementation commit: `e5b5a436a7f5895143ad5b361577ff775f74f88b`
- Evidence status: implementation-thread evidence; independent Gate M1 remains pending.

## Included

- Canonical P01 initial-grant and annual-grant constants.
- Initial game and year settlement use the canonical constants without changing their values.
- `GameStateSchema` verifies settled-school-year counters, grant existence/uniqueness,
  year/week/amount, the stored annual-grant field, the initial grant, every balance link, and the
  terminal balance.
- Re-signed save attacks verify rejection at GameState, SaveEnvelope, and restore boundaries.
- Legal boundary, frozen golden-hash, full-check, and 1,000-run regression evidence.
- Evidence manifest generation can target one explicit phase.

## Excluded

- P02 gameplay, contracts, state, saves, or UI.
- Training, match model A, player attributes, RNG behavior, event ordering, or economic values.
- Engine/save version changes or save migration.
- Any rewrite of `evidence/P00/**`, `evidence/P01/**`, or their manifests.

## Frozen identity

- Engine: `0.1.2-p01-r2`
- Save Schema: `0.1.0`
- Initial grant: `100000` (same existing value)
- Annual grant: `50000` (same existing value)
- Legal output hashes: unchanged; see `simulation-report/golden-summary.json`.
