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

## Final verification results

```bash
timeout 600s pnpm check
pnpm --filter @sunny-court/web build
pnpm --filter @sunny-court/sim-cli build
node apps/sim-cli/dist/cli.js run --seed b7-second-round-cli-smoke --json \
  --save-dir /tmp/p02-003-b7-cli-smoke
```

All commands exited `0`. `pnpm check` passed Prettier, ESLint, TypeScript, the 9-package boundary
check, 23 test files / 252 tests, the Web production build, and the CLI production build. Vitest
reported 177.28 seconds. The separate Web build completed in 463 ms; the separate CLI build in
294 ms; and the CLI smoke completed the existing three-year workflow with
`stateHash = fnv64:2ea0523a4dfa1b8e` and `replayHash = fnv64:24810423f0c73f68`.

There is no repository-provided browser interaction smoke command; the separate Vite production
build is the available Web smoke evidence. No performance or B8 conclusion is implied by test
timeout settings or elapsed time.
