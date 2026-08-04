# P02-003 v2.9-R1 Rollback

Each revision batch is an independent ordinary commit on the same Draft PR branch. Before merge,
close Draft PR #15 and delete the task branch if the complete candidate must be abandoned. To roll
back an individual published batch, create an ordinary revert commit for that batch and any
dependent successors; do not rewrite the shared branch history.

If this work is ever merged, rollback must use a normal revert PR. Do not restore the superseded
`81697e9d26e6bf5ea372b9fffdd427598fc3d87f` implementation as the task head, because it predates
the approved v2.9-R1 and Erratum 01 authority.

The post-B6R and B7 correction commits are ordinary direct successors of the prior Candidate. If
either must be withdrawn before merge, revert the relevant successor normally while retaining the
B1R-B6R history and review record; do not force-push or restore the superseded v2.9
implementation.
