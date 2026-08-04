# P02-003 B7 Runner, Protocol and Replay Remediation

This implementation-thread record addresses the main-thread B7 `REQUEST CHANGES` review of the
Candidate whose runner advanced nearly every possession as an `UNFORCED_DEAD_BALL` without using
the accepted Model B parser primitives. It is not an independent audit, a Gate B decision, or an
authorization to start B8.

## Remediated blockers

1. The runner now selects the handler, direct defender and legal behavior through the existing
   keyed selection primitives. It resolves HELPD, PASS, creation, field-goal, foul/free-throw,
   rebound, steal, block and assist paths through the accepted B1R-B6R builders, then commits only
   their derived Event/Fact payloads.
2. `finalizeModelBProtocolBundle` now returns exactly the frozen P02-002
   `MatchProtocolBundleSchema` envelope: immutable input, full anchor chain, and a parsed
   `MatchResultDraft` with event digest and match-result identity. No private session/hash envelope
   remains.
3. `replayMatch` now requires an authoritative protocol bundle. It parses that authority, requires
   exact canonical input equality, reruns from genesis, and rejects any divergence of the final
   protocol, including transcript/result identities and hashes.

## Direct regression

- OFFICIAL, FRIENDLY and SCRIMMAGE each compare Events, Facts, Anchors, Transcript and formal
  protocol result across `stepToNextControlBoundary`, `runToEnd` and authoritative replay.
- The completed bundle must pass `MatchProtocolBundleSchema`.
- A modified result identity is rejected by protocol parsing/replay rather than being silently
  regenerated.

## Scope boundary

No EventType, drawKind, Behavior ID, schema, player profile, save/replay version, UI, Site, LLM or
Agent scope was added. B8, Gate B, PR Ready, merge and P02-004 remain blocked pending main-thread
audit.
