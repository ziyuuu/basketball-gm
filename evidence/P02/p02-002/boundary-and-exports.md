# P02-002 Boundary and Package-Export Conclusion

`pnpm boundaries` passed with 9 packages/apps, no cycle, domain isolation, and Legacy/V2 boundary
enforcement.

The boundary allowlist changed only to admit the P02-002 pure Core modules used by
`domain/match`: Canonical V2, fixed point, the sequential uint32 contract, and the pre-existing
RNG primitive. Match source remains blocked from application, persistence, mutable GameState
resolvers, all other Core source, Web, and Legacy P01 imports. The existing P01-M1 fixture matrix
was rerun unchanged: 106 roots (104 negative and 2 positive) pass exactly as frozen.

`tests/p02-002-package-exports.test.ts` verifies:

- `@sunny-court/domain/core` resolves Canonical V2 and `nextUint32` primitives;
- `@sunny-court/domain/match` resolves Match contracts and keyed draw helpers;
- `packages/domain/package.json` declares those exact subpaths;
- the root `@sunny-court/domain` export remains byte-for-byte the Legacy P01 export surface and
  does not expose Match contracts or keyed RNG.

No new adversarial/security fixture family was added. This use of the existing checker is an
architecture-lint boundary check, not a security-sandbox expansion.
