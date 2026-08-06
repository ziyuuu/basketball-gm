# P02 Gameplay Baseline Amendment — P02-003 v2.9-R1

- Date: 2026-08-04
- Status: `OWNER_APPROVED`
- Scope: exact replacement of selected P02 player-model and match-model clauses
- Base document: `docs/P02_GAMEPLAY_BASELINE.md` v1.2

This amendment does not reopen the whole P02 gameplay baseline. It replaces only the clauses identified below.

## 1. Replacement for AGENTS/player-model summary

Replace the repository rule:

> P02 uses ten trainable abilities, a static body proxy, six fixed tendencies...

with:

> P02 uses a versioned ability profile. P02-003 v2.9-R1 activates eleven match abilities, including explicit strength; immutable height and wingspan physical content; six fixed tendencies; at most one single-level archetype trait; fatigue; and individual chemistry. Weight is intentionally not modeled. Legacy P02-002 snapshots retain bodyImpact only for compatibility and may not be silently converted into the new physical profile.

## 2. Replacement for baseline §5.1 model overview

Each new-version P02 player contains:

1. identity, grade and rarity;
2. primary position and at most one secondary position;
3. a versioned match ability profile;
4. P02-003 core ability profile `P02_CORE_11_V1`:
   - finishing;
   - shooting;
   - ballHandling;
   - playmaking;
   - perimeterDefense;
   - interiorDefense;
   - rebounding;
   - athleticism;
   - stamina;
   - tacticalUnderstanding;
   - strength;
5. immutable physical profile:
   - heightCm;
   - wingspanCm;
6. six fixed behavior tendencies;
7. zero or one fixed archetype trait;
8. fatigue;
9. individual chemistry;
10. future per-ability XP/soft caps and career statistics in their owning slices.

P02 does not model weight. Height and wingspan are not trainable in P02.

## 3. Replacement for baseline §5.3 abilities

`strength` answers:

> Can the player maintain basketball contact, core stability, screening position, box-out position and low-post leverage?

Primary match uses:

- post-up position;
- contact finishing;
- screen execution;
- box out;
- contested rebound control;
- low-post defensive control.

Strength is not weight and must not be inferred from character art, height, position or rarity.

The remaining ten ability definitions are unchanged.

## 4. Replacement for baseline §5.4 static body proxy

The single `bodyImpact` proxy is removed from the new physical match snapshot.

New physical content:

```text
physicalProfile {
  heightCm
  wingspanCm
}
```

Rules:

- immutable during P02;
- explicitly authored/generated;
- not derived from position or rarity;
- not changed through training;
- used through deterministic normalization in the match engine;
- no standing-reach field in P02-003;
- no weight field.

Legacy `bodyImpact` remains only in the legacy P02-002 snapshot variant.

## 5. Position responsibility amendment

Position does not equal body size and gives no automatic success bonus.

Current lineup slot does create limited defensive-duty bias:

- C: rim anchor;
- PF: rim helper;
- SF: wing helper/interceptor;
- SG: perimeter interceptor;
- PG: point-of-attack pressure.

The bias affects action availability and candidate responsibility only. Final execution remains based on actual abilities, physical profile, fatigue, trait, tactics and RNG.

## 6. Assist amendment

CreationFact does not directly determine assist eligibility.

The assist candidate is the last legal pass received by the eventual scorer in the same segment. Actual credit remains an attribution result based on passer execution versus scorer self-creation.
