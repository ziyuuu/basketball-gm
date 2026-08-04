# P02-003 B7 Runner, Protocol and Replay Correction

This implementation-thread record addresses the main-thread B7 `REQUEST CHANGES` review of the
Candidate whose runner first advanced nearly every possession as an `UNFORCED_DEAD_BALL`, then
retained only a seven-behavior runner-local subset. This correction is local until a successor
Candidate is committed and published. It is not an independent audit, a Gate B decision, or an
authorization to start B8.

## Remediated blockers

1. The runner derives every selectable behavior (34 rows) from the frozen registry. It selects the
   handler and direct defender through existing keyed selection primitives; dispatches advance,
   pass, creation, shot and off-ball behavior families plus HELPD, PRESS, DOUBLET and STLTRY through
   the accepted B1R-B6R result builders; and retains the selected ordinary defensive response in
   the same possession result context. No runner-local subset or new behavior table exists.
2. Live segments consume the existing `SEGMENT_DURATION` draw. Field-goal resolution consumes the
   existing `SHOOTER` draw. Creation, off-ball and defensive execution consume their existing keyed
   execution ordinals, including the existing creation-exit path. No stream RNG, draw kind or
   ordinal is added.
3. `finalizeModelBProtocolBundle` returns exactly the frozen P02-002
   `MatchProtocolBundleSchema` envelope: immutable input, full anchor chain, and a parsed
   `MatchResultDraft` with event digest and match-result identity. No private session/hash envelope
   remains.
4. `replayMatch` requires an authoritative protocol bundle. It parses that authority, requires
   exact canonical input equality, reruns from genesis, and rejects any divergence of the final
   protocol, including transcript/result identities and hashes.

## Direct regression

- The frozen registry's 34 selectable IDs are the runner input set.
- OFFICIAL, FRIENDLY and SCRIMMAGE each compare Events, Facts, Anchors, Transcript and formal
  protocol result (including identities) across `stepToNextControlBoundary`, `runToEnd` and
  authoritative replay; each run contains non-empty `RULES`, `ASSISTANT` and `OPPONENT` entries.
- The completed bundle must pass `MatchProtocolBundleSchema`.
- One modified transcript/result identity is rejected as a protocol/replay consistency negative,
  rather than being silently regenerated. It is not anti-tamper or anti-cheat coverage.

## Scope boundary

No EventType, drawKind, Behavior ID, schema, player profile, save/replay version, UI, Site, LLM,
Agent, anti-tamper, signature or trust-root scope was added. B8, Gate B, PR Ready, merge and
P02-004 remain blocked pending main-thread audit.
