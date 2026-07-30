# P01 Rollback

- Retain snapshot plus a bounded accepted-command tail instead of full event sourcing.
- If match model A blocks lifecycle work, substitute a deterministic fixed-result adapter without changing the result Schema.
- Never roll back command atomicity, versioned saves, independent RNG streams, or state validation.
