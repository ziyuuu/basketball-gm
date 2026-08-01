# Contributing

## Branches

```text
main
phase/p00-baseline
phase/p01-domain-save
task/pXX-NNN-short-description
fix/pXX-NNN-short-description
```

- Do not commit directly to `main`.
- A task branch targets the current phase or `main`, as stated in its task brief.
- Use the personal-project flow: scoped branch, checks/CI, independent audit for key phase or
  high-risk changes, owner confirmation, then merge.
- Branch protection, a second GitHub account, and a formal GitHub approval record are not hard
  Gates.
- Implementation-thread self-tests do not count as independent review.
- Do not reuse a closed task branch for remediation.

## Issues

- Use one roadmap Issue to track the sequence, but create only the next implementation Issue whose dependencies are merged.
- One implementation Issue corresponds to one buildable, reviewable, and revertible PR.
- Every task Issue records its authority, exact `main` base SHA, dependencies, scope, non-scope,
  acceptance, evidence, rollback, and stop conditions.
- Create Gate M1/B/C/D Issues only after a stable candidate SHA exists. Gate C is one cumulative
  decision over the P02-008A functional closure and P02-008B production cutover.
- Implementation self-tests do not close a Gate, and an open downstream Issue does not waive an
  unmet dependency.

## Required checks

```bash
pnpm check
```

This runs formatting, lint, type checking, package-boundary checks, tests, and production builds. A failing check blocks phase promotion.

## Change discipline

- Keep the accepted P00/P01 engineering guarantees intact. P01 gameplay placeholders may change
  only under the approved `docs/P02_GAMEPLAY_BASELINE.md` and an Owner-approved
  `docs/P02_DEVELOPMENT_PLAN.md`.
- A `[CALIBRATE]` change may tune a numeric value through the registered scenario suite; it may
  not change a mechanic, record scope, phase assignment, or deferred-content boundary.
- Do not treat P02 as a parallel-model research project. Implement one chosen MVP match model after
  the design baseline; retain model A only as an engineering regression reference.
- Do not add a DOM, React, Node, storage-adapter, network, or model dependency to `packages/domain`.
- Do not put exact private model payloads, secrets, or personal data into evidence. Use ignored `artifacts/local/**`.
- Every state-changing feature requires a command, a reason code, an invariant test, and save round-trip coverage.
- Every Schema change requires a fixture or an explicit migration decision.

## Gate evidence

Each phase updates:

- `scope-snapshot.md`
- `requirements-traceability.md`
- test and simulation reports
- save/replay fixtures when applicable
- `known-issues.md`
- `rollback.md`
- `manifest.sha256`
