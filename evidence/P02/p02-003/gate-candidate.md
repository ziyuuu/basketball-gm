# P02-003 v2.9-R1 Draft Candidate

- Task: GitHub Issue #14, P02-003 Headless Model B v2.9-R1 revision
- Branch: `task/p02-003-headless-model-b`
- Draft PR: #15
- Revision base: `8855116aa45f2989a0b5c0079dbd76b662e27706`
- B1R-B6R implementation head: `b755fe85c649e119ab90d8cb58407588b8452ec6`
- Final candidate commit/tree and CI run are recorded in Draft PR #15 because embedding the final
  commit SHA in its own evidence changes that identity.

The published branch head is the rejected B7 remediation Candidate `33fdf437…`. The local direct
successor is not a Candidate until it is committed and published. It derives all 34 selectable
behaviors from the frozen registry, consumes the frozen keyed draws, produces the frozen P02-002
`MatchProtocolBundle`/`MatchResultDraft`, and replays an authoritative bundle by consuming and
verifying its input, transcript, result and identities. It does not implement B8, claim Gate B PASS,
or authorize Ready, merge, or P02-004. Any successor remains subject to fresh main-thread review.

## Main-thread review remediation

The prior stable candidate received `REQUEST CHANGES / NOT READY TO RESUME B7`. Its direct
successor fixed the three reproducible blockers—source-Anchor lineup membership for
`DefensiveActionFact`, the public defensive behavior-selection input contract, and exact R1 Model B
rules/content identity binding. See `review-remediation.md`. The current B7 correction is recorded
in `b7-runner-remediation.md`; it does not self-approve fresh review or alter any B8/Gate B blocking
condition.
