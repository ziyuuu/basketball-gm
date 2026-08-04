# P02-003 v2.9-R1 FINAL — Erratum 01

- Issued: 2026-08-04
- Status: `OWNER_CORRECTION / NORMATIVE`
- Scope: one mechanical attribute-name correction
- Affected authority: `03_SCHEMA_AND_ATTRIBUTE_CONTRACT.md` §7.9
- Original v2.9-R1 files and `manifest.sha256`: retained unchanged

## 1. Correction

In `03_SCHEMA_AND_ATTRIBUTE_CONTRACT.md` §7.9, replace only the first term of
`INSIDE_SHOT_PROTECTION`:

```diff
- 450 finishing
+ 450 interiorDefense
```

The complete authoritative formula is:

```text
INSIDE_SHOT_PROTECTION =
  450 interiorDefense
+ 150 athleticism
+ 150 strength
+ 100 height
+  50 absoluteWingspan
+ 100 tacticalUnderstanding
```

All coefficients, normalization rules, precision, rounding and clamps remain unchanged.

## 2. Reason

`INSIDE_SHOT_PROTECTION` is the defender-side execution value for protecting an inside shot.
Using the attacker's `finishing` ability in its primary defensive term is a mechanical copy error:

- §7.8 already uses `finishing` for the attacker-side `INSIDE_CONTACT` value;
- §7.10 uses `interiorDefense` as the primary `BLOCK` ability;
- the frozen ability contract assigns rim protection and inside defense to `interiorDefense`;
- retaining `finishing` would make better finishers better rim protectors and would break the required defensive monotonicity test.

This correction restores the intended offense/defense pairing. It does not introduce a new mechanic or calibration choice.

## 3. Authority and implementation effect

- This erratum takes precedence only over `03_SCHEMA_AND_ATTRIBUTE_CONTRACT.md` §7.9's first term.
- No other v2.9-R1 provision is changed.
- B1R must implement `450 interiorDefense` and add a monotonicity regression proving that increasing only `interiorDefense` cannot reduce `INSIDE_SHOT_PROTECTION`.
- Increasing only `finishing` must not change `INSIDE_SHOT_PROTECTION`.
- No Schema, Behavior ID, EventType, drawKind, semantic ordinal, statistic or replay contract changes.
- Existing v2.9-R1 package bytes and its original manifest remain historical evidence; this erratum has a separate manifest.

## 4. Execution status

This closes the formula-specific R0 blocker and permits the B1R formula work to proceed.

It does not constitute the pending independent v2.9-R1 design audit, does not authorize B7, and does not declare Gate B passed.
