# P02-003 v2.9-R2 B7 Second-round Verification Report

This is development-thread verification for an ordinary successor to rejected Candidate
`b228ab9c1e46127ba663a01096fc8f365d5cf1f9`. It is not independent Owner review, a B7 acceptance,
or a Gate B decision.

## Authority and scope

- Branch/PR: `task/p02-003-headless-model-b`, Draft PR #15.
- Rejected Candidate/tree: `b228ab9c1e46127ba663a01096fc8f365d5cf1f9` /
  `18fd9f0818b6965d64a92c2fa08a8d432aae2e4b`.
- Corrected Owner re-audit SHA-256:
  `e6deb02b55ca8dff23687fe56800f1a02bebc16366d265de1eaea2d375b81e97`.
- Frozen v6 revision SHA-256:
  `29e045ded4e83372d1392946c6e7491665cbddf54e7fa5bd1d89a740bb3bfa68`.
- Frozen v6 package SHA-256:
  `2a3ff4e0f465a68faeb7b1650d26ee40bbbafe45fc7af373176f4dfcb8b43e2c`.

The successor implements B7 runner, causal-chain, clock, Event/Fact/Anchor, replay, test and
evidence remediation only. B8 calibration, 10,000-match performance, balance, realism, UI, Site,
save/security and later milestones are excluded.

## Directed B7 verification

```bash
pnpm format
pnpm typecheck
pnpm lint
timeout 420s pnpm vitest run tests/p02-003-b7-runner.test.ts
```

All commands exited `0`. The focused suite passes 1 file / 10 tests in 38.25 seconds. It proves:

- all 34 selectable IDs execute through a real runner action trace and direct result-event link;
- V25 runs `0 → 11 → 13 → 14 → 30`, enters `LATE_CLOCK`, emits the violation at `H2`, and records
  the frozen `H1 → H2 → H3 → H2` handler/PASS/trace/violation Fact chain;
- the segment-root subvalue helper is deterministic and domain-isolated, and the frozen transition
  formation fixture evaluates to `229`;
- real PASS, HELPD, pressured-turnover/steal attribution, formed/stopped/fallback transition and
  live-ball defensive paths reach their downstream result chains;
- OFFICIAL, FRIENDLY and SCRIMMAGE compare full Events, Facts, Transcript, Anchors, session,
  protocol bundle, MatchResult and identity/digest/hash across step-to-end, run-to-end and replay;
- every test match contains non-empty `RULES`, `ASSISTANT` and `OPPONENT` transcript actors; and
- one minimal **replay/protocol consistency negative** is rejected, demonstrating that replay does
  consume and validate the accepted authority. It is not anti-tamper or player-save protection.

The final full-repository command, separate Web/CLI builds, manifest validation and published-CI
outcome are appended below only after their actual terminal results are available.

## Existing-contract regression scope

The full `pnpm check` command includes the existing P00, P01, P02-001, P02-002 and B1R–B6R test
matrices as well as the B7 suite. It remains the evidence for unchanged frozen-contract regression;
this round does not replace Legacy evidence or alter B1R–B6R product contracts.

## Follow-up verification results

```bash
pnpm exec vitest run tests/p02-003-b1-registries.test.ts --reporter=verbose
pnpm exec vitest run tests/p02-003-b2-session.test.ts --reporter=verbose
pnpm exec vitest run tests/p02-003-b3-clock-rules.test.ts --reporter=verbose
pnpm exec vitest run tests/p02-003-b4-behavior-selection.test.ts --reporter=verbose
pnpm exec vitest run tests/p02-003-b5-basketball-results.test.ts --reporter=verbose
pnpm exec vitest run tests/p02-003-b6-state-rules.test.ts --reporter=verbose
pnpm exec vitest run tests/p02-003-b7-runner.test.ts --reporter=verbose
pnpm exec vitest run tests/p02-003-b7-runner.test.ts --reporter=verbose -t SCRIMMAGE
pnpm exec vitest run tests/p02-003-b7-runner.test.ts --reporter=verbose -t 'rejects a transcript'
pnpm build
pnpm sim:batch
```

All listed focused commands exited `0`. The B1--B6 files passed 73 tests. The B7 runner file
passed its 10 tests; because the all-case reporter output ends before the final two long cases in
this environment, SCRIMMAGE equality and the replay/protocol negative were also run by name and
each passed with a terminal summary. `pnpm build` passed TypeScript plus the Web and CLI production
builds. `pnpm sim:batch` completed 1,000 / 1,000 requested runs with 0 failures, 10 replay samples,
0 replay mismatches, 0 calendar/operation-week violations and 0 illegal terminal states.

The repository-prescribed complete command was subsequently run through one persistent terminal
session and exited `0`:

```bash
pnpm check
```

It passed Prettier, ESLint, TypeScript, the 9-package boundary check, 23 test files / 252 tests,
the Web production build and the CLI production build. Vitest reported 177.20 seconds. There is no
repository-provided browser interaction smoke command; the Vite production build is the available
Web smoke evidence. No performance or B8 conclusion is implied by the verification above.
