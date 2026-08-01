import { z } from 'zod';

import {
  CALENDAR_WEEKS_PER_RUN,
  ENGINE_VERSION,
  OPERATION_WEEKS_PER_RUN,
  P01_ANNUAL_GRANT,
  P01_INITIAL_GRANT,
  RNG_STREAM_NAMES,
  SAVE_SCHEMA_VERSION,
  SCHOOL_YEARS_PER_RUN,
  TERMS_PER_SCHOOL_YEAR,
  WEEKS_PER_TERM,
  type RngStreamName,
} from './constants.js';

const IntegerSchema = z.number().int();
const NonNegativeIntegerSchema = IntegerSchema.min(0);
const PercentageSchema = z.number().finite().min(0).max(100);

export const PositionSchema = z.enum(['PG', 'SG', 'SF', 'PF', 'C']);
export const RaritySchema = z.union([
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
  z.literal(6),
]);
export const GradeSchema = z.union([z.literal(1), z.literal(2), z.literal(3)]);
export const ActiveStatusSchema = z.enum([
  'ACTIVE',
  'LEFT_BASKETBALL',
  'GRADUATED',
  'INJURED_LONG_TERM',
]);

export const GameDateSchema = z
  .object({
    schoolYearIndex: IntegerSchema.min(1),
    term: z.union([z.literal(1), z.literal(2)]),
    weekOfTerm: IntegerSchema.min(1).max(20),
  })
  .strict();

export const GeneratedPlayerDefinitionSchema = z
  .object({
    generationSeed: z.string().min(1),
    displayName: z.string().min(1),
    abilityArchetype: z.enum(['GUARD', 'WING', 'FORWARD', 'CENTER', 'UTILITY']),
    personalityArchetype: z.enum(['STEADY', 'DRIVEN', 'SOCIAL', 'CAUTIOUS']),
    visualFixtureId: z.string().min(1),
  })
  .strict();

export const PlayerDefinitionReferenceSchema = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('unique'),
      catalogId: z.string().min(1),
    })
    .strict(),
  z
    .object({
      kind: z.literal('generated'),
      snapshot: GeneratedPlayerDefinitionSchema,
    })
    .strict(),
]);

export const AttributeStateSchema = z
  .object({
    offense: PercentageSchema,
    defense: PercentageSchema,
    athleticism: PercentageSchema,
    stamina: PercentageSchema,
  })
  .strict();

export const PlayerConditionSchema = z
  .object({
    fatigue: PercentageSchema,
    morale: PercentageSchema,
    focus: PercentageSchema,
    pressure: PercentageSchema,
  })
  .strict();

export const CareerEntrySchema = z
  .object({
    at: GameDateSchema,
    type: z.enum(['JOINED', 'GRADE_ADVANCED', 'GRADUATED', 'MATCH_MILESTONE']),
    detail: z.string().min(1),
  })
  .strict();

export const PlayerSchema = z
  .object({
    id: z.string().min(1),
    definition: PlayerDefinitionReferenceSchema,
    rarity: RaritySchema,
    grade: GradeSchema,
    activeStatus: ActiveStatusSchema,
    positions: z
      .object({
        best: z.array(PositionSchema).min(1),
        swing: z.array(PositionSchema),
        roleTags: z.array(z.string().min(1)),
      })
      .strict(),
    attributes: AttributeStateSchema,
    skills: z.array(
      z
        .object({
          skillId: z.string().min(1),
          proficiency: PercentageSchema,
        })
        .strict(),
    ),
    condition: PlayerConditionSchema,
    careerLog: z.array(CareerEntrySchema),
    lifecycle: z
      .object({
        joinedAt: GameDateSchema,
        expectedGraduationYear: IntegerSchema.min(1),
      })
      .strict(),
  })
  .strict();

export const SchoolSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    managerName: z.string().min(1),
    createdYear: IntegerSchema.min(1),
    teamId: z.string().min(1),
    reputationId: z.string().min(1),
    budgetId: z.string().min(1),
    facilityIds: z.array(z.string().min(1)),
    traditionIds: z.array(z.string().min(1)),
  })
  .strict();

