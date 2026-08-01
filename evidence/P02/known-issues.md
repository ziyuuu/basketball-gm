# P02-001 Known Issues

- No implementation blocker is known at candidate formation.
- The P02 root default entrypoint intentionally remains P01. This is a scope boundary, not a
  temporary V2 failure; P02-008B owns the separate cutover.
- No V2 save, MatchSession, or MatchRecord exists yet, so P02-001 cannot claim Match Model B,
  whole-week transaction, or P02 gameplay coverage.
- The P01 annual-grant integrity behavior remains a Legacy regression obligation; it is not
  reimplemented or weakened in this slice.
- Candidate `930fb44cf773934c8a0c1f2a0f801f8f600df053` was rejected for boundary false negatives.
  Candidate `584143b97270275eefd8159b13639bbb90c2898d` was then rejected when fresh detached audit
  found a CommonJS loader-alias false negative. Candidate
  `e0d6a1a2e8659bfb0ee7baea8e06c2dbb2b63fbb` was then rejected for `new`/`Proxy`, dynamic-code,
  property-extraction, and callable-forwarding false negatives. Their CI and review results are
  historical only and cannot authorize merge. Candidate
  `001c8166986f769930b2a914a50311bbd8acc99f` was then rejected because runtime-object
  constructor chains could erase code-generation capability. CI #30 and that audit are likewise
  historical only. The next candidate requires fresh exact-SHA CI and a fresh detached audit.
- This evidence is implementation-thread evidence only and does not replace CI, independent audit,
  Gate B/C/D, or Owner merge confirmation.
