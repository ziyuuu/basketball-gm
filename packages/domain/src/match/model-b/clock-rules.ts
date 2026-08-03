import type { MatchAnchor, MatchEvent } from '../schemas.js';
import { keyedDrawUnitInterval } from '../keyed-rng.js';
import { MODEL_B_PARAMETER_REGISTRY } from './registries.js';
import {
  commitModelBTransition,
  type ModelBFactDraft,
  type ModelBSession,
  type ModelBTransitionDraft,
} from './session.js';

export type ModelBSegmentResolution =
  'SAME_SIDE_DEAD_BALL' | 'OFFENSIVE_REBOUND' | 'POSSESSION_CHANGE' | 'PERIOD_END';

export type ModelBActiveSegmentDraft = Readonly<{
  eventPayloads: readonly MatchEvent['payload'][];
  facts?: readonly ModelBFactDraft[];
  resolution: ModelBSegmentResolution;
  effectiveFragment?: MatchAnchor['effectiveFragment'];
  fatigueMilliByPlayer?: MatchAnchor['fatigueMilliByPlayer'];
  chemistryWeightedMilli?: MatchAnchor['chemistryWeightedMilli'];
}>;

function oppositeSide(side: MatchAnchor['possession']['side']): 'HOME' | 'AWAY' {
  return side === 'HOME' ? 'AWAY' : 'HOME';
}

function currentAnchor(session: ModelBSession): MatchAnchor {
  const anchor = session.anchors.at(-1);
  if (anchor === undefined) throw new Error('Model B session has no current Anchor.');
  return anchor;
}

export function rebuildModelBShotClockSeconds(
  anchor: MatchAnchor,
  events: readonly MatchEvent[],
): number {
  let shotClockSeconds = MODEL_B_PARAMETER_REGISTRY.shotClock.newPossessionSeconds;
  for (const event of events.slice(0, anchor.eventCursor)) {
    if (
      event.period !== anchor.period ||
      event.possessionIndex !== anchor.possession.possessionIndex
    ) {
      continue;
    }
    if (event.payload.type === 'POSSESSION_STARTED') {
      shotClockSeconds = MODEL_B_PARAMETER_REGISTRY.shotClock.newPossessionSeconds;
    } else if (event.payload.type === 'REBOUND' && event.payload.kind === 'OFFENSIVE') {
      shotClockSeconds = MODEL_B_PARAMETER_REGISTRY.shotClock.offensiveReboundSeconds;
    } else if (event.payload.type === 'CLOCK_ADVANCED') {
      shotClockSeconds = Math.max(0, shotClockSeconds - event.payload.seconds);
    }
  }
  return shotClockSeconds;
}

function hasPossessionStart(session: ModelBSession, anchor: MatchAnchor): boolean {
  return session.events
    .slice(0, anchor.eventCursor)
    .some(
      (event) =>
        event.period === anchor.period &&
        event.possessionIndex === anchor.possession.possessionIndex &&
        event.payload.type === 'POSSESSION_STARTED',
    );
}

function nextPossession(
  anchor: MatchAnchor,
  resolution: ModelBSegmentResolution,
): MatchAnchor['possession'] {
  switch (resolution) {
    case 'SAME_SIDE_DEAD_BALL':
    case 'OFFENSIVE_REBOUND':
      return { ...anchor.possession, segmentIndex: anchor.possession.segmentIndex + 1 };
    case 'POSSESSION_CHANGE':
      return {
        side: oppositeSide(anchor.possession.side),
        possessionIndex: anchor.possession.possessionIndex + 1,
        segmentIndex: 0,
      };
    case 'PERIOD_END':
      return { ...anchor.possession };
  }
}

function shiftFactSources(
  facts: readonly ModelBFactDraft[] | undefined,
  prefixCount: number,
): readonly ModelBFactDraft[] | undefined {
  return facts?.map((fact) => ({
    ...fact,
    sourceEventIndexes: fact.sourceEventIndexes.map((index) => index + prefixCount),
  }));
}

