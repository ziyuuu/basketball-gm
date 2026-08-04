# P02-003 v2.9-R1 Review-blocker Remediation

This record addresses the main-thread `REQUEST CHANGES / NOT READY TO RESUME B7` review of
Candidate `0f31b9ac950d64be3d202a425e2a021d3045a4c2` (tree
`e1ea272b3dbac6bf1396c84cbf69d61ee456528b`). It is implementation-thread evidence only; it does
not resolve the review, authorize B7, or change the Draft status of PR #15.

## Fixed blockers

1. `DefensiveActionFact` now binds `handlerId`, `primaryDefenderId`, and every
   `supportingDefenderId` to the source event's previous Anchor lineups, rather than merely to the
   immutable registered rosters. The existing role-uniqueness rule still rejects a HELPD helper
   equal to the on-ball defender.
2. `selectModelBBehavior` now shares the public `ModelBBehaviorCandidateInput` defensive-context
   fields with `buildModelBBehaviorCandidates`: `currentLineup`, `eligibleDefenderIds`, and
   `onBallDefenderId`. A source-level `satisfies` contract is included in the root TypeScript
   program, so removing any of those fields fails `pnpm typecheck` with the same excess-property
   family that previously produced TS2353.
3. `createModelBSession` now requires the exact R1 `MODEL_B_RULES_VERSION` and
   `MODEL_B_RULES_CONTENT_HASH` in `gameIdentity`. The generic MatchInput parser and Legacy
   P02-002 parsing/replay contracts are not changed.

## Negative regression coverage

- A registered but benched offensive handler is rejected.
- A registered but benched primary defender is rejected.
- A registered but benched HELPD helper is rejected.
- HELPD helper equal to the on-ball defender remains rejected.
- A re-materialized Physical input with an incorrect rulesVersion is rejected.
- A re-materialized Physical input with a missing or incorrect `contentHashes.modelB` is rejected.
- The compile-time public-call shape includes all three defensive-context fields.

Before the implementation changes, the new B2 test file failed on the identity and lineup cases,
and `pnpm typecheck` failed with TS2353 for `currentLineup`. After the fixes, those checks pass.

## Scope boundary

This remediation does not add EventType, drawKind, Behavior ID, resolver behavior, product rotation,
live coaching commands, persistence, UI, Site, or B7/B8 work. The replacement Candidate remains
subject to a fresh main-thread review before any `READY TO RESUME B7` decision.
