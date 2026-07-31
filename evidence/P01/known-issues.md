# P01 Known Issues

- Prototype attributes and match model A are not balance evidence.
- The fixed initial roster is only a lifecycle fixture; annual recruitment and roster sustainability belong to P03.
- Career destinations remain `UNDECIDED` in P01.
- Pre-R1 candidate saves use engine version `0.1.0-p01` and the rejected ambiguous event ID
  format. R1 intentionally rejects those unapproved prototype saves rather than migrating their
  unreliable audit tails.

The duplicate and off-by-one event ID finding from the failed baseline is fixed in R1 and covered
by runtime validation plus regression tests.