export const TeamSchema = z
  .object({
    id: z.string().min(1),
    schoolId: z.string().min(1),
    name: z.string().min(1),
    activePlayerIds: z.array(z.string().min(1)),
    rosterLimit: IntegerSchema.min(1),
    registeredRosterIds: z.array(z.string().min(1)),
    staffIds: z.array(z.string().min(1)),
    history: z
      .object({
        wins: NonNegativeIntegerSchema,
        losses: NonNegativeIntegerSchema,
        schoolYearsCompleted: NonNegativeIntegerSchema,
      })
      .strict(),
  })
  .strict();

export const ReputationSchema = z
  .object({
    id: z.string().min(1),
    competitive: PercentageSchema,
    recruitmentAppeal: PercentageSchema,
    basketballInfluence: PercentageSchema,
  })
  .strict();

export const BudgetLedgerEntrySchema = z
  .object({
    sequence: NonNegativeIntegerSchema,
    schoolYearIndex: IntegerSchema.min(1).max(SCHOOL_YEARS_PER_RUN),
    absoluteWeek: NonNegativeIntegerSchema.max(CALENDAR_WEEKS_PER_RUN),
    amount: z.number().finite(),
    balanceAfter: z.number().finite().min(0),
    reason: z.enum(['INITIAL_GRANT', 'WEEKLY_OPERATIONS', 'EXAM_MAINTENANCE', 'ANNUAL_GRANT']),
  })
  .strict();

export const BudgetSchema = z
  .object({
    id: z.string().min(1),
    balance: z.number().finite().min(0),
    annualGrant: z.number().finite().min(0),
    reserved: z.number().finite().min(0),
    ledger: z.array(BudgetLedgerEntrySchema).min(1),
  })
  .strict();

export const SeasonSchema = z
  .object({
    id: z.string().min(1),
    schoolYearIndex: IntegerSchema.min(1),
    competitionIds: z.array(z.string().min(1)),
    objectives: z.array(z.string().min(1)),
  })
  .strict();

export const WeekSchema = z
  .object({
    id: z.string().min(1),
    absoluteWeek: IntegerSchema.min(1).max(CALENDAR_WEEKS_PER_RUN),
    schoolYearIndex: IntegerSchema.min(1).max(SCHOOL_YEARS_PER_RUN),
    term: z.union([z.literal(1), z.literal(2)]),
    weekOfTerm: IntegerSchema.min(1).max(20),
    phase: z.enum(['TERM_OPERATION', 'EXAM_WRAP']),
    availableActions: NonNegativeIntegerSchema,
    scheduledEventIds: z.array(z.string().min(1)),
    resolved: z.literal(false),
  })
  .strict();

export const MatchPlayerStatSchema = z
  .object({
    playerId: z.string().min(1),
    points: NonNegativeIntegerSchema,
  })
  .strict();

export const MatchResultSchema = z
  .object({
    id: z.string().min(1),
    absoluteWeek: IntegerSchema.min(1).max(CALENDAR_WEEKS_PER_RUN),
    homeTeamId: z.string().min(1),
    opponentId: z.string().min(1),
    seedRef: z
      .object({
        stream: z.literal('match'),
        callStart: NonNegativeIntegerSchema,
        callEnd: NonNegativeIntegerSchema,
      })
      .strict(),
    score: z
      .object({
        home: NonNegativeIntegerSchema,
        away: NonNegativeIntegerSchema,
      })
      .strict(),
    playerStats: z.array(MatchPlayerStatSchema),
    explanations: z.array(z.string().min(1)),
    simVersion: z.literal('model-a-p01'),
  })
  .strict();

export const CareerArchiveSchema = z
  .object({
    id: z.string().min(1),
    playerSnapshot: PlayerSchema,
    yearsPlayed: IntegerSchema.min(1).max(3),
    records: z
      .object({
        matches: NonNegativeIntegerSchema,
        points: NonNegativeIntegerSchema,
      })
      .strict(),
    keyEvents: z.array(z.string().min(1)),
    exitReason: z.literal('GRADUATED'),
    destination: z.literal('UNDECIDED'),
  })
  .strict();

export const TrainingPlanSchema = z
  .object({
    intensity: z.union([z.literal(0), z.literal(1), z.literal(2)]),
    focus: z.enum(['BALANCED', 'OFFENSE', 'DEFENSE', 'ATHLETICISM', 'STAMINA']),
  })
  .strict();

