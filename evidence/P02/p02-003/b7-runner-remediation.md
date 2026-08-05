# P02-003 B7 Second-round Runner, Protocol and Replay Remediation

This implementation-thread record addresses the B7 `REQUEST CHANGES` review of rejected Candidate
`b228ab9c1e46127ba663a01096fc8f365d5cf1f9`. It implements the frozen v6 observable contract; it
is not an independent audit, a Gate B decision, or an authorization to start B8.

## Remediated blockers

1. One `SEGMENT_DURATION/0` root establishes the normal target. The runner uses deterministic
   domain-isolated action-duration and ordinary-gap subvalues, performs the phase guard before any
   candidate/result draw, and prohibits ordinary-gap consumption in LATE_CLOCK.
2. All 34 selectable behaviors execute in the real segment loop. ADV/REORG and nonterminal
   creation/defense results remain live; only real foul, rebound, turnover, score or period results
   establish a boundary. PRESS/DOUBLET effects enter the later turnover/opportunity chain; STLTRY
   only supplies a candidate to real pressured-turnover attribution; HELPD emits its exact two-Fact
   action shape without CreationFact.
3. Creation and off-ball behavior-specific execution blends, effective execution stages, pass
   receiver handler changes, new shooter/new defender selection, opportunity quality, foul, block,
   free throw and rebound tails are connected. A field-goal flight consumes period/fatigue only;
   buzzer release and shooting-foul ordering follow v6 D.10.
4. Transition entry derives from real defensive rebound/pressured-turnover origins. TRANSITIOND is
   forced only when time-legal, consumes `TRANSITION/0` only then, applies the accepted formation
   formula, and uses the frozen strict-less-than fallback calculation without a new top-level draw.
5. Fact materialization resolves Action Trace result event indices, then sorts all Fact drafts by
   source local sequence, subtype rank and intra-type ordinal before deriving dense Fact identity.
   Replay reconstructs and validates the accepted authority bundle without re-running selectors or
   keyed RNG.

## Direct regression

- `behavior-causality-matrix.md` records every selectable behavior's entry, participants, draw
  scope, causal continuation, Event/Fact and Anchor effect. Its test requires actual ACTION_TRACE
  execution rather than candidate-list membership.
- V25 tests `0→11→13→14→30→0`, H1→H2→H3→H2, no LATE ordinary gap/no SHOT draw, handler/PASS/
  ACTION_TRACE/violation Fact drafts and the final H2 violation owner.
- OFFICIAL, FRIENDLY and SCRIMMAGE compare Events, Facts, Anchors, Transcript and formal protocol
  result/identity across `stepToNextControlBoundary`, `runToEnd` and accepted-authority replay.
- One modified protocol/transcript identity is rejected as a replay consistency negative. It is not
  anti-tamper or anti-cheat coverage.

## Scope boundary

No EventType, drawKind, Behavior ID, schema, player profile, save/replay version, UI, Site, LLM,
Agent, anti-tamper, signature or trust-root scope was added. B8, Gate B, PR Ready, merge and
P02-004 remain blocked pending main-thread audit.
