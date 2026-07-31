# P00 Known Issues

- The GitHub remote exists at `ziyuuu/basketball-gm`; `main` branch protection still requires
  independent verification.
- P00 intentionally does not choose a production UI state library.
- Earlier implementation runs reported an upstream optional WASI peer warning in Vite/Rolldown.
  The R1 frozen install and native Linux/Web builds completed successfully; no WASI binding is
  used by the produced app.
- The R1 clean-copy verification used a new explicit `/tmp` pnpm store. GitHub CI still requires
  independent execution with its normal writable cache.
