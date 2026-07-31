# P01 Requirements Traceability

| Requirement                       | Implementation                 | Evidence                    |
| --------------------------------- | ------------------------------ | --------------------------- |
| serializable core state           | `packages/domain` Zod schemas  | round-trip tests            |
| 3-year/120-week/96-operation FSM  | domain time resolver           | lifecycle and batch tests   |
| deterministic independent RNG     | domain RNG service             | replay/isolation tests      |
| failed command zero contamination | application session            | transaction tests           |
| unique and week-aligned event IDs | domain event ID contract       | full-run audit ID test      |
| distinguishable saved audit tail  | application/persistence Schema | save/restore audit ID test  |
| match model A invariants          | domain model A                 | statistics tests            |
| versioned save and backup         | persistence packages           | memory/file/IndexedDB tests |
| readable CLI and 1,000 runs       | `apps/sim-cli`                 | P01 simulation report       |
