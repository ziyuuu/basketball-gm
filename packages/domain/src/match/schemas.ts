import { z } from 'zod';

import {
  canonicalizeV2,
  compareUtf16CodeUnits,
  idHash,
  isCanonicalV2Hash,
  type CanonicalV2Value,
} from '../core/canonical-v2.js';

const NonEmptyStringSchema = z.string().min(1).max(256);
const NonNegativeSafeIntegerSchema = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const PositiveSafeIntegerSchema = z.number().int().min(1).max(Number.MAX_SAFE_INTEGER);
const Uint32Schema = z.number().int().min(0).max(0xffff_ffff);
const MilliSchema = z.number().int().min(0).max(100_000);
const IdentityHashSchema = z
  .string()
  .refine(isCanonicalV2Hash, 'Expected a sha256:<64 lowercase hex> identity hash.');

export type MatchIdentityHash = z.infer<typeof IdentityHashSchema>;

export type CanonicalMatchValue = CanonicalV2Value;
const CanonicalV2ValueSchemaInternal: z.ZodType<CanonicalMatchValue> = z.lazy(() =>
  z.union([
    z.null(),
    z.boolean(),
    z.number().finite(),
    z.string(),
    z.array(CanonicalV2ValueSchemaInternal),
    z.record(z.string(), CanonicalV2ValueSchemaInternal),
  ]),
);
export const CanonicalMatchValueSchema = CanonicalV2ValueSchemaInternal;

function addIssue(
  context: z.RefinementCtx,
  path: readonly (string | number)[],
  message: string,
): void {
  context.addIssue({ code: 'custom', path: [...path], message });
}

function requireUniqueStrings(
  values: readonly string[],
  context: z.RefinementCtx,
  path: readonly (string | number)[],
  label: string,
): void {
  if (new Set(values).size !== values.length) {
    addIssue(context, path, `${label} must not contain duplicates.`);
  }
}

function requireSameStringSet(
  left: readonly string[],
  right: readonly string[],
  context: z.RefinementCtx,
  path: readonly (string | number)[],
  label: string,
): void {
  if (left.length !== right.length || left.some((value) => !new Set(right).has(value))) {
    addIssue(context, path, `${label} must contain exactly the same identifiers.`);
  }
}

function requireSubsetOfStrings(
  values: readonly string[],
  allowed: ReadonlySet<string>,
  context: z.RefinementCtx,
  path: readonly (string | number)[],
  label: string,
): void {
  if (values.some((value) => !allowed.has(value))) {
    addIssue(
      context,
      path,
      `${label} must only reference participants in this immutable MatchInput.`,
    );
  }
}

function asCanonicalValue(value: unknown): CanonicalV2Value {
  const candidate = value as CanonicalV2Value;
  canonicalizeV2(candidate);
  return candidate;
}

export const MatchKindSchema = z.enum(['OFFICIAL', 'FRIENDLY', 'SCRIMMAGE']);
export const RecordScopeSchema = z.enum([
  'OFFICIAL_CAREER',
  'FRIENDLY_ARCHIVE',
  'SCRIMMAGE_OBSERVATION',
]);
export const MatchClassificationSchema = z.discriminatedUnion('matchKind', [
  z
    .object({ matchKind: z.literal('OFFICIAL'), recordScope: z.literal('OFFICIAL_CAREER') })
    .strict(),
  z
    .object({ matchKind: z.literal('FRIENDLY'), recordScope: z.literal('FRIENDLY_ARCHIVE') })
    .strict(),
  z
    .object({ matchKind: z.literal('SCRIMMAGE'), recordScope: z.literal('SCRIMMAGE_OBSERVATION') })
    .strict(),
]);

export type MatchKind = z.infer<typeof MatchKindSchema>;
export type RecordScope = z.infer<typeof RecordScopeSchema>;

function hasValidClassificationPair(matchKind: MatchKind, recordScope: RecordScope): boolean {
  return (
    (matchKind === 'OFFICIAL' && recordScope === 'OFFICIAL_CAREER') ||
    (matchKind === 'FRIENDLY' && recordScope === 'FRIENDLY_ARCHIVE') ||
    (matchKind === 'SCRIMMAGE' && recordScope === 'SCRIMMAGE_OBSERVATION')
  );
}

export const PositionSchema = z.enum(['PG', 'SG', 'SF', 'PF', 'C']);
export const MatchSideSchema = z.enum(['HOME', 'AWAY']);
export const ControlStrategySchema = z.enum(['INSTANT', 'FULL_COACH']);
export const RotationPresetSchema = z.enum(['SHALLOW', 'BALANCED', 'DEEP', 'MANUAL']);

export const MatchAbilitiesSchema = z
  .object({
    finishing: z.number().int().min(0).max(100),
    shooting: z.number().int().min(0).max(100),
    ballHandling: z.number().int().min(0).max(100),
    playmaking: z.number().int().min(0).max(100),
    perimeterDefense: z.number().int().min(0).max(100),
    interiorDefense: z.number().int().min(0).max(100),
    rebounding: z.number().int().min(0).max(100),
    athleticism: z.number().int().min(0).max(100),
    stamina: z.number().int().min(0).max(100),
    tacticalUnderstanding: z.number().int().min(0).max(100),
  })
  .strict();

export const PhysicalMatchAbilitiesV1Schema = MatchAbilitiesSchema.extend({
  strength: z.number().int().min(0).max(100),
}).strict();

export const MatchTendenciesSchema = z
  .object({
    possessionParticipation: z.number().int().min(0).max(100),
    passSelection: z.number().int().min(0).max(100),
    shotZones: z
      .object({
        perimeter: z.number().int().min(0).max(100),
        midRange: z.number().int().min(0).max(100),
        inside: z.number().int().min(0).max(100),
      })
      .strict(),
    transitionParticipation: z.number().int().min(0).max(100),
    defensiveRisk: z.number().int().min(0).max(100),
    offensiveRebounding: z.number().int().min(0).max(100),
  })
  .strict()
  .superRefine((value, context) => {
    const total = value.shotZones.perimeter + value.shotZones.midRange + value.shotZones.inside;
    if (total !== 100)
      addIssue(context, ['shotZones'], 'Shot-zone tendencies must total exactly 100.');
  });

export const ArchetypeTraitSchema = z.enum([
  'SPOT_SHOOTER',
  'TOUGH_FINISHER',
  'STEADY_HANDLER',
  'PERIMETER_LOCK',
  'PAINT_BARRIER',
  'REBOUND_INSTINCT',
]);

export const LegacyMatchPlayerSnapshotSchema = z
  .object({
    playerId: NonEmptyStringSchema,
    primaryPosition: PositionSchema,
    secondaryPosition: PositionSchema.nullable(),
    abilities: MatchAbilitiesSchema,
    bodyImpact: z.number().int().min(0).max(100),
    tendencies: MatchTendenciesSchema,
    archetypeTrait: ArchetypeTraitSchema.nullable(),
    fatigueMilli: MilliSchema,
    chemistryMilli: MilliSchema,
  })
  .strict()
  .superRefine((value, context) => {
    if (value.secondaryPosition === value.primaryPosition) {
      addIssue(
        context,
        ['secondaryPosition'],
        'Secondary position must differ from primary position.',
      );
    }
  });

export const PhysicalMatchPlayerSnapshotV1Schema = z
  .object({
    snapshotVersion: z.literal('P02_MATCH_PLAYER_PHYSICAL_V1'),
    playerId: NonEmptyStringSchema,
    primaryPosition: PositionSchema,
    secondaryPosition: PositionSchema.nullable(),
    abilityProfile: z
      .object({
        version: z.literal('P02_CORE_11_V1'),
        values: PhysicalMatchAbilitiesV1Schema,
      })
      .strict(),
    physicalProfile: z
      .object({
        version: z.literal('HEIGHT_WINGSPAN_CM_V1'),
        heightCm: z.number().int().min(140).max(220),
        wingspanCm: z.number().int().min(140).max(235),
      })
      .strict(),
    tendencies: MatchTendenciesSchema,
    archetypeTrait: ArchetypeTraitSchema.nullable(),
    fatigueMilli: MilliSchema,
    chemistryMilli: MilliSchema,
  })
  .strict()
  .superRefine((value, context) => {
    if (value.secondaryPosition === value.primaryPosition) {
      addIssue(
        context,
        ['secondaryPosition'],
        'Secondary position must differ from primary position.',
      );
    }
  });

