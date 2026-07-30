# Sunny Court Manager Engineering Rules

## Product baseline

- This repository is the formal engineering project for the single-player Chinese ordinary high-school girls' basketball manager game.
- T00 is a visual reference only. Do not copy its temporary architecture, fake data, or static interaction logic into the production rules core.
- Frozen visual direction: Kairo-style pixel-management shell and pixel environments, with high-fidelity non-pixel anime character illustrations used as presentation moments.
- School name, team name, manager name, and coach name are user-defined. Do not hard-code a canonical school or manager identity.
- The V2 preview illustrations are style references, not release-ready production assets.

## P00/P01 boundaries

- `packages/domain` is pure TypeScript and may not depend on React, DOM, IndexedDB, Node APIs, UI packages, persistence adapters, or any model SDK.
- All state-changing behavior goes through application commands and atomic transactions.
- The same root seed, RNG stream states, snapshot, engine version, and ordered commands must reproduce the same state hash.
- The first playable proof is a no-UI, no-API, three-school-year simulation.
- P01 may use prototype attributes and match model A only. It must not freeze final attributes, formal recruitment probabilities, model B, detailed events, reputation formulas, or production UI.
- LLM and Agent implementations are out of scope before P10/P11. Do not add model SDKs or API-key environment variables.
- The game is single-player, has no in-app purchases, no commercial gacha, no online competition, and deliberately allows manual saves, reloads, and save scumming.

## Workflow

- `main` only receives phase branches after an independent Gate.
- Use `phase/p00-baseline`, `phase/p01-domain-save`, and task branches named `task/pXX-NNN-*`.
- Keep exact local/private experiment payloads under ignored `artifacts/local/**`; commit schemas, rubrics, summaries, and Gate evidence only.
- Every phase must update its scope snapshot, traceability table, test/simulation report, known issues, rollback plan, and SHA-256 manifest.
- A failing CI check is a blocker, not a deferred cleanup item.
