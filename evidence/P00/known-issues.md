# P00 Known Issues

- GitHub remote creation and `main` branch protection require the final repository owner/name and connected remote. Local implementation cannot self-prove remote protection.
- P00 intentionally does not choose a production UI state library.
- pnpm reports an upstream optional WASI peer warning in Vite/Rolldown (`@napi-rs/wasm-runtime` vs `@emnapi` alpha peers). Native Linux/Web builds and all checks pass; no WASI binding is used by the produced app. Re-evaluate on the next aged Vite patch rather than overriding transitive packages.
- In ChatGPT Work, pnpm's default home store is read-only and workspace-backed SQLite stores were unreliable. Verification used an explicit `/tmp` store; GitHub CI uses its normal writable cache.