export const MatchPlayerSnapshotSchema = z.union([
  LegacyMatchPlayerSnapshotSchema,
  PhysicalMatchPlayerSnapshotV1Schema,
]);

export type LegacyMatchPlayerSnapshot = z.infer<typeof LegacyMatchPlayerSnapshotSchema>;
export type PhysicalMatchPlayerSnapshotV1 = z.infer<typeof PhysicalMatchPlayerSnapshotV1Schema>;
export type MatchPlayerSnapshotValue = z.infer<typeof MatchPlayerSnapshotSchema>;

export type MatchPosition = z.infer<typeof PositionSchema>;

/** All five lineup slots in canonical order. */
export const POSITION_SLOTS: readonly MatchPosition[] = ['PG', 'SG', 'SF', 'PF', 'C'];

export const StartingLineupSchema = z
  .object({
    PG: NonEmptyStringSchema,
    SG: NonEmptyStringSchema,
    SF: NonEmptyStringSchema,
    PF: NonEmptyStringSchema,
    C: NonEmptyStringSchema,
  })
  .strict()
  .superRefine((value, context) => {
    requireUniqueStrings(Object.values(value), context, [], 'The five starting slots');
  });

export const MatchRoleAssignmentsSchema = z
  .object({
    primaryOrganizer: NonEmptyStringSchema,
    offensiveHub: NonEmptyStringSchema,
    defensiveCaptain: NonEmptyStringSchema,
  })
  .strict();

export const MatchTacticsSchema = z
  .object({
    pace: z.enum(['SLOW', 'BALANCED', 'FAST']),
    offensiveFocus: z.enum(['PERIMETER', 'BALANCED', 'INTERIOR']),
    defensiveFocus: z.enum(['PRESSURE', 'BALANCED', 'PAINT_PROTECT']),
  })
  .strict();

function makeMatchTeamInputSchema(expectedRosterSize: number) {
  return z
    .object({
      teamId: NonEmptyStringSchema,
      registeredRosterIds: z.array(NonEmptyStringSchema).length(expectedRosterSize),
      players: z.array(MatchPlayerSnapshotSchema).length(expectedRosterSize),
      startingLineup: StartingLineupSchema,
      roles: MatchRoleAssignmentsSchema,
      tactics: MatchTacticsSchema,
      rotationPreset: RotationPresetSchema,
    })
    .strict()
    .superRefine((value, context) => {
      const playerIds = value.players.map((player) => player.playerId);
      requireUniqueStrings(playerIds, context, ['players'], 'Match players');
      requireUniqueStrings(
        value.registeredRosterIds,
        context,
        ['registeredRosterIds'],
        'Registered roster IDs',
      );
      requireSameStringSet(
        value.registeredRosterIds,
        playerIds,
        context,
        ['registeredRosterIds'],
        'Registered roster IDs and player snapshots',
      );

      const starters = Object.values(value.startingLineup);
      for (const [slot, playerId] of Object.entries(value.startingLineup)) {
        if (!playerIds.includes(playerId)) {
          addIssue(
            context,
            ['startingLineup', slot],
            'Starter must be included in the registered roster.',
          );
        }
      }
      // v2.10: Reject active mismatch starters — each starter must play their primary position
      for (const slot of POSITION_SLOTS) {
        const starterId = value.startingLineup[slot];
        const starter = value.players.find((p) => p.playerId === starterId);
        if (starter !== undefined && starter.primaryPosition !== slot) {
          addIssue(
            context,
            ['startingLineup', slot],
            `Starter ${starterId} has primary position ${starter.primaryPosition} but is assigned to the ${slot} slot. Active mismatch starters are rejected.`,
          );
        }
      }
      for (const [role, playerId] of Object.entries(value.roles)) {
        if (!starters.includes(playerId)) {
          addIssue(context, ['roles', role], 'Role holder must be one of the five starters.');
        }
      }
    });
}

export const FullRosterMatchTeamInputSchema = makeMatchTeamInputSchema(12);
export const ScrimmageSideInputSchema = makeMatchTeamInputSchema(6);

export const MatchSeedMaterialSchema = z.tuple([
  Uint32Schema,
  Uint32Schema,
  Uint32Schema,
  Uint32Schema,
]);
export type MatchSeedMaterial = z.infer<typeof MatchSeedMaterialSchema>;

export const MatchDrawKindSchema = z.enum([
  'SEGMENT_DURATION',
  'TRANSITION',
  'BALL_HANDLER',
  'DEFENSIVE_ACTION',
  'TURNOVER_OCCURRENCE',
  'TURNOVER_CLASSIFICATION',
  'BEHAVIOR',
  'SHOOTER',
  'SHOT',
  'OFFENSIVE_FOUL',
  'DEFENSIVE_FOUL',
  'FOUL_TYPE',
  'REBOUND',
  'STEAL_ATTRIBUTION',
  'BLOCK_ATTRIBUTION',
  'ASSIST_ATTRIBUTION',
]);
export type MatchDrawKind = z.infer<typeof MatchDrawKindSchema>;

export const GameIdentitySchema = z
  .object({
    rootSeed: NonEmptyStringSchema,
    newGameDescriptor: z.record(z.string(), CanonicalMatchValueSchema),
    rulesVersion: NonEmptyStringSchema,
    contentHashes: z.record(NonEmptyStringSchema, IdentityHashSchema),
  })
  .strict()
  .superRefine((value, context) => {
    if (Object.keys(value.contentHashes).length === 0) {
      addIssue(context, ['contentHashes'], 'At least one authoritative content hash is required.');
    }
  });

export const MatchRulesSchema = z
  .object({
    regularPeriodSeconds: z.literal(600),
    overtimePeriodSeconds: z.literal(300),
    foulOutLimit: z.literal(5),
  })
  .strict();

const MatchInputBaseSchema = z
  .object({
    gameIdentity: GameIdentitySchema,
    gameId: IdentityHashSchema,
    matchId: IdentityHashSchema,
    absoluteWeek: PositiveSafeIntegerSchema,
    slotIdentity: NonEmptyStringSchema,
    rules: MatchRulesSchema,
    matchSeed: MatchSeedMaterialSchema,
    controlStrategy: ControlStrategySchema,
    matchInputHash: IdentityHashSchema,
  })
  .strict();

const OfficialMatchInputSchema = MatchInputBaseSchema.extend({
  matchKind: z.literal('OFFICIAL'),
  recordScope: z.literal('OFFICIAL_CAREER'),
  homeTeam: FullRosterMatchTeamInputSchema,
  awayTeam: FullRosterMatchTeamInputSchema,
}).strict();

const FriendlyMatchInputSchema = MatchInputBaseSchema.extend({
  matchKind: z.literal('FRIENDLY'),
  recordScope: z.literal('FRIENDLY_ARCHIVE'),
  homeTeam: FullRosterMatchTeamInputSchema,
  awayTeam: FullRosterMatchTeamInputSchema,
}).strict();

const ScrimmageMatchInputSchema = MatchInputBaseSchema.extend({
  matchKind: z.literal('SCRIMMAGE'),
  recordScope: z.literal('SCRIMMAGE_OBSERVATION'),
  sourceTeamId: NonEmptyStringSchema,
  sourceRosterIds: z.array(NonEmptyStringSchema).length(12),
  homeTeam: ScrimmageSideInputSchema,
  awayTeam: ScrimmageSideInputSchema,
  controlStrategy: z.literal('INSTANT'),
}).strict();