/** Commits one live segment to its natural boundary. */
export function commitModelBActiveSegment(
  session: ModelBSession,
  draft: ModelBActiveSegmentDraft,
): ModelBSession {
  const anchor = currentAnchor(session);
  if (anchor.status !== 'IN_PROGRESS') throw new Error('A completed match has no active segment.');
  const clockSeconds = draft.eventPayloads.reduce(
    (total, payload) => total + (payload.type === 'CLOCK_ADVANCED' ? payload.seconds : 0),
    0,
  );
  if (clockSeconds < 1)
    throw new Error('Every active Model B segment must commit at least one second.');
  if (clockSeconds > anchor.periodClockSeconds) {
    throw new Error('An active segment cannot consume more than the remaining period clock.');
  }
  const shotClockSeconds = rebuildModelBShotClockSeconds(anchor, session.events);
  if (clockSeconds > shotClockSeconds) {
    throw new Error('An active segment cannot consume more than the rebuilt shot clock.');
  }
  const reachesPeriodEnd = clockSeconds === anchor.periodClockSeconds;
  if ((draft.resolution === 'PERIOD_END') !== reachesPeriodEnd) {
    throw new Error(
      'PERIOD_END resolution must match an event prefix that reaches zero period clock.',
    );
  }
  if (draft.resolution === 'OFFENSIVE_REBOUND') {
    const hasOffensiveRebound = draft.eventPayloads.some(
      (payload) => payload.type === 'REBOUND' && payload.kind === 'OFFENSIVE',
    );
    if (!hasOffensiveRebound) {
      throw new Error('OFFENSIVE_REBOUND resolution requires an offensive REBOUND event.');
    }
  }
  const reachesShotClockEnd = clockSeconds === shotClockSeconds;
  if (
    reachesShotClockEnd &&
    !reachesPeriodEnd &&
    !draft.eventPayloads.some((payload) => payload.type === 'SHOT' || payload.type === 'TURNOVER')
  ) {
    throw new Error('A shot-clock-expiring segment must resolve through SHOT or TURNOVER.');
  }
  const prefix = hasPossessionStart(session, anchor)
    ? []
    : ([
        { type: 'POSSESSION_STARTED', side: anchor.possession.side },
      ] satisfies MatchEvent['payload'][]);
  const suffix =
    draft.resolution === 'POSSESSION_CHANGE'
      ? ([
          { type: 'POSSESSION_ENDED', side: anchor.possession.side },
        ] satisfies MatchEvent['payload'][])
      : [];
  const facts = shiftFactSources(draft.facts, prefix.length);
  return commitModelBTransition(session, {
    eventPayloads: [...prefix, ...draft.eventPayloads, ...suffix],
    nextPossession: nextPossession(anchor, draft.resolution),
    ...(facts === undefined ? {} : { facts }),
    ...(draft.effectiveFragment === undefined
      ? {}
      : { effectiveFragment: draft.effectiveFragment }),
    ...(draft.fatigueMilliByPlayer === undefined
      ? {}
      : { fatigueMilliByPlayer: draft.fatigueMilliByPlayer }),
    ...(draft.chemistryWeightedMilli === undefined
      ? {}
      : { chemistryWeightedMilli: draft.chemistryWeightedMilli }),
  });
}

export function commitModelBShotClockViolation(
  session: ModelBSession,
  handlerPlayerId: string,
): ModelBSession {
  const anchor = currentAnchor(session);
  if (rebuildModelBShotClockSeconds(anchor, session.events) !== 0) {
    throw new Error('A shot-clock violation requires a rebuilt shot clock of zero.');
  }
  return commitModelBTransition(session, {
    eventPayloads: [
      {
        type: 'TURNOVER',
        playerId: handlerPlayerId,
        turnoverKind: 'UNFORCED_DEAD_BALL',
      },
      { type: 'POSSESSION_ENDED', side: anchor.possession.side },
    ],
    facts: [
      {
        factKind: 'EXPLANATION',
        sourceEventIndexes: [0],
        payload: {
          type: 'SHOT_CLOCK_VIOLATION',
          handlerPlayerId,
          period: anchor.period,
          possessionIndex: anchor.possession.possessionIndex,
          segmentIndex: anchor.possession.segmentIndex,
        },
      },
    ],
    nextPossession: {
      side: oppositeSide(anchor.possession.side),
      possessionIndex: anchor.possession.possessionIndex + 1,
      segmentIndex: 0,
    },
  });
}