export const SimulationMetricsSchema = z
  .object({
    resolvedCalendarWeeks: NonNegativeIntegerSchema.max(CALENDAR_WEEKS_PER_RUN),
    resolvedOperationWeeks: NonNegativeIntegerSchema.max(OPERATION_WEEKS_PER_RUN),
    resolvedExamWeeks: NonNegativeIntegerSchema.max(
      CALENDAR_WEEKS_PER_RUN - OPERATION_WEEKS_PER_RUN,
    ),
    completedSchoolYears: NonNegativeIntegerSchema.max(SCHOOL_YEARS_PER_RUN),
    matches: NonNegativeIntegerSchema,
  })
  .strict();

const GameStateBaseSchema = z
  .object({
    schemaVersion: z.literal(SAVE_SCHEMA_VERSION),
    engineVersion: z.literal(ENGINE_VERSION),
    revision: NonNegativeIntegerSchema,
    status: z.enum(['ACTIVE', 'THREE_YEAR_COMPLETE']),
    school: SchoolSchema,
    team: TeamSchema,
    players: z.array(PlayerSchema),
    season: SeasonSchema,
    currentWeek: WeekSchema.nullable(),
    trainingPlan: TrainingPlanSchema,
    budget: BudgetSchema,
    reputation: ReputationSchema,
    careerArchives: z.array(CareerArchiveSchema),
    matchResults: z.array(MatchResultSchema),
    metrics: SimulationMetricsSchema,
  })
  .strict();