export const MatchInputSchema = z
  .discriminatedUnion('matchKind', [
    OfficialMatchInputSchema,
    FriendlyMatchInputSchema,
    ScrimmageMatchInputSchema,
  ])
  .superRefine((value, context) => {
    if (!hasValidClassificationPair(value.matchKind, value.recordScope)) {
      addIssue(
        context,
        ['recordScope'],
        'Match kind and record scope are not a valid classified pair.',
      );
    }
    if (value.matchKind !== 'SCRIMMAGE' && value.homeTeam.teamId === value.awayTeam.teamId) {
      addIssue(context, ['awayTeam', 'teamId'], 'Home and away team identities must differ.');
    }
    const homeIds = value.homeTeam.players.map((player) => player.playerId);
    const awayIds = value.awayTeam.players.map((player) => player.playerId);
    if (homeIds.some((playerId) => awayIds.includes(playerId))) {
      addIssue(
        context,
        ['awayTeam', 'players'],
        'A participant cannot appear on both sides of one match.',
      );
    }
    if (value.matchKind === 'SCRIMMAGE') {
      if (
        value.homeTeam.teamId !== value.sourceTeamId ||
        value.awayTeam.teamId !== value.sourceTeamId
      ) {
        addIssue(
          context,
          ['sourceTeamId'],
          'Scrimmage sides must be the deterministic 6-vs-6 split of the one source team.',
        );
      }
      requireUniqueStrings(
        value.sourceRosterIds,
        context,
        ['sourceRosterIds'],
        'Scrimmage source roster IDs',
      );
      requireSameStringSet(
        value.sourceRosterIds,
        [...homeIds, ...awayIds],
        context,
        ['sourceRosterIds'],
        'Scrimmage source roster and the deterministic 6-vs-6 sides',
      );
    }

    const expectedGameId = deriveGameId(value.gameIdentity);
    if (value.gameId !== expectedGameId) {
      addIssue(
        context,
        ['gameId'],
        'gameId does not match its deterministic game identity inputs.',
      );
    }
    const expectedMatchId = deriveMatchId(value);
    if (value.matchId !== expectedMatchId) {
      addIssue(
        context,
        ['matchId'],
        'matchId does not match its deterministic match identity inputs.',
      );
    }
    const expectedInputHash = deriveMatchInputHash(value);
    if (value.matchInputHash !== expectedInputHash) {
      addIssue(
        context,
        ['matchInputHash'],
        'Match input hash does not bind the complete immutable input.',
      );
    }
  });

export type MatchInput = z.infer<typeof MatchInputSchema>;

export function deriveGameId(input: z.infer<typeof GameIdentitySchema>): string {
  return idHash(
    'game-v2',
    input.rootSeed,
    asCanonicalValue(input.newGameDescriptor),
    input.rulesVersion,
    asCanonicalValue(input.contentHashes),
  );
}

export function deriveMatchId(
  input: Pick<MatchInput, 'gameId' | 'absoluteWeek' | 'matchKind' | 'recordScope' | 'slotIdentity'>,
): string {
  return idHash(
    'match-v2',
    input.gameId,
    input.absoluteWeek,
    input.matchKind,
    input.recordScope,
    input.slotIdentity,
  );
}

export function deriveMatchInputHash(input: MatchInput): string {
  const { matchInputHash: _matchInputHash, ...identity } = input;
  return idHash('match-input-v2', asCanonicalValue(identity));
}

export const SegmentKeySchema = z
  .object({
    period: PositiveSafeIntegerSchema,
    possessionIndex: NonNegativeSafeIntegerSchema,
    segmentIndex: NonNegativeSafeIntegerSchema,
  })
  .strict();

export const ControlBoundarySchema = SegmentKeySchema.extend({
  kind: z.enum(['MATCH_START', 'DEAD_BALL', 'PERIOD_BREAK', 'MATCH_COMPLETE']),
}).strict();

export const EffectSourceSchema = z
  .object({
    kind: z.enum(['BASE_TACTIC', 'OPPONENT_POLICY']),
    sourceId: NonEmptyStringSchema,
    reasonCode: NonEmptyStringSchema,
  })
  .strict();

export const EffectParameterSchema = z.enum([
  'PACE',
  'PERIMETER_ATTEMPT_WEIGHT',
  'INTERIOR_ATTEMPT_WEIGHT',
  'PERIMETER_DEFENSE_EXECUTION',
  'INTERIOR_DEFENSE_EXECUTION',
  'DEFENSIVE_REBOUND_EXECUTION',
  'TURNOVER_PRESSURE',
  'OPPORTUNITY_QUALITY',
]);

export const EffectTargetSchema = z
  .object({
    side: MatchSideSchema,
    scope: z.enum(['TEAM', 'PLAYER', 'BEHAVIOR']),
    playerId: NonEmptyStringSchema.nullable(),
    behavior: z.enum(['TRANSITION', 'PASS', 'SHOT', 'DEFENSE', 'REBOUND']).nullable(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.scope === 'PLAYER' && value.playerId === null) {
      addIssue(context, ['playerId'], 'Player-scoped effects require a playerId.');
    }
    if (value.scope !== 'PLAYER' && value.playerId !== null) {
      addIssue(context, ['playerId'], 'Only player-scoped effects may contain a playerId.');
    }
    if (value.scope === 'BEHAVIOR' && value.behavior === null) {
      addIssue(context, ['behavior'], 'Behavior-scoped effects require a behavior.');
    }
    if (value.scope !== 'BEHAVIOR' && value.behavior !== null) {
      addIssue(context, ['behavior'], 'Only behavior-scoped effects may contain a behavior.');
    }
  });

export const EffectModifierSchema = z.discriminatedUnion('mode', [
  z
    .object({ mode: z.literal('ADD'), valueMilli: z.number().int().min(-6_000).max(6_000) })
    .strict(),
  z
    .object({ mode: z.literal('MULTIPLY'), multiplierMilli: z.number().int().min(1).max(10_000) })
    .strict(),
]);

export const EffectDurationSchema = z.discriminatedUnion('kind', [
  z
    .object({ kind: z.literal('POSSESSIONS'), remainingPossessions: PositiveSafeIntegerSchema })
    .strict(),
  z.object({ kind: z.literal('PERIOD_END') }).strict(),
  z.object({ kind: z.literal('UNTIL_REPLACED') }).strict(),
]);

export const MatchEffectSchema = z
  .object({
    effectKey: NonEmptyStringSchema,
    source: EffectSourceSchema,
    sourceRevision: NonNegativeSafeIntegerSchema,
    controlBoundary: ControlBoundarySchema,
    effectiveFromSegmentKey: SegmentKeySchema,
    target: EffectTargetSchema,
    parameter: EffectParameterSchema,
    modifier: EffectModifierSchema,
    duration: EffectDurationSchema,
  })
  .strict()
  .superRefine((value, context) => {
    if (value.effectKey !== deriveEffectKey(value)) {
      addIssue(
        context,
        ['effectKey'],
        'effectKey must be the stable identity of source, target, and parameter.',
      );
    }
    if (
      value.effectiveFromSegmentKey.period !== value.controlBoundary.period ||
      value.effectiveFromSegmentKey.possessionIndex !== value.controlBoundary.possessionIndex ||
      value.effectiveFromSegmentKey.segmentIndex !== value.controlBoundary.segmentIndex
    ) {
      addIssue(
        context,
        ['effectiveFromSegmentKey'],
        'Effect activation must bind the control boundary where it was accepted.',
      );
    }
  });

export type MatchEffect = z.infer<typeof MatchEffectSchema>;

