# P00 Verification Report

- Date: 2026-07-31
- Environment: Linux 6.12.13 x86_64
- CPU: AMD EPYC 9V74, 9 visible cores
- Node: 24.14.0
- pnpm: 11.7.0
- TypeScript: 6.0.3

## Commands

```text
pnpm install --frozen-lockfile --store-dir <new-empty-/tmp-store>
pnpm check
pnpm --filter @sunny-court/web dev --host 127.0.0.1 --port 4173
curl --fail http://127.0.0.1:4173/
```

## Results

| Check                             | Result                           |
| --------------------------------- | -------------------------------- |
| Frozen lock install               | PASS; 180 packages downloaded    |
| Prettier                          | PASS                             |
| ESLint                            | PASS                             |
| TypeScript strict                 | PASS                             |
| Package graph                     | PASS; 9 apps/packages, no cycles |
| Domain isolation                  | PASS                             |
| Model SDK/API-key production scan | PASS                             |
| Tests                             | PASS; 8 files, 23 tests          |
| Web production build              | PASS; 17 modules                 |
| sim-cli bundle                    | PASS; Node 24 ESM bundle         |
| Web development smoke             | PASS; HTTP 200 on `127.0.0.1`    |

The final clean-copy `pnpm check` duration was 21.15 seconds, including an 11.46-second Vitest run.

This clean-copy run was performed by the implementation thread. It is reproducible candidate
evidence, not an independent Gate approval.
