# P02-002 Draft Candidate Identity

- Task: GitHub Issue #11, `[P02-002] 比赛合同、确定性身份、定点工具与键控 RNG`
- Parent main: `99c5b56a570d8e02b79dc006230f25c57c823595`
- Parent tree: `5b82f6d2485965a5a735aaaefa5b6daafff7a624`
- Branch: `task/p02-002-match-contract-keyed-rng`
- Candidate commit/tree, CI run, and PR URL are recorded in the Draft PR because embedding a
  self-referential final commit SHA in its own evidence would change that candidate.

Draft candidate `96b22b31184cf610029dfa6cff07d7adde15a20f` / tree
`6a194a523acc3a4eb1598e49948cc81ea1e4406f` is superseded. Main-thread review found three
contract gaps: Result classification was not cross-bound to MatchInput; event coordinates/local
sequence were not closed against the adjacent Anchor cursor chain; and event player/team
attribution was not bound to the registered rosters. Its CI run #49 and implementation-thread
verification are historical only and are not reused for the remediation candidate.

P02 uses the fixed 12-player rule. Official/friendly MatchInput contracts register the entire
12-player team; scrimmage freezes a single source-team 12 into deterministic 6-vs-6 sides.

This candidate deploys no Site. P04 owns the first playable Web deployment. No P02-003 code is
included. Development-thread verification is not independent review or authorization to mark the
PR Ready or merge it.