export function deriveEffectKey(
  input: Pick<MatchEffect, 'source' | 'target' | 'parameter'>,
): string {
  return `effect:${idHash(
    'match-effect-key-v2',
    asCanonicalValue({ kind: input.source.kind, sourceId: input.source.sourceId }),
    asCanonicalValue(input.target),
    input.parameter,
  )}`;
}

export const EffectiveFragmentSchema = z
  .object({
    tactics: z.object({ home: MatchTacticsSchema, away: MatchTacticsSchema }).strict(),
    roles: z
      .object({ home: MatchRoleAssignmentsSchema, away: MatchRoleAssignmentsSchema })
      .strict(),
    lineups: z.object({ home: StartingLineupSchema, away: StartingLineupSchema }).strict(),
    effects: z.array(MatchEffectSchema),
  })
  .strict()
  .superRefine((value, context) => {
    requireUniqueStrings(
      value.effects.map((effect) => effect.effectKey),
      context,
      ['effects'],
      'Effective fragment effect keys',
    );
  });

export const PlayerBoxScoreSchema = z
  .object({
    playerId: NonEmptyStringSchema,
    secondsPlayed: NonNegativeSafeIntegerSchema,
    points: NonNegativeSafeIntegerSchema,
    fieldGoalsMade: NonNegativeSafeIntegerSchema,
    fieldGoalsAttempted: NonNegativeSafeIntegerSchema,
    threePointersMade: NonNegativeSafeIntegerSchema,
    threePointersAttempted: NonNegativeSafeIntegerSchema,
    freeThrowsMade: NonNegativeSafeIntegerSchema,
    freeThrowsAttempted: NonNegativeSafeIntegerSchema,
    offensiveRebounds: NonNegativeSafeIntegerSchema,
    defensiveRebounds: NonNegativeSafeIntegerSchema,
    assists: NonNegativeSafeIntegerSchema,
    steals: NonNegativeSafeIntegerSchema,
    blocks: NonNegativeSafeIntegerSchema,
    turnovers: NonNegativeSafeIntegerSchema,
    personalFouls: NonNegativeSafeIntegerSchema,
  })
  .strict()
  .superRefine((value, context) => {
    if (value.fieldGoalsMade > value.fieldGoalsAttempted) {
      addIssue(context, ['fieldGoalsMade'], 'Field goals made cannot exceed attempts.');
    }
    if (value.threePointersMade > value.threePointersAttempted) {
      addIssue(context, ['threePointersMade'], 'Three-pointers made cannot exceed attempts.');
    }
    if (value.threePointersAttempted > value.fieldGoalsAttempted) {
      addIssue(
        context,
        ['threePointersAttempted'],
        'Three-point attempts cannot exceed field-goal attempts.',
      );
    }
    if (value.freeThrowsMade > value.freeThrowsAttempted) {
      addIssue(context, ['freeThrowsMade'], 'Free throws made cannot exceed attempts.');
    }
  });

export const TeamBoxScoreSchema = z
  .object({
    players: z.array(PlayerBoxScoreSchema),
  })
  .strict()
  .superRefine((value, context) => {
    requireUniqueStrings(
      value.players.map((player) => player.playerId),
      context,
      ['players'],
      'Box-score player IDs',
    );
  });

export const MatchAnchorSchema = z
  .object({
    matchId: IdentityHashSchema,
    previousAnchorHash: IdentityHashSchema,
    anchorHash: IdentityHashSchema,
    period: PositiveSafeIntegerSchema,
    periodClockSeconds: NonNegativeSafeIntegerSchema,
    score: z
      .object({ home: NonNegativeSafeIntegerSchema, away: NonNegativeSafeIntegerSchema })
      .strict(),
    possession: z
      .object({
        side: MatchSideSchema,
        possessionIndex: NonNegativeSafeIntegerSchema,
        segmentIndex: NonNegativeSafeIntegerSchema,
      })
      .strict(),
    eventCursor: NonNegativeSafeIntegerSchema,
    transcriptCursor: NonNegativeSafeIntegerSchema,
    localRevision: NonNegativeSafeIntegerSchema,
    lineups: z.object({ home: StartingLineupSchema, away: StartingLineupSchema }).strict(),
    roles: z
      .object({ home: MatchRoleAssignmentsSchema, away: MatchRoleAssignmentsSchema })
      .strict(),
    pendingSubstitutionEntryHashes: z.array(IdentityHashSchema),
    fatigueMilliByPlayer: z.record(NonEmptyStringSchema, MilliSchema),
    chemistryWeightedMilli: z.object({ home: MilliSchema, away: MilliSchema }).strict(),
    boxScore: z.object({ home: TeamBoxScoreSchema, away: TeamBoxScoreSchema }).strict(),
    effectiveFragment: EffectiveFragmentSchema,
    effectiveFragmentHash: IdentityHashSchema,
    controlBoundary: ControlBoundarySchema.nullable(),
    status: z.enum(['IN_PROGRESS', 'COMPLETED', 'FORFEIT_INSUFFICIENT_PLAYERS']),
  })
  .strict()
  .superRefine((value, context) => {
    requireUniqueStrings(
      value.pendingSubstitutionEntryHashes,
      context,
      ['pendingSubstitutionEntryHashes'],
      'Pending substitution transcript entries',
    );
    const expectedFragmentHash = deriveEffectiveFragmentHash({
      matchId: value.matchId,
      previousAnchorHash: value.previousAnchorHash,
      controlBoundary: value.controlBoundary,
      fragment: value.effectiveFragment,
    });
    if (value.effectiveFragmentHash !== expectedFragmentHash) {
      addIssue(
        context,
        ['effectiveFragmentHash'],
        'Anchor effective fragment hash does not bind its inputs.',
      );
    }
    if (
      canonicalizeV2(value.lineups) !== canonicalizeV2(value.effectiveFragment.lineups) ||
      canonicalizeV2(value.roles) !== canonicalizeV2(value.effectiveFragment.roles)
    ) {
      addIssue(
        context,
        ['effectiveFragment'],
        'Anchor lineups and roles must equal the effective fragment committed by its hash.',
      );
    }
    const expectedAnchorHash = deriveMatchAnchorHash(value);
    if (value.anchorHash !== expectedAnchorHash) {
      addIssue(context, ['anchorHash'], 'Anchor hash does not bind the complete committed anchor.');
    }
  });

export type MatchAnchor = z.infer<typeof MatchAnchorSchema>;

export const GENESIS_MATCH_ANCHOR_HASH = idHash('match-anchor-genesis-v2');
export const GENESIS_MATCH_TRANSCRIPT_HASH = idHash('match-transcript-genesis-v2');

export function deriveEffectiveFragmentHash(
  input: Readonly<{
    matchId: string;
    previousAnchorHash: string;
    controlBoundary: z.infer<typeof ControlBoundarySchema> | null;
    fragment: z.infer<typeof EffectiveFragmentSchema>;
  }>,
): string {
  return idHash(
    'effective-fragment-v2',
    input.matchId,
    input.previousAnchorHash,
    input.controlBoundary === null ? null : asCanonicalValue(input.controlBoundary),
    asCanonicalValue(input.fragment),
  );
}

export function deriveMatchAnchorHash(input: MatchAnchor): string {
  const { anchorHash: _anchorHash, ...identity } = input;
  return idHash('match-anchor-v2', asCanonicalValue(identity));
}

export const MatchEventTypeSchema = z.enum([
  'CLOCK_ADVANCED',
  'POSSESSION_STARTED',
  'POSSESSION_ENDED',
  'TURNOVER',
  'FOUL',
  'FREE_THROW',
  'SHOT',
  'REBOUND',
  'SCORE',
  'ASSIST',
  'STEAL',
  'BLOCK',
  'SUBSTITUTION',
  'EFFECT_APPLIED',
  'PERIOD_COMPLETED',
  'MATCH_COMPLETED',
]);

