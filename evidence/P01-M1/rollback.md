# P01-M1 Rollback

- Before merge: close the PR and discard `fix/p01-m1-annual-grant-integrity`; `main` remains the R2
  implementation plus approved P02 documentation.
- After merge: use a normal revert PR. Do not reset or rewrite repository history.
- A rollback must restore the two frozen P01 hash pairs and pass `pnpm check`.
- Preserve this failure/audit evidence and all historical `evidence/P00/**` and `evidence/P01/**`.
- Never work around a failed Gate by changing engine/save versions or silently accepting a
  migration; return to the owning Issue and Owner decision.
