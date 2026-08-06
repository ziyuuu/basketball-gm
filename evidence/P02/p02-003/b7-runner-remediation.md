# P02-003 B7 Third-round Transition Remediation

This implementation-thread record addresses the two remaining B7 `REQUEST CHANGES` findings on
rejected Candidate `97d6ed55dd31852ed7538b39bae3d55d57ae6e0b`. It implements the frozen v6
observable contract; it is not an independent audit, a Gate B decision, or an authorization to
start B8.

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
4. Transition entry derives only from the possession-ending atomic tail that directly created the
   current new possession: a real defensive rebound or pressured turnover, including a credited
   `STEAL`'s referenced pressured-turnover Event in that same tail. It never searches beyond a
   later score, dead-ball turnover, period boundary or possession end. It derives the controller, two
   `OFF_SUPPORT/<playerId>` supporters and three `DEF_RETREAT/<playerId>` retreaters before
   `TRANSITIOND`, records those identities in both context and trace, and uses them in formation
   and fallback execution. `REORG_COMPLETED` and window expiry leave TRANSITION through the one
   deterministic fallback path, which updates the same trace/context pair without consuming a
   `FALLBACK/<n>` subvalue, time, Event, possession or segment. Only a nonterminal window action
   may read the frozen strict-less-than fallback subvalue.
5. Fact materialization resolves Action Trace result event indices, then sorts all Fact drafts by
   source local sequence, subtype rank and intra-type ordinal before deriving dense Fact identity.
   Replay reconstructs and validates the accepted authority bundle without re-running selectors or
   keyed RNG.

## Direct regression

- `behavior-causality-matrix.md` records every selectable behavior's entry, participants, draw
  scope, causal continuation, Event/Fact and Anchor effect. Its test requires actual ACTION_TRACE
  execution rather than candidate-list membership.
- V25's object-level vector uses `createModelBSession → runModelBRunnerVector → runLiveSegment →
commitModelBActiveSegment`, generating the real Event/Fact/Anchor chain for
  `0→11→13→14→30→0`, H1→H2→H3→H2 and the final H2 violation. It supplies only controlled
  selection/raw/outcome inputs; it cannot fabricate authoritative objects. The older pure phase
  projection remains supplementary arithmetic coverage. A deliberately unexecuted SPOTUP and null
  LATE ordinary-gap inputs prove the guard stops before either can be consumed.
- OFFICIAL, FRIENDLY and SCRIMMAGE compare Events, Facts, Anchors, Transcript and formal protocol
  result/identity across `stepToNextControlBoundary`, `runToEnd` and accepted-authority replay.
- One modified protocol/transcript identity is rejected as a replay consistency negative. It is not
  anti-tamper or anti-cheat coverage.
- Runner regressions include a non-empty window-expiry sample, asserting the common trace/context
  fallback record and its following HALF_COURT/LATE phase, plus a 16-seed negative in which a
  pressured credited steal is followed by a made basket: the following ordinary possession must
  not receive `TRANSITION_CONTEXT` or forced `TRANSITIOND` from the old steal.

## Scope boundary

No EventType, drawKind, Behavior ID, schema, player profile, save/replay version, UI, Site, LLM,
Agent, anti-tamper, signature or trust-root scope was added. B8, Gate B, PR Ready, merge and
P02-004 remain blocked pending main-thread audit.
