# P02-003 v2.9-R2 B7 Third-round Verification Report

## 2026-08-07 scope-correction verification target

The corrected Gate no longer treats exact non-selectable targets, dual substitution reasons or the
internal neutral policy's restoration timing as P02-003 blockers. The correction successor still
passes the real OFFICIAL/FRIENDLY/SCRIMMAGE runner and replay paths.

Local verification on the scope-correction successor:

- focused energy/B6/B7: 3 files, 114/114 tests;
- complete Vitest: 24 files, 349/349 tests;
- Prettier, ESLint, TypeScript and 9-package boundary check: pass;
- Web Vite production build: pass;
- CLI tsup production build: pass;
- batch: 1,000/1,000, 0 failures, 10 replay samples, 0 replay mismatches, 0 calendar/operation-week
  violations and 0 illegal terminal states;
- P02 manifest: 36/36;
- `git diff --check`: pass.

The Work runner's `pnpm` launcher attempted an environment-owned dependency reinstall, so the
local full check was executed as the exact component commands with the repository's installed
binaries. Fresh GitHub CI remains authoritative for the literal `pnpm check` command. Historical
r1--r6 counts below remain historical evidence only.

This is development-thread verification for a local successor to rejected Candidate
`97d6ed55dd31852ed7538b39bae3d55d57ae6e0b`. It is not independent Owner review, a B7 acceptance,
or a Gate B decision. Historical commands below describe the earlier candidate only; this document
separates them from current-successor evidence.

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

## Current successor — directed B7 verification

The following current-successor commands have terminal passing results:

```bash
pnpm exec vitest run tests/p02-003-b7-runner.test.ts
pnpm check
pnpm sim:batch
pnpm evidence:manifest
```

The complete B7 file passed 13/13 tests. New runner regressions cover a non-empty deterministic
`WINDOW_EXPIRED` fallback record and a 16-seed negative sequence `TURNOVER → STEAL →
POSSESSION_ENDED`, then made `SHOT → SCORE → POSSESSION_ENDED`: the following ordinary possession
does not receive a stale transition origin.
The V25 runner-object test is non-vacuous: it creates a Model B
session with a fixed keyed-RNG seed, executes the actual live segment/commit path, and asserts the
complete Event/Fact/Anchor result for `0→11→13→14→30`, `H1→H2→H3→H2`, a final H2 violation, no
unexecuted SPOTUP, and no LATE ordinary-gap access. The pure phase-machine vector remains
supplementary arithmetic coverage only.

The Web and CLI production builds completed successfully. A current successor CLI batch also
completed 1,000/1,000 with 0 failures, 10 replay samples, 0 replay mismatches, 0 calendar or
operation-week violations and 0 illegal terminal states (21,289.28 ms). The P02 manifest validates
35/35.

The repository-prescribed complete command also exited `0` in a persistent terminal session:

```bash
pnpm check
```

It passed Prettier, ESLint, TypeScript, the 9-package boundary check, 23 test files / 255 tests,
the Web production build and the CLI production build. Vitest reported 183.16 seconds. This is
development verification only; it is not an Owner acceptance or Gate B decision.

## Historical directed B7 verification (predecessor only)

```bash
pnpm format
pnpm typecheck
pnpm lint
timeout 420s pnpm vitest run tests/p02-003-b7-runner.test.ts
```

Those historical commands exited `0` for the predecessor. The focused suite then passed 1 file /
10 tests in 38.25 seconds. It proved:

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

## 2026-08-06 定点实现修复 v2.10-energy-r2 Verification

### B7 Runner Fix

The r1 Candidate `acf9bbb` had 4/13 B7 tests failing with "actor must occupy a current lineup slot".
Root cause: `handlerFromCurrentPossession` recovered possession-origin players from REBOUND/STEAL/
POSSESSION_HANDLER facts without verifying lineup membership after neutral rotation substitutions.

