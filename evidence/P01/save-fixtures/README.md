# P01 Save Fixture Evidence

The single-run CLI produced:

```text
artifacts/local/p01-saves/autosave.json
artifacts/local/p01-saves/autosave.backup.json
```

The exact local saves are ignored because they contain high-volume deterministic fixture state. Recorded sizes:

- latest: 229,949 bytes;
- previous-good backup: 156,565 bytes.

Automated tests validate:

- envelope Schema;
- snapshot hash and full checksum;
- RNG and command-tail restoration;
- corrupt replacement rejection;
- previous-good recovery in memory, Node file, and IndexedDB adapters.
