# P02-003 v2.9-R1 Known Issues and Deferred Work

- The B7 registry/RNG/transcript/replay correction has complete local implementation-thread
  verification but has not yet formed a Candidate or passed fresh main-thread review.
  Development-thread verification is not that review.
- The focused B7 run takes 187.68 seconds and complete `pnpm check` takes 241.93 seconds. This is a
  B8 performance blocker/input, not a B7 correctness failure or a reason to weaken B7 coverage.
- No additional B1R-B7 implementation deviation or unresolved R1/Erratum 01 contract conflict is
  known after the local correction checks.
- B8, Gate B, PR Ready, merge, and P02-004 remain explicitly blocked.
- No product auto-rotation, live coaching command, persistent matchup graph, second-layer rotation,
  weight or court geometry, training, growth, Save V2, UI, Site, LLM/Agent, anti-tamper, signature,
  trust-root or other security mechanism is included.
- The only rotation behavior exercised here is the pre-existing `internal/test` neutral policy.
