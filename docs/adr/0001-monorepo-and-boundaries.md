# ADR-0001: pnpm workspace with inward domain dependencies

- Status: Accepted for P00
- Date: 2026-07-31

## Decision

Use one pnpm workspace with independently named apps and packages. Keep the pure domain package at the dependency center and enforce the graph with a repository script in CI.

## Rationale

The Web presenter, Node simulation runner, IndexedDB, file persistence, and future model adapters require different platform APIs. A package boundary makes accidental DOM/storage/model coupling visible before P04/P10.

## Consequences

- More root configuration than a single Vite app.
- Tests may run across packages in one Vitest process.
- Package cycles and forbidden domain imports block CI.
