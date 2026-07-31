# P01 Save Fixture Evidence

The single-run CLI produced:

```text
artifacts/local/p01-saves/autosave.json
artifacts/local/p01-saves/autosave.backup.json
```

The exact local saves are ignored because they contain high-volume deterministic fixture state. Recorded sizes:

- latest: 230,557 bytes;
- previous-good backup: 157,248 bytes.

Automated tests validate:

- envelope Schema;
- snapshot hash and full checksum;
- RNG and command-tail restoration;
- corrupt replacement rejection;
- checksummed annual-grant dates at 41/81/121 rejected before restore;
- previous-good recovery in memory, Node file, and IndexedDB adapters.
