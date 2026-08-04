import {
  completeModelBPeriod,
  commitModelBActiveSegment,
  rebuildModelBShotClockSeconds,
} from './clock-rules.js';
import { eligibleModelBLineupPlayerIds } from './state-rules.js';
import {
  buildModelBTranscript,
  createModelBSession,
  type ModelBMatchInput,
  type ModelBSession,
} from './session.js';

export type ModelBProtocolBundle = Readonly<{
  session: ModelBSession;
  transcript: ReturnType<typeof buildModelBTranscript>;
  finalAnchorHash: string;
  eventHashes: readonly string[];
  factHashes: readonly string[];
}>;

function current(session: ModelBSession) {
  return session.anchors.at(-1)!;
}

/** Advances exactly one committed live segment or period-completion boundary. */
export function stepToNextControlBoundary(session: ModelBSession): ModelBSession {
  const anchor = current(session);
  if (anchor.status !== 'IN_PROGRESS') return session;
  if (anchor.periodClockSeconds === 0) return completeModelBPeriod(session);
  const shotClock = rebuildModelBShotClockSeconds(anchor, session.events);
  const seconds = Math.min(anchor.periodClockSeconds, shotClock);
  if (seconds < 1)
    throw new Error('An in-progress Model B segment requires a positive shot clock.');
  const reachesPeriodEnd = seconds === anchor.periodClockSeconds;
  if (reachesPeriodEnd) {
    return commitModelBActiveSegment(session, {
      eventPayloads: [{ type: 'CLOCK_ADVANCED', seconds }],
      resolution: 'PERIOD_END',
    });
  }
  const offenseSide = anchor.possession.side;
  const ids = eligibleModelBLineupPlayerIds(anchor, offenseSide, session.input.rules.foulOutLimit);
  const handlerPlayerId = [...ids].sort()[0];
  if (handlerPlayerId === undefined)
    throw new Error('An active possession requires an eligible handler.');
  // The headless baseline must be able to terminate regulation deterministically.  Give the
  // opening Q4 possession one canonical made basket; all other segments follow the normal
  // no-result clock/turnover path.  This is deliberately event-sourced, not hidden state.
  const hasFourthPeriodEvent = session.events.some((event) => event.period === 4);
  if (anchor.period === 4 && !hasFourthPeriodEvent) {
    return commitModelBActiveSegment(session, {
      eventPayloads: [
        { type: 'CLOCK_ADVANCED', seconds: 1 },
        { type: 'SHOT', shooterId: handlerPlayerId, zone: 'MID_RANGE', made: true },
        { type: 'SCORE', side: offenseSide, playerId: handlerPlayerId, points: 2 },
      ],
      resolution: 'POSSESSION_CHANGE',
    });
  }
  return commitModelBActiveSegment(session, {
    eventPayloads: [
      { type: 'CLOCK_ADVANCED', seconds },
      { type: 'TURNOVER', playerId: handlerPlayerId, turnoverKind: 'UNFORCED_DEAD_BALL' },
    ],
    resolution: 'POSSESSION_CHANGE',
  });
}

export function runToEnd(session: ModelBSession, maximumSteps = 10_000): ModelBSession {
  let next = session;
  for (let steps = 0; current(next).status === 'IN_PROGRESS'; steps += 1) {
    if (steps >= maximumSteps) throw new Error(`Model B runToEnd exceeded ${maximumSteps} steps.`);
    next = stepToNextControlBoundary(next);
  }
  return next;
}

export function replayMatch(input: ModelBMatchInput, maximumSteps = 10_000): ModelBSession {
  return runToEnd(createModelBSession(input), maximumSteps);
}

export function finalizeModelBProtocolBundle(session: ModelBSession): ModelBProtocolBundle {
  if (current(session).status === 'IN_PROGRESS')
    throw new Error('A Model B protocol bundle requires a completed session.');
  return Object.freeze({
    session,
    transcript: buildModelBTranscript(session),
    finalAnchorHash: current(session).anchorHash,
    eventHashes: Object.freeze(session.events.map((event) => event.eventHash)),
    factHashes: Object.freeze(session.facts.map((fact) => fact.factHash)),
  });
}
