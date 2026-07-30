import {
  GameStateSchema,
  RngStateBundleSchema,
  TrainingPlanSchema,
  DeterministicRng,
  DomainRuleError,
  RNG_STREAM_NAMES,
  resolveCurrentWeek,
  stableHash,
  type DomainEvent,
  type GameState,
  type RngStateBundle,
  type RngStreamName,
} from '@sunny-court/domain';
import { z } from 'zod';

export const CommandSourceSchema = z.enum(['PLAYER_UI', 'CLI', 'DEBUG', 'AGENT']);

const CommandHeaderSchema = z.object({
  commandId: z.string().min(1),
  source: CommandSourceSchema,
  expectedRevision: z.number().int().min(0),
});

export const AdvanceWeekCommandSchema = CommandHeaderSchema.extend({
  type: z.literal('ADVANCE_WEEK'),
  payload: z.object({}).strict(),
}).strict();

export const SetTrainingPlanCommandSchema = CommandHeaderSchema.extend({
  type: z.literal('SET_TRAINING_PLAN'),
  payload: TrainingPlanSchema,
}).strict();

export const GameCommandSchema = z.discriminatedUnion('type', [
  AdvanceWeekCommandSchema,
  SetTrainingPlanCommandSchema,
]);

const rngCallCountShape = Object.fromEntries(
  RNG_STREAM_NAMES.map((stream) => [stream, z.number().int().min(0)]),
) as Record<RngStreamName, z.ZodNumber>;

export const CommandAuditRecordSchema = z
  .object({
    commandId: z.string().min(1),
    type: z.enum(['ADVANCE_WEEK', 'SET_TRAINING_PLAN']),
    source: CommandSourceSchema,
    expectedRevision: z.number().int().min(0),
    committedRevision: z.number().int().min(1),
    rngCallsBefore: z.object(rngCallCountShape).strict(),
    rngCallsAfter: z.object(rngCallCountShape).strict(),
    stateHash: z.string().min(1),
    eventIds: z.array(z.string().min(1)),
    auditedAt: z.string().datetime(),
  })
  .strict();

export const COMMAND_FAILURE_CODES = [
  'COMMAND_SCHEMA_INVALID',
  'REVISION_CONFLICT',
  'DOMAIN_RULE_REJECTED',
  'STATE_VALIDATION_FAILED',
] as const;

export type GameCommand = z.infer<typeof GameCommandSchema>;
export type CommandAuditRecord = z.infer<typeof CommandAuditRecordSchema>;
export type CommandFailureCode = (typeof COMMAND_FAILURE_CODES)[number];

export interface CommandSuccess {
  ok: true;
  revision: number;
  events: DomainEvent[];
  audit: CommandAuditRecord;
}

export interface CommandFailure {
  ok: false;
  code: CommandFailureCode;
  message: string;
  domainReasonCode?: string;
  issues?: string[];
}

export type CommandResult = CommandSuccess | CommandFailure;

export interface GameSessionOptions {
  state: GameState;
  rng: DeterministicRng | RngStateBundle;
  recentCommandLog?: readonly CommandAuditRecord[];
  auditClock?: () => string;
}

function schemaIssues(error: z.ZodError): string[] {
  return error.issues.map(
    (issue) => `${issue.path.length > 0 ? issue.path.join('.') : '<root>'}: ${issue.message}`,
  );
}

function exhaustive(value: never): never {
  throw new Error(`Unhandled command: ${JSON.stringify(value)}`);
}

export class GameSession {
  #state: GameState;
  #rng: DeterministicRng;
  #recentCommandLog: CommandAuditRecord[];
  readonly #auditClock: () => string;

