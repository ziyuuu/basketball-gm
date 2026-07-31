# P01 Known Issues

- Prototype attributes and match model A are not balance evidence.
- The fixed initial roster is only a lifecycle fixture; annual recruitment and roster sustainability belong to P03.
- Career destinations remain `UNDECIDED` in P01.
- Pre-R1 candidate saves use engine version `0.1.0-p01` and the rejected ambiguous event ID
  format.
- R1 candidate saves use engine version `0.1.1-p01-r1`; their event IDs are reliable, but their
  annual-grant ledger dates can contain weeks 41/81/121.
- R2 intentionally rejects both unapproved save generations rather than migrating data whose
  audit or time integrity was rejected.

The duplicate and off-by-one event ID finding from the failed baseline is fixed in R1 and covered
by runtime validation plus regression tests. The annual-grant 41/81/121 finding from the failed R1
review is fixed in R2 and covered at generation, state-Schema, checksummed-save, and restore
boundaries.
