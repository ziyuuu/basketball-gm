# P01 Rollback

- Retain snapshot plus a bounded accepted-command tail instead of full event sourcing.
- If match model A blocks lifecycle work, substitute a deterministic fixed-result adapter without changing the result Schema.
- Never roll back command atomicity, versioned saves, independent RNG streams, or state validation.
- Event ID uniqueness, actual-week alignment, command-local sequencing, and audit-tail validation
  are non-negotiable R1 integrity rules.
- Explicit resolved-week ledger dates, annual grants at weeks 40/80/120, and rejection of future
  persisted weeks are non-negotiable R2 integrity rules.
- Before Gate promotion, the R2 commit may be discarded as one unit. Do not roll back to
  `32861501...` or R1 candidate `6984260...` as a promotable candidate because both contain
  independently confirmed defects.
- Pre-R2 prototype saves have no migration path; regenerate them under engine
  `0.1.2-p01-r2`.
