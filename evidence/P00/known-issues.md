# P00 Known Issues

- The GitHub remote exists at `ziyuuu/basketball-gm`; R1 independent review explicitly found
  `main` branch protection disabled. R2 does not change repository protection settings.
- P00 intentionally does not choose a production UI state library.
- Earlier implementation runs reported an upstream optional WASI peer warning in Vite/Rolldown.
  The R1 frozen install and native Linux/Web builds completed successfully; no WASI binding is
  used by the produced app.
- R2 clean-copy evidence remains implementation-thread evidence until a new independent review.
