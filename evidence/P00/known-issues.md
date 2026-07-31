# P00 Known Issues

- `main` is not protected. The owner accepts this for a personal project; it is not a current Gate
  blocker, but direct commits to `main` remain prohibited by project workflow.
- The independent R2 decision was made outside GitHub Review metadata and no standalone reviewer
  report is committed. The repository records that limitation rather than inventing an approval.
- P00 intentionally does not choose a production UI state library.
- Earlier implementation runs reported an upstream optional WASI peer warning in Vite/Rolldown.
  The R1 frozen install and native Linux/Web builds completed successfully; no WASI binding is
  used by the produced app.
