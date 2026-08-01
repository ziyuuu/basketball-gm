# P01-M1 Gate Candidate Identity

- Task: GitHub Issue #6
- Roadmap: GitHub Issue #5
- Base main: `af5dcd1239a85f601c911629d7a12c9f4cdb170b`
- Branch: `fix/p01-m1-annual-grant-integrity`
- Implementation commit: `e5b5a436a7f5895143ad5b361577ff775f74f88b`
- Engine: `0.1.2-p01-r2` (unchanged)
- Save Schema: `0.1.0` (unchanged)
- Gate state: `PENDING`

The exact final candidate SHA is the commit containing this evidence set and is recorded in the PR
and Gate Issue after that immutable commit exists. This file intentionally does not claim an
independent decision or embed a self-referential commit SHA.

Implementation-thread checks: `pnpm check` pass, 29/29 tests, two frozen hash pairs unchanged,
1,000/1,000 batch pass, and 17 re-signed attacks rejected through all three validation layers.

Independent reproduction and Owner confirmation are still required before merge.
