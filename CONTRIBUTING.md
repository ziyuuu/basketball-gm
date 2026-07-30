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
- A task branch targets only its current phase branch.
- A phase branch reaches `main` only after an independent Gate.
- Do not reuse a closed task branch for remediation.

## Required checks

```bash
pnpm check
```

This runs formatting, lint, type checking, package-boundary checks, tests, and production builds. A failing check blocks phase promotion.

## Change discipline

- Do not mix final gameplay balancing with P00/P01 infrastructure.
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
