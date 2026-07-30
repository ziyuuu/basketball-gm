# ADR-0003: defer production UI state library until P04

- Status: Accepted for P00
- Date: 2026-07-31

## Decision

Do not select Zustand or Redux Toolkit during P00. The Web app is an engineering shell only. Production UI state requirements will be measured against real P02/P03 fixtures in P04.

## Rationale

The rules state lives behind the application command boundary regardless of presenter library. Selecting a global UI store before real roster, training, and match tasks exist would freeze an untested interaction architecture.

## Consequences

- P00 Web uses only local React rendering.
- P04 must document and test the eventual UI-state choice.