export const GameStateSchema = GameStateBaseSchema.superRefine((state, context) => {
  if (state.school.teamId !== state.team.id || state.team.schoolId !== state.school.id) {
    context.addIssue({
      code: 'custom',
      message: 'School/team ownership is inconsistent.',
      path: ['team'],
    });
  }
  if (state.school.budgetId !== state.budget.id) {
    context.addIssue({
      code: 'custom',
      message: 'School budget reference is inconsistent.',
      path: ['budget'],
    });
  }
  if (state.school.reputationId !== state.reputation.id) {
    context.addIssue({
      code: 'custom',
      message: 'School reputation reference is inconsistent.',
      path: ['reputation'],
    });
  }
  if (state.team.activePlayerIds.length > state.team.rosterLimit) {
    context.addIssue({
      code: 'custom',
      message: 'Active roster exceeds its limit.',
      path: ['team', 'activePlayerIds'],
    });
  }

  const playersById = new Map(state.players.map((player) => [player.id, player]));
  if (playersById.size !== state.players.length) {
    context.addIssue({
      code: 'custom',
      message: 'Player IDs must be unique.',
      path: ['players'],
    });
  }
  for (const [index, playerId] of state.team.activePlayerIds.entries()) {
    const player = playersById.get(playerId);
    if (!player || !['ACTIVE', 'INJURED_LONG_TERM'].includes(player.activeStatus)) {
      context.addIssue({
        code: 'custom',
        message: `Active roster contains a missing or inactive player: ${playerId}`,
        path: ['team', 'activePlayerIds', index],
      });
    }
  }

  const uniqueCatalogIds = new Set<string>();
  for (const [index, player] of state.players.entries()) {
    if (player.definition.kind === 'unique') {
      if (uniqueCatalogIds.has(player.definition.catalogId)) {
        context.addIssue({
          code: 'custom',
          message: `Duplicate unique character: ${player.definition.catalogId}`,
          path: ['players', index, 'definition'],
        });
      }
      uniqueCatalogIds.add(player.definition.catalogId);
    }
  }

  if (
    state.metrics.resolvedCalendarWeeks !==
    state.metrics.resolvedOperationWeeks + state.metrics.resolvedExamWeeks
  ) {
    context.addIssue({
      code: 'custom',
      message: 'Calendar-week metrics do not reconcile.',
      path: ['metrics'],
    });
  }
  if (state.metrics.matches !== state.matchResults.length) {
    context.addIssue({
      code: 'custom',
      message: 'Match metric does not equal stored results.',
      path: ['metrics', 'matches'],
    });
  }
  if (state.team.history.wins + state.team.history.losses !== state.matchResults.length) {
    context.addIssue({
      code: 'custom',
      message: 'Team match history does not reconcile.',
      path: ['team', 'history'],
    });
  }
  for (const [index, result] of state.matchResults.entries()) {
    const playerPointTotal = result.playerStats.reduce((sum, stat) => sum + stat.points, 0);
    if (playerPointTotal !== result.score.home) {
      context.addIssue({
        code: 'custom',
        message: 'Player points do not equal the team score.',
        path: ['matchResults', index, 'playerStats'],
      });
    }
  }

  const latestLedger = state.budget.ledger.at(-1);
  if (!latestLedger || latestLedger.balanceAfter !== state.budget.balance) {
    context.addIssue({
      code: 'custom',
      message: 'Budget ledger does not reconcile with current balance.',
      path: ['budget'],
    });
  }

  const weeksPerSchoolYear = TERMS_PER_SCHOOL_YEAR * WEEKS_PER_TERM;
  const settledSchoolYears = Math.floor(state.metrics.resolvedCalendarWeeks / weeksPerSchoolYear);
  if (state.metrics.completedSchoolYears !== settledSchoolYears) {
    context.addIssue({
      code: 'custom',
      message: `Completed-school-year metric must equal ${settledSchoolYears} after ${state.metrics.resolvedCalendarWeeks} resolved weeks.`,
      path: ['metrics', 'completedSchoolYears'],
    });
  }
  if (state.team.history.schoolYearsCompleted !== settledSchoolYears) {
    context.addIssue({
      code: 'custom',
      message: `Team school-year history must equal ${settledSchoolYears} after ${state.metrics.resolvedCalendarWeeks} resolved weeks.`,
      path: ['team', 'history', 'schoolYearsCompleted'],
    });
  }
  if (state.budget.annualGrant !== P01_ANNUAL_GRANT) {
    context.addIssue({
      code: 'custom',
      message: `P01 annual grant must equal the rules constant ${P01_ANNUAL_GRANT}.`,
      path: ['budget', 'annualGrant'],
    });
  }

  const initialGrantIndexes: number[] = [];
  const annualGrantIndexesBySchoolYear = new Map<number, number[]>();
  let previousLedgerWeek = 0;
  let previousBalanceAfter: number | undefined;
  for (const [index, entry] of state.budget.ledger.entries()) {
    if (entry.sequence !== index) {
      context.addIssue({
        code: 'custom',
        message: `Budget ledger sequence ${entry.sequence} does not match position ${index}.`,
        path: ['budget', 'ledger', index, 'sequence'],
      });
    }

    if (entry.reason === 'INITIAL_GRANT') {
      initialGrantIndexes.push(index);
      if (index !== 0 || entry.absoluteWeek !== 0 || entry.schoolYearIndex !== 1) {
        context.addIssue({
          code: 'custom',
          message: 'The initial grant must be the first ledger entry at school year 1, week 0.',
          path: ['budget', 'ledger', index],
        });
      }
      if (entry.amount !== P01_INITIAL_GRANT || entry.balanceAfter !== P01_INITIAL_GRANT) {
        context.addIssue({
          code: 'custom',
          message: `The initial grant amount and resulting balance must both equal ${P01_INITIAL_GRANT}.`,
          path: ['budget', 'ledger', index],
        });
      }
    } else {
      if (entry.absoluteWeek < 1) {
        context.addIssue({
          code: 'custom',
          message: 'A resolved budget entry must use a positive absolute week.',
          path: ['budget', 'ledger', index, 'absoluteWeek'],
        });
      }
      if (entry.absoluteWeek > state.metrics.resolvedCalendarWeeks) {
        context.addIssue({
          code: 'custom',
          message: `Budget entry week ${entry.absoluteWeek} exceeds resolved week ${state.metrics.resolvedCalendarWeeks}.`,
          path: ['budget', 'ledger', index, 'absoluteWeek'],
        });
      }

      const expectedSchoolYear = Math.ceil(entry.absoluteWeek / weeksPerSchoolYear);
      if (entry.schoolYearIndex !== expectedSchoolYear) {
        context.addIssue({
          code: 'custom',
          message: `Budget entry week ${entry.absoluteWeek} belongs to school year ${expectedSchoolYear}, not ${entry.schoolYearIndex}.`,
          path: ['budget', 'ledger', index, 'schoolYearIndex'],
        });
      }
    }

    if (entry.reason === 'ANNUAL_GRANT') {
      const indexes = annualGrantIndexesBySchoolYear.get(entry.schoolYearIndex) ?? [];
      indexes.push(index);
      annualGrantIndexesBySchoolYear.set(entry.schoolYearIndex, indexes);
      if (entry.amount !== P01_ANNUAL_GRANT) {
        context.addIssue({
          code: 'custom',
          message: `Annual grant for school year ${entry.schoolYearIndex} must equal ${P01_ANNUAL_GRANT}.`,
          path: ['budget', 'ledger', index, 'amount'],
        });
      }
    }

    if (index > 0 && previousBalanceAfter !== undefined) {
      const expectedBalanceAfter = previousBalanceAfter + entry.amount;
      if (entry.balanceAfter !== expectedBalanceAfter) {
        context.addIssue({
          code: 'custom',
          message: `Budget ledger balance at position ${index} must equal the previous balance plus this entry amount.`,
          path: ['budget', 'ledger', index, 'balanceAfter'],
        });
      }
    }
    previousBalanceAfter = entry.balanceAfter;

    if (entry.absoluteWeek < previousLedgerWeek) {
      context.addIssue({
        code: 'custom',
        message: 'Budget ledger weeks must be nondecreasing.',
        path: ['budget', 'ledger', index, 'absoluteWeek'],
      });
    }
    previousLedgerWeek = entry.absoluteWeek;

    if (
      entry.reason === 'ANNUAL_GRANT' &&
      entry.absoluteWeek !== entry.schoolYearIndex * weeksPerSchoolYear
    ) {
      context.addIssue({
        code: 'custom',
        message: `Annual grant for school year ${entry.schoolYearIndex} must be recorded at week ${entry.schoolYearIndex * weeksPerSchoolYear}.`,
        path: ['budget', 'ledger', index, 'absoluteWeek'],
      });
    }
  }

  if (initialGrantIndexes.length !== 1 || initialGrantIndexes[0] !== 0) {
    context.addIssue({
      code: 'custom',
      message: 'The budget ledger must contain exactly one initial grant as its first entry.',
      path: ['budget', 'ledger'],
    });
  }

  for (let schoolYearIndex = 1; schoolYearIndex <= SCHOOL_YEARS_PER_RUN; schoolYearIndex += 1) {
    const indexes = annualGrantIndexesBySchoolYear.get(schoolYearIndex) ?? [];
    const expectedCount = schoolYearIndex <= settledSchoolYears ? 1 : 0;
    if (indexes.length !== expectedCount) {
      context.addIssue({
        code: 'custom',
        message: `School year ${schoolYearIndex} must contain ${expectedCount} annual grant ledger entry after ${settledSchoolYears} settled school years; found ${indexes.length}.`,
        path: ['budget', 'ledger'],
      });
    }
  }

  for (const [index, result] of state.matchResults.entries()) {
    if (result.absoluteWeek > state.metrics.resolvedCalendarWeeks) {
      context.addIssue({
        code: 'custom',
        message: `Match result week ${result.absoluteWeek} exceeds resolved week ${state.metrics.resolvedCalendarWeeks}.`,
        path: ['matchResults', index, 'absoluteWeek'],
      });
    }
  }

  if (
    state.status === 'THREE_YEAR_COMPLETE' &&
    state.metrics.resolvedCalendarWeeks !== CALENDAR_WEEKS_PER_RUN
  ) {
    context.addIssue({
      code: 'custom',
      message: `A completed run must resolve exactly ${CALENDAR_WEEKS_PER_RUN} calendar weeks.`,
      path: ['metrics', 'resolvedCalendarWeeks'],
    });
  }
  if (state.status === 'ACTIVE' && state.currentWeek === null) {
    context.addIssue({
      code: 'custom',
      message: 'An active game requires a current week.',
      path: ['currentWeek'],
    });
  }
  if (state.status === 'THREE_YEAR_COMPLETE' && state.currentWeek !== null) {
    context.addIssue({
      code: 'custom',
      message: 'A completed three-year run cannot have a current week.',
      path: ['currentWeek'],
    });
  }
});

