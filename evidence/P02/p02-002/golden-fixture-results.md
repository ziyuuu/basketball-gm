# P02-002 Golden Fixture Results

## Canonical V2

`tests/fixtures/p02-002/canonical-v2-golden.json` is consumed by
`tests/p02-002-canonical-v2.test.ts`.

- ASCII object canonical form: `{"a":1,"b":2}`
  - SHA-256: `43258cff783fe7036d8a43033f830adfc60ec037382473548ac742b888292777`
- UTF-16 key order: `ascii`, `e` + combining acute, `é`, `中`, `𐀀`, `😀`.
  - It proves code-unit order instead of locale collation and covers a supplementary-plane pair
    whose high surrogate sorts before the grinning-face pair.
  - Canonical SHA-256:
    `382452ed6841bd092cdbee039a7cbfd0237c28c8fc2d9e2b330ab1a0865f487f`.
- Equivalent object insertion orders produce byte-identical canonical output and hashes.
- Standard SHA-256 `abc` vector and invalid lone-surrogate/cycle/non-finite/undefined rejection
  also pass.

## Keyed RNG

`tests/fixtures/p02-002/keyed-rng-golden.json` is consumed by
`tests/p02-002-rng-contract.test.ts`.

| Seed        | Key                 | Digest prefix / uint64 |     uint32 |
| ----------- | ------------------- | ---------------------- | ---------: |
| `[1,2,3,4]` | `(1,0,0,SHOT,0)`    | `0xd8351da516848404`   | 3627359653 |
| `[1,2,3,4]` | `(1,0,0,REBOUND,0)` | `0x55b632c697283952`   | 1438003910 |
| `[1,2,3,4]` | `(2,7,3,SHOT,1)`    | `0x46a7fce14a3b4d57`   | 1185414369 |

The test also proves keyed values are independent of invocation order, an omitted other draw kind,
and unrelated cosmetic/command values; they carry no mutable match draw cursor.