export type ModelBPeriodEndDisposition = 'NEXT_REGULATION_PERIOD' | 'OVERTIME' | 'MATCH_COMPLETE';

export function determineModelBPeriodEndDisposition(
  input: ModelBSession['input'],
  anchor: MatchAnchor,
): ModelBPeriodEndDisposition {
  if (anchor.period < 4) return 'NEXT_REGULATION_PERIOD';
  if (
    anchor.score.home === anchor.score.away &&
    (input.matchKind === 'OFFICIAL' || input.matchKind === 'FRIENDLY')
  ) {
    return 'OVERTIME';
  }
  return 'MATCH_COMPLETE';
}

function openingSideForPeriod(session: ModelBSession, nextPeriod: number): 'HOME' | 'AWAY' {
  if (nextPeriod <= 4) {
    const firstSide = session.anchors[0]!.possession.side;
    return nextPeriod % 2 === 1 ? firstSide : oppositeSide(firstSide);
  }
  return keyedDrawUnitInterval({
    matchSeed: session.input.matchSeed,
    period: nextPeriod,
    possessionIndex: 0,
    segmentIndex: 0,
    drawKind: 'BALL_HANDLER',
    localIndex: 0,
  }) < 0.5
    ? 'HOME'
    : 'AWAY';
}

/** PERIOD end order is always POSSESSION_ENDED → PERIOD_COMPLETED → optional MATCH_COMPLETED. */
export function completeModelBPeriod(session: ModelBSession): ModelBSession {
  const anchor = currentAnchor(session);
  if (anchor.periodClockSeconds !== 0) {
    throw new Error('A period can only complete at zero period clock.');
  }
  const disposition = determineModelBPeriodEndDisposition(session.input, anchor);
  if (disposition === 'MATCH_COMPLETE') {
    return commitModelBTransition(session, {
      eventPayloads: [
        { type: 'POSSESSION_ENDED', side: anchor.possession.side },
        { type: 'PERIOD_COMPLETED', period: anchor.period },
        { type: 'MATCH_COMPLETED', terminationReason: 'COMPLETED' },
      ],
      status: 'COMPLETED',
      controlBoundaryKind: 'MATCH_COMPLETE',
    });
  }
  const nextPeriod = anchor.period + 1;
  const nextPossessionIndex = anchor.possession.possessionIndex + 1;
  return commitModelBTransition(session, {
    eventPayloads: [
      { type: 'POSSESSION_ENDED', side: anchor.possession.side },
      { type: 'PERIOD_COMPLETED', period: anchor.period },
    ],
    nextPeriod,
    nextPossession: {
      side: openingSideForPeriod(session, nextPeriod),
      possessionIndex: nextPossessionIndex,
      segmentIndex: 0,
    },
    controlBoundaryKind: 'PERIOD_BREAK',
  });
}

export class ModelBWatchdogError extends Error {
  readonly transitions: number;

  constructor(transitions: number) {
    super(`Model B watchdog exceeded after ${transitions} transitions.`);
    this.name = 'ModelBWatchdogError';
    this.transitions = transitions;
  }
}

export function assertModelBWatchdog(transitions: number, maximumTransitions: number): void {
  if (
    !Number.isSafeInteger(transitions) ||
    !Number.isSafeInteger(maximumTransitions) ||
    transitions < 0 ||
    maximumTransitions < 1
  ) {
    throw new Error('Model B watchdog inputs must be non-negative/positive safe integers.');
  }
  if (transitions > maximumTransitions) throw new ModelBWatchdogError(transitions);
}

export function commitModelBRuleTransition(
  session: ModelBSession,
  draft: ModelBTransitionDraft,
): ModelBSession {
  return commitModelBTransition(session, draft);
}
