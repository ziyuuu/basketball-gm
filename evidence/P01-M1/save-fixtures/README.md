# P01-M1 Save Attack Fixtures

The attack fixtures are generated in `packages/persistence/src/index.test.ts` from valid saves so
the repository does not preserve redundant mutable save blobs.

Each attack helper repairs unrelated sequence and, for deletion/duplication/amount mutations,
rebuilds the complete balance chain and terminal budget. It then recomputes the snapshot hash and
outer checksum before testing GameState, SaveEnvelope, and restore rejection.

The assertion includes a target issue message and path, preventing a fixture from passing merely
because it accidentally violated an older sequence or final-balance check.