  constructor(options: GameSessionOptions) {
    this.#state = GameStateSchema.parse(structuredClone(options.state));
    this.#rng =
      options.rng instanceof DeterministicRng
        ? options.rng.clone()
        : DeterministicRng.fromSnapshot(RngStateBundleSchema.parse(options.rng));
    this.#recentCommandLog = (options.recentCommandLog ?? []).map((record) =>
      CommandAuditRecordSchema.parse(structuredClone(record)),
    );
    this.#auditClock = options.auditClock ?? (() => new Date().toISOString());
  }

  get revision(): number {
    return this.#state.revision;
  }

  get status(): GameState['status'] {
    return this.#state.status;
  }

  state(): GameState {
    return GameStateSchema.parse(structuredClone(this.#state));
  }

  rngSnapshot(): RngStateBundle {
    return this.#rng.snapshot();
  }

  recentCommandLog(): CommandAuditRecord[] {
    return this.#recentCommandLog.map((record) =>
      CommandAuditRecordSchema.parse(structuredClone(record)),
    );
  }

  execute(rawCommand: unknown): CommandResult {
    const parsedCommand = GameCommandSchema.safeParse(rawCommand);
    if (!parsedCommand.success) {
      return {
        ok: false,
        code: 'COMMAND_SCHEMA_INVALID',
        message: 'Command Schema validation failed.',
        issues: schemaIssues(parsedCommand.error),
      };
    }

    const command = parsedCommand.data;
    if (command.expectedRevision !== this.#state.revision) {
      return {
        ok: false,
        code: 'REVISION_CONFLICT',
        message: `Expected revision ${command.expectedRevision}; current revision is ${this.#state.revision}.`,
      };
    }

    const workingState = structuredClone(this.#state);
    const workingRng = this.#rng.clone();
    const rngCallsBefore = workingRng.callCounts();
    let events: DomainEvent[] = [];

    try {
      switch (command.type) {
        case 'ADVANCE_WEEK': {
          const transition = resolveCurrentWeek(workingState, workingRng);
          events = transition.events;
          break;
        }
        case 'SET_TRAINING_PLAN':
          workingState.trainingPlan = structuredClone(command.payload);
          break;
        default:
          exhaustive(command);
      }

      workingState.revision += 1;
      const committedState = GameStateSchema.parse(workingState);
      const rngCallsAfter = workingRng.callCounts();
      const audit = CommandAuditRecordSchema.parse({
        commandId: command.commandId,
        type: command.type,
        source: command.source,
        expectedRevision: command.expectedRevision,
        committedRevision: committedState.revision,
        rngCallsBefore,
        rngCallsAfter,
        stateHash: stableHash(committedState),
        eventIds: events.map((domainEvent) => domainEvent.id),
        auditedAt: this.#auditClock(),
      });

      this.#state = committedState;
      this.#rng = workingRng;
      this.#recentCommandLog = [...this.#recentCommandLog, audit].slice(-64);

      return {
        ok: true,
        revision: committedState.revision,
        events: structuredClone(events),
        audit: structuredClone(audit),
      };
    } catch (error) {
      if (error instanceof DomainRuleError) {
        return {
          ok: false,
          code: 'DOMAIN_RULE_REJECTED',
          message: error.message,
          domainReasonCode: error.reasonCode,
        };
      }
      if (error instanceof z.ZodError) {
        return {
          ok: false,
          code: 'STATE_VALIDATION_FAILED',
          message: 'The proposed state failed invariant validation.',
          issues: schemaIssues(error),
        };
      }
      throw error;
    }
  }
}

/**
 * Throwaway batch adapter for simulation evidence.
 *
 * It uses the same validated command envelope and domain resolver as GameSession, but commits
 * in-place and records no per-command audit hash. If a command throws, the entire ephemeral run
 * must be discarded. Persistent/player sessions must always use GameSession.
 */
export class EphemeralBatchSession {
  #state: GameState;
  #rng: DeterministicRng;

  constructor(options: Pick<GameSessionOptions, 'state' | 'rng'>) {
    this.#state = GameStateSchema.parse(structuredClone(options.state));
    this.#rng =
      options.rng instanceof DeterministicRng
        ? options.rng.clone()
        : DeterministicRng.fromSnapshot(RngStateBundleSchema.parse(options.rng));
  }

  get revision(): number {
    return this.#state.revision;
  }

  get status(): GameState['status'] {
    return this.#state.status;
  }

  executeAdvanceWeek(rawCommand: unknown): DomainEvent[] {
    const command = AdvanceWeekCommandSchema.parse(rawCommand);
    if (command.expectedRevision !== this.#state.revision) {
      throw new Error(
        `Ephemeral batch revision conflict: expected ${command.expectedRevision}, current ${this.#state.revision}.`,
      );
    }
    const transition = resolveCurrentWeek(this.#state, this.#rng);
    this.#state = transition.state;
    this.#state.revision += 1;
    return transition.events;
  }

  validateCheckpoint(): void {
    this.#state = GameStateSchema.parse(this.#state);
  }

  state(): GameState {
    return GameStateSchema.parse(structuredClone(this.#state));
  }

  rngSnapshot(): RngStateBundle {
    return this.#rng.snapshot();
  }
}

export function createAdvanceWeekCommand(
  session: Pick<GameSession, 'revision'> | Pick<EphemeralBatchSession, 'revision'>,
  commandId: string,
  source: z.infer<typeof CommandSourceSchema> = 'CLI',
): GameCommand {
  return {
    commandId,
    type: 'ADVANCE_WEEK',
    source,
    expectedRevision: session.revision,
    payload: {},
  };
}

export function createTrainingPlanCommand(
  session: GameSession,
  commandId: string,
  payload: z.infer<typeof TrainingPlanSchema>,
  source: z.infer<typeof CommandSourceSchema> = 'CLI',
): GameCommand {
  return {
    commandId,
    type: 'SET_TRAINING_PLAN',
    source,
    expectedRevision: session.revision,
    payload,
  };
}
