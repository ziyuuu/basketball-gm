# P00 R1 Clean-Copy Command Output

This is implementation-thread output with ANSI control codes removed. It is not an independent
Gate run.

## Environment

```text
v24.14.0
11.7.0
```

The repository was copied without `.git`, `node_modules`, `dist`, or local artifacts. A new empty
`/tmp` pnpm store was used.

## Frozen install

Command:

```bash
pnpm install --frozen-lockfile --store-dir <new-empty-/tmp-store>
```

Output:

```text
Scope: all 10 workspace projects
Lockfile is up to date, resolution step is skipped
Packages: +180
Progress: resolved 180, reused 0, downloaded 180, added 180, done
Lockfile passes supply-chain policies (285 entries in 4s)
Done in 4.7s using pnpm v11.7.0
```

## Full check

Command:

```bash
pnpm check
```

Output:

```text
All matched files use Prettier code style!
Boundary check passed: 9 packages/apps, no cycles, domain isolated, model/key scan clean.
Test Files  8 passed (8)
Tests       23 passed (23)
Duration    11.46s
vite v8.1.5
17 modules transformed.
Web build completed in 252ms
sim-cli target: node24
ESM dist/cli.js 587.67 KB
ESM build completed in 71ms
```

The complete `pnpm check` command exited 0 after 21.15 seconds.

## Web smoke

```text
VITE v8.1.5 ready in 137 ms
Local: http://127.0.0.1:4173/
curl --fail http://127.0.0.1:4173/
HTTP body began with <!doctype html>
```