**Fix**: Added lineup membership verification in `handlerFromCurrentPossession` (`runner.ts:341-371`).
If the recovered player is no longer in the offense lineup, the function falls through to
`selectModelBHandler` which correctly filters by eligible lineup players.

### Test Results

```bash
pnpm exec vitest run tests/p02-003-b7-runner.test.ts        # 13/13 pass
pnpm exec vitest run tests/p02-003-energy-forced-mismatch.test.ts  # 63/63 pass
pnpm exec vitest run tests/p02-003-b1-registries.test.ts     # 17/17 pass
pnpm exec vitest run tests/p02-003-b2-session.test.ts        # 12/12 pass
pnpm exec vitest run tests/p02-003-b3-clock-rules.test.ts    # (unchanged) pass
pnpm exec vitest run tests/p02-003-b4-behavior-selection.test.ts  # (unchanged) pass
pnpm exec vitest run tests/p02-003-b5-basketball-results.test.ts  # (unchanged) pass
pnpm exec vitest run tests/p02-003-b6-state-rules.test.ts    # 7/7 pass
```

| Suite                 | Pass/Fail   |
| --------------------- | ----------- |
| B1 registries         | 17/17       |
| B2 session            | 12/12       |
| B3 clock rules        | (unchanged) |
| B4 behavior selection | (unchanged) |
| B5 basketball results | (unchanged) |
| B6 state rules        | 7/7         |
| B7 runner             | 13/13       |
| Energy/mismatch (NEW) | 63/63       |
| **Total**             | **149/149** |

### Full Check

```bash
pnpm check   # Prettier, ESLint, TypeScript, boundary check, all tests, Web build, CLI build — pass
pnpm sim:batch  # 0 failures, 0 replay mismatches
pnpm evidence:manifest  # 36/36 verified
```

## 2026-08-06 定点实现修复 v2.10-energy-r4 Verification

### r3 Rejection

The r3 Candidate `904dc2e` was returned by independent review with 5 runtime contract gaps:

1. Active mismatch starters not rejected
2. Forced mismatch penalty bypassed in transition
3. Behavior energy missing participant role contract
4. Forced mismatch selection not closed (hard primary-first, reason codes, return-to-normal)
5. 63 focused tests had false coverage

### r4 Fixes

1. **Behavior energy participant role contract**: Per-role `{actor, target}` intensity table, separate actor/target charging in `addActionTrace`
2. **Transition forced mismatch**: `transitionIndividualExecution` uses real `assignedPosition` and `applyPositionMismatch: true`
3. **Starter primary-position validation**: `makeMatchTeamInputSchema` superRefine rejects mismatched starters
4. **Forced mismatch selection**: `selectBestPrimaryOrFallback` with hard primary-first constraint; `FORCED_MISMATCH_NO_PRIMARY` reason code; `canRestorePrimaryPosition` return-to-normal
5. **Test coverage**: 72 tests (9 new) — real fatigue test, bench recovery, starter rejection, forced mismatch pipeline, 44-behavior participant role matrix

### Test Results

| Suite                 | Pass/Fail   |
| --------------------- | ----------- |
| B1 registries         | 17/17       |
| B2 session            | 12/12       |
| B3 clock rules        | (unchanged) |
| B4 behavior selection | (unchanged) |
| B5 basketball results | (unchanged) |
| B6 state rules        | 7/7         |
| B7 runner             | 13/13       |
| Energy/mismatch       | 72/72       |
| **Total**             | **158/158** |

### Verification Commands

```bash
npx vitest run tests/p02-003-b7-runner.test.ts                    # 13/13
npx vitest run tests/p02-003-energy-forced-mismatch.test.ts        # 72/72
npx vitest run (all 8 P02-003 test files)                          # 158/158
node apps/sim-cli/dist/cli.js batch                                # 1000/1000, 0 failures, 0 replay mismatches
node scripts/generate-evidence-manifest.mjs --phase P02            # 36 entries, LF-normalized
```
