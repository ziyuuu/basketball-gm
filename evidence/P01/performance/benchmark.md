# P01 Performance Snapshot

Environment:

- Linux 6.12.13 x86_64
- AMD EPYC 9V74, 9 visible cores
- Node 24.14.0

Recorded results:

| Workload                       |                        Result |
| ------------------------------ | ----------------------------: |
| 100 runs + 10 replay samples   |                   1,101.92 ms |
| 1,000 runs + 20 replay samples |                   8,573.97 ms |
| Web production build           | 226 ms in R2 clean-copy check |
| sim-cli ESM bundle             |  82 ms in R2 clean-copy check |

These values establish the P01 Work-runner baseline only. They are not a future CI service-level
objective.
