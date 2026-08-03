# P02-003 Headless Model B v2.9 FINAL — Design Authority

- Owner approval date: 2026-08-03
- Owner decision: `APPROVED FOR DEVELOPMENT`
- Independent design audit: `95/100 — READY FOR DEVELOPMENT`
- Contract baseline: `main@45dc1a261172ebfff46f30b122cbdf5621596959`
- Implementation task: GitHub Issue #14
- Original archive SHA-256:
  `822eaef55db5118bc177c84d9fe5c4bbb7512b8ec01b641b6ad13c9940f15591`

The uploaded archive filename is not an identity field. The SHA-256 above is the authoritative
archive identity and matches the Owner-approved package byte for byte.

The 17 Markdown files listed in `manifest.sha256` are exact byte copies extracted from that
archive. They include the design set and the three archived independent audit reports. The original
ZIP is not committed because the Markdown sources and their individual hashes are the reviewable
repository authority; the ZIP hash remains the immutable external archive identity.

The frozen directory is excluded from automatic Prettier rewrites so CI cannot silently alter those
bytes. Its integrity check is `sha256sum -c manifest.sha256` from this directory.

This approval authorizes P02-003 implementation only. It does not approve an implementation
candidate, pass Gate B, authorize a merge, or allow P02-004 work to begin.

## Frozen implementation boundary

- 44 Behavior IDs: 34 selectable and 10 non-selectable.
- PASS, HPASS, CREATIVE_PASS, ASTOPP, and HELDKICK use one `TURNOVER_OCCURRENCE`
  failure chain.
- BOXOUT is a `RULE_RESULT`, has no behavior-selection ordinal or independent actor draw, and uses
  the first-candidate `+4` execution value in the rules/content hash.
- Match state, shot clock, period possession, semantic RNG ordinals, and Event/Fact/Statistic
  causality follow the v2.9 FINAL documents.
- P02-003 does not expand MatchInput, Player Schema, Save Schema, MatchDrawKind, or MatchEventType.
- GameState/Save V2, product rotation, weekly integration, coaching commands, UI/Site, LLM/Agent,
  anti-tamper, signatures, and trust roots are out of scope.

Any implementation need that conflicts with these boundaries is a stop condition and must return to
the Owner and design-review flow before code continues.
