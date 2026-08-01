# P01-M1 Requirements Traceability

| Requirement                                              | Implementation                                               | Evidence                                             |
| -------------------------------------------------------- | ------------------------------------------------------------ | ---------------------------------------------------- |
| `settledYears = floor(resolvedCalendarWeeks / 40)`       | `GameStateSchema.superRefine`                                | eight legal boundary checkpoints                     |
| both completed-year counters equal `settledYears`        | `packages/domain/src/schemas.ts`                             | two isolated counter attacks                         |
| exactly one grant for every settled year and none later  | per-year grant index map                                     | delete, duplicate, and future-year attacks           |
| grant year and week are canonical                        | existing year mapping plus exact year-end refine             | wrong-year and 41/81/121 attacks                     |
| annual amount and stored field equal `50000`             | `P01_ANNUAL_GRANT`                                           | isolated amount and coordinated-field attacks        |
| one canonical initial grant with amount/balance `100000` | `P01_INITIAL_GRANT` plus refine                              | missing, duplicate, amount, and balance-only attacks |
| every ledger balance is continuous                       | previous-entry balance validation                            | internal `balanceAfter` attack                       |
| terminal balance matches budget                          | existing terminal reconciliation                             | terminal-budget attack                               |
| re-signing cannot bypass domain invariants               | nested GameState validation in SaveEnvelope/restore          | 17 re-signed variants                                |
| legal P01 behavior is unchanged                          | constants replace equal literals; settlement uses same value | two frozen state/replay hash pairs                   |
| historical evidence remains immutable                    | explicit `--phase P01-M1` manifest mode                      | before/after manifest SHA-256 comparison             |
