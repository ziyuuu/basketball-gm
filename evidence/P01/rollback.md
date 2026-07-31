# P01 Rollback

- Retain snapshot plus a bounded accepted-command tail instead of full event sourcing.
- If match model A blocks lifecycle work, substitute a deterministic fixed-result adapter without changing the result Schema.
- Never roll back command atomicity, versioned saves, independent RNG streams, or state validation.
- Event ID uniqueness, actual-week alignment, command-local sequencing, and audit-tail validation
  are non-negotiable R1 integrity rules.
- Before Gate promotion, the R1 branch may be discarded as one unit. Do not roll back to
  `32861501...` as a promotable candidate because that commit contains the confirmed audit defect.
- Pre-R1 prototype saves have no migration path; regenerate them under engine
  `0.1.1-p01-r1`.