export const MatchEventPayloadSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('CLOCK_ADVANCED'), seconds: PositiveSafeIntegerSchema }).strict(),
  z.object({ type: z.literal('POSSESSION_STARTED'), side: MatchSideSchema }).strict(),
  z.object({ type: z.literal('POSSESSION_ENDED'), side: MatchSideSchema }).strict(),
  z
    .object({
      type: z.literal('TURNOVER'),
      playerId: NonEmptyStringSchema,
      turnoverKind: z.enum(['PRESSURED_LIVE_BALL', 'UNFORCED_DEAD_BALL', 'OFFENSIVE_FOUL']),
    })
    .strict(),
  z
    .object({
      type: z.literal('FOUL'),
      playerId: NonEmptyStringSchema,
      foulKind: z.enum(['PERSONAL', 'SHOOTING', 'OFFENSIVE']),
    })
    .strict(),
  z
    .object({ type: z.literal('FREE_THROW'), shooterId: NonEmptyStringSchema, made: z.boolean() })
    .strict(),
  z
    .object({
      type: z.literal('SHOT'),
      shooterId: NonEmptyStringSchema,
      zone: z.enum(['INSIDE', 'MID_RANGE', 'THREE_POINT']),
      made: z.boolean(),
    })
    .strict(),
  z
    .object({
      type: z.literal('REBOUND'),
      playerId: NonEmptyStringSchema,
      kind: z.enum(['OFFENSIVE', 'DEFENSIVE']),
    })
    .strict(),
  z
    .object({
      type: z.literal('SCORE'),
      side: MatchSideSchema,
      playerId: NonEmptyStringSchema,
      points: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    })
    .strict(),
  z
    .object({
      type: z.literal('ASSIST'),
      playerId: NonEmptyStringSchema,
      sourceEventId: IdentityHashSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal('STEAL'),
      playerId: NonEmptyStringSchema,
      sourceEventId: IdentityHashSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal('BLOCK'),
      playerId: NonEmptyStringSchema,
      sourceEventId: IdentityHashSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal('SUBSTITUTION'),
      side: MatchSideSchema,
      outPlayerId: NonEmptyStringSchema,
      inPlayerId: NonEmptyStringSchema,
      transcriptEntryHash: IdentityHashSchema.nullable(),
      forced: z.boolean(),
    })
    .strict(),
  z.object({ type: z.literal('EFFECT_APPLIED'), effectKey: NonEmptyStringSchema }).strict(),
  z.object({ type: z.literal('PERIOD_COMPLETED'), period: PositiveSafeIntegerSchema }).strict(),
  z
    .object({
      type: z.literal('MATCH_COMPLETED'),
      terminationReason: z.enum(['COMPLETED', 'FORFEIT_INSUFFICIENT_PLAYERS']),
    })
    .strict(),
]);

export const MatchEventSchema = z
  .object({
    matchId: IdentityHashSchema,
    eventId: IdentityHashSchema,
    eventHash: IdentityHashSchema,
    cursor: NonNegativeSafeIntegerSchema,
    period: PositiveSafeIntegerSchema,
    possessionIndex: NonNegativeSafeIntegerSchema,
    segmentIndex: NonNegativeSafeIntegerSchema,
    localEventSequence: NonNegativeSafeIntegerSchema,
    eventType: MatchEventTypeSchema,
    previousAnchorHash: IdentityHashSchema,
    nextAnchorHash: IdentityHashSchema,
    payload: MatchEventPayloadSchema,
  })
  .strict()
  .superRefine((value, context) => {
    if (value.eventType !== value.payload.type) {
      addIssue(context, ['eventType'], 'Event type must match the closed event payload type.');
    }
    const expectedEventId = deriveEventId(value);
    if (value.eventId !== expectedEventId) {
      addIssue(context, ['eventId'], 'eventId does not match its match coordinate identity.');
    }
    const expectedEventHash = deriveMatchEventHash(value);
    if (value.eventHash !== expectedEventHash) {
      addIssue(
        context,
        ['eventHash'],
        'Event hash does not bind event content and anchor identities.',
      );
    }
  });

export type MatchEvent = z.infer<typeof MatchEventSchema>;

export function deriveEventId(
  input: Pick<
    MatchEvent,
    'matchId' | 'period' | 'possessionIndex' | 'segmentIndex' | 'localEventSequence' | 'eventType'
  >,
): string {
  return idHash(
    'match-event-v2',
    input.matchId,
    input.period,
    input.possessionIndex,
    input.segmentIndex,
    input.localEventSequence,
    input.eventType,
  );
}

export function deriveMatchEventHash(input: MatchEvent): string {
  const { eventHash: _eventHash, ...identity } = input;
  return idHash('match-event-content-v2', asCanonicalValue(identity));
}

export const MatchFactSchema = z
  .object({
    matchId: IdentityHashSchema,
    factId: IdentityHashSchema,
    factHash: IdentityHashSchema,
    factKind: z.enum(['EXPLANATION', 'STATISTICAL', 'OBSERVATION']),
    sourceEventIds: z.array(IdentityHashSchema).min(1),
    localFactSequence: NonNegativeSafeIntegerSchema,
    payload: CanonicalMatchValueSchema,
  })
  .strict()
  .superRefine((value, context) => {
    requireUniqueStrings(value.sourceEventIds, context, ['sourceEventIds'], 'Source event IDs');
    if (
      value.sourceEventIds.some(
        (eventId, index) =>
          index > 0 && compareUtf16CodeUnits(value.sourceEventIds[index - 1] ?? '', eventId) > 0,
      )
    ) {
      addIssue(context, ['sourceEventIds'], 'Source event IDs must use canonical UTF-16 order.');
    }
    if (value.factId !== deriveFactId(value)) {
      addIssue(context, ['factId'], 'factId does not match its ordered source-event identity.');
    }
    if (value.factHash !== deriveMatchFactHash(value)) {
      addIssue(context, ['factHash'], 'Fact hash does not bind fact content.');
    }
  });

export type MatchFact = z.infer<typeof MatchFactSchema>;

export function deriveFactId(
  input: Pick<MatchFact, 'matchId' | 'factKind' | 'sourceEventIds' | 'localFactSequence'>,
): string {
  return idHash(
    'match-fact-v2',
    input.matchId,
    input.factKind,
    [...input.sourceEventIds],
    input.localFactSequence,
  );
}

export function deriveMatchFactHash(input: MatchFact): string {
  const { factHash: _factHash, ...identity } = input;
  return idHash('match-fact-content-v2', asCanonicalValue(identity));
}

export const MatchCommandSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('SET_MATCH_TACTICS'), tactics: MatchTacticsSchema }).strict(),
  z.object({ kind: z.literal('SET_MATCH_ROLES'), roles: MatchRoleAssignmentsSchema }).strict(),
  z
    .object({
      kind: z.literal('QUEUE_SUBSTITUTIONS'),
      substitutions: z
        .array(
          z
            .object({
              outPlayerId: NonEmptyStringSchema,
              inPlayerId: NonEmptyStringSchema,
              slot: PositionSchema,
            })
            .strict(),
        )
        .min(1),
    })
    .strict()
    .superRefine((value, context) => {
      requireUniqueStrings(
        value.substitutions.map((substitution) => substitution.outPlayerId),
        context,
        ['substitutions'],
        'Outgoing substitution players',
      );
      requireUniqueStrings(
        value.substitutions.map((substitution) => substitution.inPlayerId),
        context,
        ['substitutions'],
        'Incoming substitution players',
      );
      requireUniqueStrings(
        value.substitutions.map((substitution) => substitution.slot),
        context,
        ['substitutions'],
        'Substitution slots',
      );
      if (
        value.substitutions.some(
          (substitution) => substitution.inPlayerId === substitution.outPlayerId,
        )
      ) {
        addIssue(
          context,
          ['substitutions'],
          'A substitution cannot replace a player with herself.',
        );
      }
    }),
  z
    .object({
      kind: z.literal('CANCEL_QUEUED_SUBSTITUTIONS'),
      targetTranscriptEntryHash: IdentityHashSchema,
    })
    .strict(),
]);

