# P02-001 Known Issues

- No implementation blocker is known at candidate formation.
- The P02 root default entrypoint intentionally remains P01. This is a scope boundary, not a
  temporary V2 failure; P02-008B owns the separate cutover.
- No V2 save, MatchSession, or MatchRecord exists yet, so P02-001 cannot claim Match Model B,
  whole-week transaction, or P02 gameplay coverage.
- The P01 annual-grant integrity behavior remains a Legacy regression obligation; it is not
  reimplemented or weakened in this slice.
- This evidence is implementation-thread evidence only and does not replace CI, independent audit,
  Gate B/C/D, or Owner merge confirmation.
