# P02-002 Legacy P01 Compatibility

P02-002 imports the existing stateless `nextRngState` primitive but does not modify P01's
`DeterministicRng`, legacy hash implementation, Engine `0.1.2-p01-r2`, Save Schema `0.1.0`,
persistence adapters, root exports, or storage namespaces.

The final verification reruns the existing eight-file Legacy/P01-M1-focused suite and both frozen
three-year replays. The expected frozen pair remains:

| Seed               | State hash               | Replay hash              | Weeks / matches / budget      |
| ------------------ | ------------------------ | ------------------------ | ----------------------------- |
| `p01-evidence-001` | `fnv64:d2e562049e32562a` | `fnv64:321321f346df2bd9` | `120 / 96 / 24 / 24 / 208560` |
| `r2-clean-gate`    | `fnv64:8cbf99e1aa4068d4` | `fnv64:62713a07383cbf50` | `120 / 96 / 24 / 24 / 208560` |

The Legacy P01 22-player fixture remains historical regression data only. P02 official/friendly
contracts use an exact 12-player registered roster and do not migrate or reinterpret P01 data.
