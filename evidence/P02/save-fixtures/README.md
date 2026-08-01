# P02-001 Save Regression Scope

P02-001 intentionally introduces no V2 save fixture, migration, envelope, or storage namespace.
The save regression surface is the frozen P01 Legacy contract:

- P01-M1's 17 re-signed attacks remain rejected by GameState, SaveEnvelope, and restore;
- the eight legal annual-grant checkpoints remain valid;
- root and explicit Legacy paths use the same in-memory latest→backup implementation identity;
- existing Node and IndexedDB latest/backup, malformed-save rejection, and restore tests continue
  to pass;
- P01 default IndexedDB name remains `sunny-court-manager-saves`.

Future V2 save fixtures and new namespaces belong to P02-004 and P02-008A, not this evidence set.