export type MatchCommand = z.infer<typeof MatchCommandSchema>;

export function deriveMatchCommandPayloadHash(command: MatchCommand): string {
  return idHash('match-command-v2', asCanonicalValue(command));
}

const PlayerDecisionIdentitySchema = z
  .object({ kind: z.literal('PLAYER_COMMAND'), commandPayloadHash: IdentityHashSchema })
  .strict();
const AutomatedDecisionIdentitySchema = z
  .object({
    kind: z.literal('AUTOMATED_POLICY'),
    policyId: NonEmptyStringSchema,
    policyInputHash: IdentityHashSchema,
  })
  .strict();
const RulesDecisionIdentitySchema = z
  .object({
    kind: z.literal('RULES_DECISION'),
    ruleId: NonEmptyStringSchema,
    ruleInputHash: IdentityHashSchema,
  })
  .strict();

const TranscriptEntryBaseSchema = z.object({
  matchId: IdentityHashSchema,
  previousAnchorHash: IdentityHashSchema,
  nextAnchorHash: IdentityHashSchema,
  controlBoundary: ControlBoundarySchema,
  localRevisionBefore: NonNegativeSafeIntegerSchema,
  localRevisionAfter: NonNegativeSafeIntegerSchema,
  effectiveFromSegmentKey: SegmentKeySchema,
  effectiveFragment: EffectiveFragmentSchema,
  effectiveFragmentHash: IdentityHashSchema,
  previousTranscriptHash: IdentityHashSchema,
  transcriptEntryHash: IdentityHashSchema,
});

const PlayerTranscriptEntrySchema = TranscriptEntryBaseSchema.extend({
  actor: z.literal('PLAYER'),
  decisionIdentity: PlayerDecisionIdentitySchema,
  command: MatchCommandSchema,
}).strict();
const AssistantTranscriptEntrySchema = TranscriptEntryBaseSchema.extend({
  actor: z.literal('ASSISTANT'),
  decisionIdentity: AutomatedDecisionIdentitySchema,
  command: z.null(),
}).strict();
const OpponentTranscriptEntrySchema = TranscriptEntryBaseSchema.extend({
  actor: z.literal('OPPONENT'),
  decisionIdentity: AutomatedDecisionIdentitySchema,
  command: z.null(),
}).strict();
const RulesTranscriptEntrySchema = TranscriptEntryBaseSchema.extend({
  actor: z.literal('RULES'),
  decisionIdentity: RulesDecisionIdentitySchema,
  command: z.null(),
}).strict();

export const MatchTranscriptEntrySchema = z
  .discriminatedUnion('actor', [
    PlayerTranscriptEntrySchema,
    AssistantTranscriptEntrySchema,
    OpponentTranscriptEntrySchema,
    RulesTranscriptEntrySchema,
  ])
  .superRefine((value, context) => {
    if (value.previousAnchorHash === value.nextAnchorHash) {
      addIssue(
        context,
        ['nextAnchorHash'],
        'Accepted transcript entries must bind a distinct resulting anchor.',
      );
    }
    if (value.localRevisionAfter !== value.localRevisionBefore + 1) {
      addIssue(
        context,
        ['localRevisionAfter'],
        'Accepted transcript revisions must advance by exactly one.',
      );
    }
    if (
      value.effectiveFromSegmentKey.period !== value.controlBoundary.period ||
      value.effectiveFromSegmentKey.possessionIndex !== value.controlBoundary.possessionIndex ||
      value.effectiveFromSegmentKey.segmentIndex !== value.controlBoundary.segmentIndex
    ) {
      addIssue(
        context,
        ['effectiveFromSegmentKey'],
        'Effective segment key must bind the accepted control boundary.',
      );
    }
    if (
      value.actor === 'PLAYER' &&
      value.decisionIdentity.commandPayloadHash !== deriveMatchCommandPayloadHash(value.command)
    ) {
      addIssue(
        context,
        ['decisionIdentity', 'commandPayloadHash'],
        'Player decision identity must bind the command payload.',
      );
    }
    const expectedFragmentHash = deriveEffectiveFragmentHash({
      matchId: value.matchId,
      previousAnchorHash: value.previousAnchorHash,
      controlBoundary: value.controlBoundary,
      fragment: value.effectiveFragment,
    });
    if (value.effectiveFragmentHash !== expectedFragmentHash) {
      addIssue(
        context,
        ['effectiveFragmentHash'],
        'Transcript effective fragment hash does not bind its inputs.',
      );
    }
    if (value.transcriptEntryHash !== deriveTranscriptEntryHash(value)) {
      addIssue(
        context,
        ['transcriptEntryHash'],
        'Transcript entry hash does not bind actor, anchor, revision, boundary, and fragment.',
      );
    }
  });

export type MatchTranscriptEntry = z.infer<typeof MatchTranscriptEntrySchema>;

export function deriveTranscriptEntryHash(input: MatchTranscriptEntry): string {
  const { transcriptEntryHash: _transcriptEntryHash, ...identity } = input;
  return idHash('match-transcript-entry-v2', asCanonicalValue(identity));
}

export const MatchTranscriptSchema = z
  .object({
    matchId: IdentityHashSchema,
    genesisAnchorHash: IdentityHashSchema,
    entries: z.array(MatchTranscriptEntrySchema),
    transcriptHash: IdentityHashSchema,
  })
  .strict()
  .superRefine((value, context) => {
    let expectedPreviousTranscriptHash = GENESIS_MATCH_TRANSCRIPT_HASH;
    let expectedRevision = 0;
    for (const [index, entry] of value.entries.entries()) {
      if (entry.matchId !== value.matchId) {
        addIssue(
          context,
          ['entries', index, 'matchId'],
          'Transcript entry belongs to a different match.',
        );
      }
      if (entry.previousTranscriptHash !== expectedPreviousTranscriptHash) {
        addIssue(
          context,
          ['entries', index, 'previousTranscriptHash'],
          'Transcript hash chain is not contiguous.',
        );
      }
      if (entry.localRevisionBefore !== expectedRevision) {
        addIssue(
          context,
          ['entries', index, 'localRevisionBefore'],
          'Transcript local revision chain is not contiguous.',
        );
      }
      expectedPreviousTranscriptHash = entry.transcriptEntryHash;
      expectedRevision = entry.localRevisionAfter;
    }
    if (value.transcriptHash !== deriveTranscriptHash(value)) {
      addIssue(
        context,
        ['transcriptHash'],
        'Transcript hash does not bind its ordered accepted entries.',
      );
    }
  });

export type MatchTranscript = z.infer<typeof MatchTranscriptSchema>;

export function deriveTranscriptHash(
  input: Pick<MatchTranscript, 'matchId' | 'genesisAnchorHash' | 'entries'>,
): string {
  return idHash(
    'match-transcript-v2',
    input.matchId,
    input.genesisAnchorHash,
    input.entries.map((entry) => entry.transcriptEntryHash),
  );
}