export const DOMAIN_EVENT_TYPES = [
  'WEEK_RESOLVED',
  'TRAINING_APPLIED',
  'EXAM_WEEK_RESOLVED',
  'MATCH_SIMULATED',
  'PLAYER_GRADE_ADVANCED',
  'PLAYER_GRADUATED',
  'SCHOOL_YEAR_COMPLETED',
  'THREE_YEAR_RUN_COMPLETED',
] as const;

export const DomainEventTypeSchema = z.enum(DOMAIN_EVENT_TYPES);
export type DomainEventType = z.infer<typeof DomainEventTypeSchema>;

export interface DomainEventIdParts {
  committedRevision: number;
  absoluteWeek: number;
  sequence: number;
  type: DomainEventType;
}

const DOMAIN_EVENT_ID_PATTERN = /^event-r([1-9]\d*)-w([1-9]\d*)-s([1-9]\d*)-([A-Z_]+)$/;

export function parseDomainEventId(value: string): DomainEventIdParts | undefined {
  const match = DOMAIN_EVENT_ID_PATTERN.exec(value);
  if (!match) return undefined;

  const committedRevision = Number(match[1]);
  const absoluteWeek = Number(match[2]);
  const sequence = Number(match[3]);
  const type = DomainEventTypeSchema.safeParse(match[4]);
  if (
    !Number.isSafeInteger(committedRevision) ||
    !Number.isSafeInteger(absoluteWeek) ||
    !Number.isSafeInteger(sequence) ||
    !type.success
  ) {
    return undefined;
  }

  return {
    committedRevision,
    absoluteWeek,
    sequence,
    type: type.data,
  };
}

