# P00 Requirements Traceability

| Requirement                              | Implementation                       | Evidence                 |
| ---------------------------------------- | ------------------------------------ | ------------------------ |
| pnpm workspace                           | root workspace and package manifests | clean install            |
| React/Vite and sim CLI shells            | `apps/web`, `apps/sim-cli`           | build and smoke commands |
| strict TypeScript/lint/format/test/build | root configs/scripts                 | `pnpm check`             |
| package boundaries and no cycles         | `scripts/check-boundaries.mjs`       | boundary output          |
| no model SDK/key contract                | production-source scan               | boundary output          |
| governance and scope                     | root docs, ADR, GitHub templates     | required-file inspection |
| content Schema spike                     | `packages/content-schema`            | unit tests               |