export const MatchResultDraftSchema = z
  .object({
    matchId: IdentityHashSchema,
    matchInputHash: IdentityHashSchema,
    matchKind: MatchKindSchema,
    recordScope: RecordScopeSchema,
    finalAnchor: MatchAnchorSchema,
    events: z.array(MatchEventSchema),
    facts: z.array(MatchFactSchema),
    transcript: MatchTranscriptSchema,
    eventDigest: IdentityHashSchema,
    terminationReason: z.enum(['COMPLETED', 'FORFEIT_INSUFFICIENT_PLAYERS']),
    matchResultId: IdentityHashSchema,
  })
  .strict()
  .superRefine((value, context) => {
    if (!hasValidClassificationPair(value.matchKind, value.recordScope)) {
      addIssue(
        context,
        ['recordScope'],
        'Result kind and record scope are not a valid classified pair.',
      );
    }
    if (value.finalAnchor.matchId !== value.matchId) {
      addIssue(context, ['finalAnchor', 'matchId'], 'Final anchor belongs to a different match.');
    }
    if (value.transcript.matchId !== value.matchId) {
      addIssue(context, ['transcript', 'matchId'], 'Transcript belongs to a different match.');
    }
    if (value.finalAnchor.transcriptCursor !== value.transcript.entries.length) {
      addIssue(
        context,
        ['finalAnchor', 'transcriptCursor'],
        'Final anchor transcript cursor must equal accepted entry count.',
      );
    }
    if (value.finalAnchor.eventCursor !== value.events.length) {
      addIssue(
        context,
        ['finalAnchor', 'eventCursor'],
        'Final anchor event cursor must equal event count.',
      );
    }
    const expectedStatus =
      value.terminationReason === 'COMPLETED' ? 'COMPLETED' : 'FORFEIT_INSUFFICIENT_PLAYERS';
    if (value.finalAnchor.status !== expectedStatus) {
      addIssue(
        context,
        ['finalAnchor', 'status'],
        'Final anchor status must match result termination reason.',
      );
    }
    for (const [index, event] of value.events.entries()) {
      if (event.matchId !== value.matchId) {
        addIssue(context, ['events', index, 'matchId'], 'Event belongs to a different match.');
      }
      if (event.cursor !== index) {
        addIssue(context, ['events', index, 'cursor'], 'Events must use a dense ordered cursor.');
      }
    }
    const eventIds = new Set(value.events.map((event) => event.eventId));
    for (const [index, fact] of value.facts.entries()) {
      if (fact.matchId !== value.matchId) {
        addIssue(context, ['facts', index, 'matchId'], 'Fact belongs to a different match.');
      }
      if (fact.sourceEventIds.some((eventId) => !eventIds.has(eventId))) {
        addIssue(
          context,
          ['facts', index, 'sourceEventIds'],
          'Facts must reference events in this result.',
        );
      }
    }
    if (value.eventDigest !== deriveEventDigest(value.matchId, value.events)) {
      addIssue(
        context,
        ['eventDigest'],
        'Event digest does not bind the ordered event content hashes.',
      );
    }
    if (value.matchResultId !== deriveMatchResultId(value)) {
      addIssue(
        context,
        ['matchResultId'],
        'Match result identity does not bind the final anchor, events, transcript, and termination.',
      );
    }
  });

export type MatchResultDraft = z.infer<typeof MatchResultDraftSchema>;

export function deriveEventDigest(matchId: string, events: readonly MatchEvent[]): string {
  return idHash(
    'match-event-digest-v2',
    matchId,
    events.map((event) => event.eventHash),
  );
}

export function deriveMatchResultId(
  input: Pick<
    MatchResultDraft,
    'matchId' | 'finalAnchor' | 'eventDigest' | 'transcript' | 'terminationReason'
  >,
): string {
  return idHash(
    'match-result-v2',
    input.matchId,
    input.finalAnchor.anchorHash,
    input.eventDigest,
    input.transcript.transcriptHash,
    input.terminationReason,
  );
}