export const DomainEventIdSchema = z
  .string()
  .refine(
    (value) => parseDomainEventId(value) !== undefined,
    'Event ID must encode a positive committed revision, absolute week, sequence, and event type.',
  );

export const DomainEventSchema = z
  .object({
    id: DomainEventIdSchema,
    type: DomainEventTypeSchema,
    at: GameDateSchema,
    payload: z.record(z.string(), z.unknown()),
  })
  .strict()
  .superRefine((event, context) => {
    const id = parseDomainEventId(event.id);
    if (!id) return;

    const absoluteWeek =
      (event.at.schoolYearIndex - 1) * TERMS_PER_SCHOOL_YEAR * WEEKS_PER_TERM +
      (event.at.term - 1) * WEEKS_PER_TERM +
      event.at.weekOfTerm;
    if (id.absoluteWeek !== absoluteWeek) {
      context.addIssue({
        code: 'custom',
        message: `Event ID week ${id.absoluteWeek} does not match event date week ${absoluteWeek}.`,
        path: ['id'],
      });
    }
    if (id.type !== event.type) {
      context.addIssue({
        code: 'custom',
        message: `Event ID type ${id.type} does not match event type ${event.type}.`,
        path: ['id'],
      });
    }
  });

export const RngStreamNameSchema = z.enum(RNG_STREAM_NAMES);
export const RngStreamStateSchema = z
  .object({
    state: NonNegativeIntegerSchema.max(0xffffffff),
    calls: NonNegativeIntegerSchema,
  })
  .strict();

const rngShape = Object.fromEntries(
  RNG_STREAM_NAMES.map((name) => [name, RngStreamStateSchema]),
) as Record<RngStreamName, typeof RngStreamStateSchema>;

export const RngStateBundleSchema = z
  .object({
    rootSeed: z.string().min(1),
    streams: z.object(rngShape).strict(),
  })
  .strict();

export type ActiveStatus = z.infer<typeof ActiveStatusSchema>;
export type AttributeState = z.infer<typeof AttributeStateSchema>;
export type Budget = z.infer<typeof BudgetSchema>;
export type CareerArchive = z.infer<typeof CareerArchiveSchema>;
export type DomainEvent = z.infer<typeof DomainEventSchema>;
export type GameDate = z.infer<typeof GameDateSchema>;
export type GameState = z.infer<typeof GameStateSchema>;
export type MatchResult = z.infer<typeof MatchResultSchema>;
export type Player = z.infer<typeof PlayerSchema>;
export type Position = z.infer<typeof PositionSchema>;
export type RngStateBundle = z.infer<typeof RngStateBundleSchema>;
export type RngStreamState = z.infer<typeof RngStreamStateSchema>;
export type Week = z.infer<typeof WeekSchema>;
