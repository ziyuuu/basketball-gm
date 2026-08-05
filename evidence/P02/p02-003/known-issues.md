# P02-003 v2.9-R2 B7 Second-round Known Issues and Deferred Work

- `66684aff…` is the rejected Candidate. The current local successor implements the four Owner
  development fixes, has completed local verification, and awaits publication and independent
  main-thread review; none is a B7 acceptance decision.
- B8 remains a hard blocker. This B7 evidence deliberately contains no 10,000-match/60-second
  performance claim, fixed-seed calibration statistic, balance conclusion, or realism conclusion.
- No frozen-product rule, formula, schema or RNG-contract change is included. A new Candidate and
  independent review are still required before any claim about the local successor's acceptance.
- B8, Gate B, PR Ready, merge, and P02-004 remain explicitly blocked.
- No product auto-rotation, live coaching command, persistent matchup graph, second-layer rotation,
  weight or court geometry, training, growth, Save V2, UI, Site, LLM/Agent, anti-tamper, signature,
  trust-root or other security mechanism is included. The one negative test is protocol/replay
  consistency only, not player-save protection.
- The only rotation behavior exercised here is the pre-existing `internal/test` neutral policy.
- Historical passing results for the rejected Candidate are not reused as evidence for this local
  successor. Its complete B7 suite (run by named cases), typecheck, formatting, diff check, Web/CLI
  builds, 1,000-run batch smoke, complete `pnpm check`, and P02 manifest all have terminal passing
  results.
