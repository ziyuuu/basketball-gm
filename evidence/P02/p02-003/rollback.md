# P02-003 v2.9-R2 Rollback

Each revision batch is an independent ordinary commit on the same Draft PR branch. Before merge,
close Draft PR #15 and delete the task branch if the complete candidate must be abandoned. To roll
back an individual published batch, create an ordinary revert commit for that batch and any
dependent successors; do not rewrite the shared branch history.

If this work is ever merged, rollback must use a normal revert PR. Do not restore the superseded
`81697e9d26e6bf5ea372b9fffdd427598fc3d87f` implementation as the task head, because it predates
the approved v2.9-R1 and Erratum 01 authority.

The rejected `b228ab9…` Candidate remains retained for review history. The B7 second-round
successor must be an ordinary commit on top of that history. If it must be withdrawn before merge,
create an ordinary revert of the successor only while retaining B1R–B6R and the rejected Candidate
record; do not force-push, reset, or restore a pre-v6 runner.

The 2026-08-06 contract amendment is a later ordinary documentation successor. Its implementation
has been delivered through v2.10-energy-r1 through r6. r4 and r5 were rejected by independent
review; r6 was rejected as an exact SHA by CI #129. The 2026-08-07 scope correction is a later Owner
decision that narrows P02-003 acceptance without reverting its runtime. To roll back the product
energy direction, revert the amendment, scope correction and dependent implementation commits
together in a normal revert PR. To roll back only the Gate correction, revert that decision and its
evidence successor; do not silently revive r4--r6 review findings as blockers.
