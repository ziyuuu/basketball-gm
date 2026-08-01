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
- P00/P01 engineering integrity is frozen at `main@6547fbf51b2a440fd9602eed82c869d70b1181e1`.
- P01 attributes, training values, budget values, reputation values, automatic roster selection, and match model A are gameplay placeholders, not frozen design.
- The Owner-approved P02 gameplay authority is `docs/P02_GAMEPLAY_BASELINE.md` v1.2. Do not reinterpret it from the superseded vision or audit drafts.
- The Owner-approved implementation authority is `docs/P02_DEVELOPMENT_PLAN.md` v1.2. Implement it through one unblocked GitHub Issue and one independently reviewable PR at a time.
- P02 has exactly 12 active players; its initial fixed fixture is 12 first-year players, and the formal/friendly match roster is the whole active team. Any 22-player value under Legacy P01 code or P00/P01 evidence is historical regression data, not a current product rule.
- P02 targets one simplified quarter/possession-chain match model. Model A remains an engineering regression baseline; model C is not an MVP implementation requirement.
- P02 uses ten trainable abilities, a static body proxy, six fixed tendencies, at most one single-level archetype trait, fatigue, and individual chemistry. Morale, focus, pressure, injuries, pair relationships, and fixed five-player chemistry are not P02 state.
- Values marked `[CALIBRATE]` may change only through the approved directional-scenario process. Calibration may not change the mechanic, phase boundary, record scope, or deferred-content decision.
- Formal recruitment probabilities and roster sustainability remain P03. Detailed events, production UI, and later-phase systems must not be pulled into the P01/P02 gameplay baseline.
- LLM and Agent implementations are out of scope before P10/P11. Do not add model SDKs or API-key environment variables.
- The game is single-player, has no in-app purchases, no commercial gacha, no online competition, and deliberately allows manual saves, reloads, and save scumming.

## Workflow

- Use the personal-project flow: task/fix branch -> CI and relevant checks -> independent audit for key phase or high-risk changes -> owner confirmation -> merge to `main`.
- Keep one roadmap tracker, but create only the next dependency-cleared implementation Issue. One implementation Issue maps to one independently buildable and revertible PR; P02-008A and P02-008B remain separate.
- Create Gate M1/B/C/D audit Issues only after an exact candidate SHA exists. An open downstream Issue never waives a dependency.
- Never commit directly to `main`. Implementation-thread self-tests must not be represented as independent review.
- Branch protection, a second GitHub account, and a formal GitHub approval record are not hard Gates for this repository.
- Use task branches named `task/pXX-NNN-*` and remediation branches named `fix/pXX-NNN-*`.
- Keep exact local/private experiment payloads under ignored `artifacts/local/**`; commit schemas, rubrics, summaries, and Gate evidence only.
- Every phase must update its scope snapshot, traceability table, test/simulation report, known issues, rollback plan, and SHA-256 manifest.
- A failing CI check is a blocker, not a deferred cleanup item.