export const MatchProtocolBundleSchema = z
  .object({
    input: MatchInputSchema,
    anchors: z.array(MatchAnchorSchema).min(1),
    result: MatchResultDraftSchema,
  })
  .strict()
  .superRefine((value, context) => {
    const { input, anchors, result } = value;
    if (result.matchId !== input.matchId || result.matchInputHash !== input.matchInputHash) {
      addIssue(context, ['result'], 'Result must bind the exact immutable MatchInput identity.');
    }
    if (result.matchKind !== input.matchKind) {
      addIssue(
        context,
        ['result', 'matchKind'],
        'Result match kind must equal the immutable MatchInput classification.',
      );
    }
    if (result.recordScope !== input.recordScope) {
      addIssue(
        context,
        ['result', 'recordScope'],
        'Result record scope must equal the immutable MatchInput classification.',
      );
    }
    const anchorByHash = new Map<string, MatchAnchor>();
    const anchorIndexByHash = new Map<string, number>();
    const homeParticipantIds = new Set(input.homeTeam.players.map((player) => player.playerId));
    const awayParticipantIds = new Set(input.awayTeam.players.map((player) => player.playerId));
    const allParticipantIds = new Set([...homeParticipantIds, ...awayParticipantIds]);
    for (const [index, anchor] of anchors.entries()) {
      if (anchor.matchId !== input.matchId) {
        addIssue(context, ['anchors', index, 'matchId'], 'Anchor belongs to a different match.');
      }
      if (anchorByHash.has(anchor.anchorHash)) {
        addIssue(context, ['anchors', index, 'anchorHash'], 'Anchor hashes must be unique.');
      }
      anchorByHash.set(anchor.anchorHash, anchor);
      anchorIndexByHash.set(anchor.anchorHash, index);
      if (index === 0 && anchor.previousAnchorHash !== GENESIS_MATCH_ANCHOR_HASH) {
        addIssue(
          context,
          ['anchors', index, 'previousAnchorHash'],
          'First anchor must bind the match anchor genesis.',
        );
      }
      if (index > 0 && anchor.previousAnchorHash !== (anchors[index - 1]?.anchorHash ?? '')) {
        addIssue(
          context,
          ['anchors', index, 'previousAnchorHash'],
          'Anchor chain must be contiguous.',
        );
      }
      requireSubsetOfStrings(
        Object.values(anchor.lineups.home),
        homeParticipantIds,
        context,
        ['anchors', index, 'lineups', 'home'],
        'Home lineup',
      );
      requireSubsetOfStrings(
        Object.values(anchor.lineups.away),
        awayParticipantIds,
        context,
        ['anchors', index, 'lineups', 'away'],
        'Away lineup',
      );
      requireSubsetOfStrings(
        Object.values(anchor.roles.home),
        new Set(Object.values(anchor.lineups.home)),
        context,
        ['anchors', index, 'roles', 'home'],
        'Home role holders',
      );
      requireSubsetOfStrings(
        Object.values(anchor.roles.away),
        new Set(Object.values(anchor.lineups.away)),
        context,
        ['anchors', index, 'roles', 'away'],
        'Away role holders',
      );
      requireSubsetOfStrings(
        Object.keys(anchor.fatigueMilliByPlayer),
        allParticipantIds,
        context,
        ['anchors', index, 'fatigueMilliByPlayer'],
        'Anchor fatigue map',
      );
      requireSubsetOfStrings(
        anchor.boxScore.home.players.map((player) => player.playerId),
        homeParticipantIds,
        context,
        ['anchors', index, 'boxScore', 'home'],
        'Home box-score players',
      );
      requireSubsetOfStrings(
        anchor.boxScore.away.players.map((player) => player.playerId),
        awayParticipantIds,
        context,
        ['anchors', index, 'boxScore', 'away'],
        'Away box-score players',
      );
    }
    const firstAnchor = anchors[0];
    const finalAnchor = anchors.at(-1);
    if (firstAnchor && result.transcript.genesisAnchorHash !== firstAnchor.anchorHash) {
      addIssue(
        context,
        ['result', 'transcript', 'genesisAnchorHash'],
        'Transcript genesis must be the first committed anchor.',
      );
    }
    if (finalAnchor && result.finalAnchor.anchorHash !== finalAnchor.anchorHash) {
      addIssue(
        context,
        ['result', 'finalAnchor'],
        'Result final anchor must be the terminal anchor-chain value.',
      );
    }

    const eventsByAnchorTransition = new Map<string, MatchEvent[]>();
    const nextLocalEventSequenceBySegment = new Map<string, number>();
    for (const [index, event] of result.events.entries()) {
      const segmentIdentity = `${event.period}:${event.possessionIndex}:${event.segmentIndex}`;
      const expectedLocalEventSequence = nextLocalEventSequenceBySegment.get(segmentIdentity) ?? 0;
      if (event.localEventSequence !== expectedLocalEventSequence) {
        addIssue(
          context,
          ['result', 'events', index, 'localEventSequence'],
          'Local event sequence must start at zero and advance densely within its segment.',
        );
      }
      nextLocalEventSequenceBySegment.set(segmentIdentity, expectedLocalEventSequence + 1);

      if (!anchorByHash.has(event.previousAnchorHash) || !anchorByHash.has(event.nextAnchorHash)) {
        addIssue(
          context,
          ['result', 'events', index],
          'Event must bind anchors in this exact match anchor chain.',
        );
        continue;
      }
      const previousAnchorIndex = anchorIndexByHash.get(event.previousAnchorHash) ?? -1;
      const nextAnchorIndex = anchorIndexByHash.get(event.nextAnchorHash) ?? -1;
      const previousAnchor = anchorByHash.get(event.previousAnchorHash);
      const nextAnchor = anchorByHash.get(event.nextAnchorHash);
      if (
        nextAnchorIndex !== previousAnchorIndex + 1 ||
        (previousAnchor !== undefined && previousAnchor.eventCursor > event.cursor) ||
        (nextAnchor !== undefined && nextAnchor.eventCursor <= event.cursor)
      ) {
        addIssue(
          context,
          ['result', 'events', index],
          'Event cursor must advance through this anchor chain.',
        );
      }

      if (
        previousAnchor !== undefined &&
        (event.period !== previousAnchor.period ||
          event.possessionIndex !== previousAnchor.possession.possessionIndex ||
          event.segmentIndex !== previousAnchor.possession.segmentIndex)
      ) {
        addIssue(
          context,
          ['result', 'events', index],
          'Event period, possession, and segment must equal its previous Anchor coordinates.',
        );
      }

      const transitionIdentity = `${event.previousAnchorHash}:${event.nextAnchorHash}`;
      const transitionEvents = eventsByAnchorTransition.get(transitionIdentity) ?? [];
      transitionEvents.push(event);
      eventsByAnchorTransition.set(transitionIdentity, transitionEvents);

      if (previousAnchor !== undefined) {
        const possessionSide = previousAnchor.possession.side;
        const oppositeSide = possessionSide === 'HOME' ? 'AWAY' : 'HOME';
        const requirePlayerForSide = (
          playerId: string,
          side: z.infer<typeof MatchSideSchema>,
          payloadPath: readonly (string | number)[],
        ): void => {
          const participantIds = side === 'HOME' ? homeParticipantIds : awayParticipantIds;
          if (!participantIds.has(playerId)) {
            addIssue(
              context,
              ['result', 'events', index, 'payload', ...payloadPath],
              `Event player must be registered for the attributed ${side} team in this MatchInput.`,
            );
          }
        };

        switch (event.payload.type) {
          case 'POSSESSION_STARTED':
          case 'POSSESSION_ENDED':
            if (event.payload.side !== possessionSide) {
              addIssue(
                context,
                ['result', 'events', index, 'payload', 'side'],
                'Possession event side must equal the previous Anchor possession side.',
              );
            }
            break;
          case 'TURNOVER':
            requirePlayerForSide(event.payload.playerId, possessionSide, ['playerId']);
            break;
          case 'FOUL':
            requirePlayerForSide(
              event.payload.playerId,
              event.payload.foulKind === 'OFFENSIVE' ? possessionSide : oppositeSide,
              ['playerId'],
            );
            break;
          case 'FREE_THROW':
            requirePlayerForSide(event.payload.shooterId, possessionSide, ['shooterId']);
            break;
          case 'SHOT':
            requirePlayerForSide(event.payload.shooterId, possessionSide, ['shooterId']);
            break;
          case 'REBOUND':
            requirePlayerForSide(
              event.payload.playerId,
              event.payload.kind === 'OFFENSIVE' ? possessionSide : oppositeSide,
              ['playerId'],
            );
            break;
          case 'SCORE':
            if (event.payload.side !== possessionSide) {
              addIssue(
                context,
                ['result', 'events', index, 'payload', 'side'],
                'Score side must equal the previous Anchor possession side.',
              );
            }
            requirePlayerForSide(event.payload.playerId, event.payload.side, ['playerId']);
            break;
          case 'ASSIST':
            requirePlayerForSide(event.payload.playerId, possessionSide, ['playerId']);
            break;
          case 'STEAL':
          case 'BLOCK':
            requirePlayerForSide(event.payload.playerId, oppositeSide, ['playerId']);
            break;
          case 'SUBSTITUTION':
            requirePlayerForSide(event.payload.outPlayerId, event.payload.side, ['outPlayerId']);
            requirePlayerForSide(event.payload.inPlayerId, event.payload.side, ['inPlayerId']);
            break;
          case 'CLOCK_ADVANCED':
          case 'EFFECT_APPLIED':
          case 'PERIOD_COMPLETED':
          case 'MATCH_COMPLETED':
            break;
        }
      }
    }

    for (let index = 0; index < anchors.length - 1; index += 1) {
      const previousAnchor = anchors[index]!;
      const nextAnchor = anchors[index + 1]!;
      const transitionIdentity = `${previousAnchor.anchorHash}:${nextAnchor.anchorHash}`;
      const transitionEvents = eventsByAnchorTransition.get(transitionIdentity) ?? [];
      const expectedEventCount = nextAnchor.eventCursor - previousAnchor.eventCursor;
      if (expectedEventCount < 0 || transitionEvents.length !== expectedEventCount) {
        addIssue(
          context,
          ['anchors', index + 1, 'eventCursor'],
          'Adjacent Anchor event cursors must equal the exact events committed by that transition.',
        );
        continue;
      }
      for (const [localIndex, event] of transitionEvents.entries()) {
        if (event.cursor !== previousAnchor.eventCursor + localIndex) {
          addIssue(
            context,
            ['result', 'events', event.cursor, 'cursor'],
            'Transition events must densely cover the adjacent Anchor cursor range.',
          );
        }
      }
    }
    for (const [index, entry] of result.transcript.entries.entries()) {
      const previousAnchor = anchorByHash.get(entry.previousAnchorHash);
      if (!previousAnchor) {
        addIssue(
          context,
          ['result', 'transcript', 'entries', index, 'previousAnchorHash'],
          'Transcript entry must bind an anchor in this match.',
        );
        continue;
      }
      const nextAnchor = anchorByHash.get(entry.nextAnchorHash);
      if (!nextAnchor) {
        addIssue(
          context,
          ['result', 'transcript', 'entries', index, 'nextAnchorHash'],
          'Transcript entry must bind its resulting anchor in this match.',
        );
        continue;
      }
      if (previousAnchor.localRevision !== entry.localRevisionBefore) {
        addIssue(
          context,
          ['result', 'transcript', 'entries', index, 'localRevisionBefore'],
          'Transcript revision must match its previous anchor.',
        );
      }
      if (
        previousAnchor.controlBoundary === null ||
        canonicalizeV2(previousAnchor.controlBoundary) !== canonicalizeV2(entry.controlBoundary)
      ) {
        addIssue(
          context,
          ['result', 'transcript', 'entries', index, 'controlBoundary'],
          'Transcript control boundary must match its previous anchor.',
        );
      }
      if (
        nextAnchor.previousAnchorHash !== previousAnchor.anchorHash ||
        nextAnchor.localRevision !== entry.localRevisionAfter ||
        canonicalizeV2(nextAnchor.controlBoundary) !== canonicalizeV2(entry.controlBoundary) ||
        nextAnchor.effectiveFragmentHash !== entry.effectiveFragmentHash
      ) {
        addIssue(
          context,
          ['result', 'transcript', 'entries', index],
          'Transcript identity must bind its resulting anchor, revision, boundary, and effective fragment.',
        );
      }
    }
  });
