import { clampFixedPoint } from '../../core/index.js';
import type { MatchFact } from '../schemas.js';
import { MODEL_B_PARAMETER_REGISTRY } from './registries.js';
import type { ModelBSession } from './session.js';

type MatchSide = 'HOME' | 'AWAY';

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function opportunityContribution(fact: MatchFact): Readonly<{
  sourceEventId: string;
  factId: string;
  factType: 'CREATION' | 'DEFENSIVE_ACTION';
  deltaMilli: number;
}> | null {
  const payload = asRecord(fact.payload);
  if (payload?.type !== 'CREATION' && payload?.type !== 'DEFENSIVE_ACTION') return null;
  if (fact.sourceEventIds.length !== 1 || !Number.isSafeInteger(payload.opportunityQualityDelta)) {
    throw new Error('An opportunity contributor must bind one source and one integer delta.');
  }
  return Object.freeze({
    sourceEventId: fact.sourceEventIds[0]!,
    factId: fact.factId,
    factType: payload.type,
    deltaMilli: payload.opportunityQualityDelta as number,
  });
}

/** Reduces committed facts only; presentation/log switches are intentionally absent. */
export function calculateModelBOpportunityLedger(
  facts: readonly MatchFact[],
  coordinate: Readonly<{ period: number; possessionIndex: number }>,
): Readonly<{
  contributors: readonly Readonly<{
    sourceEventId: string;
    factId: string;
    factType: 'CREATION' | 'DEFENSIVE_ACTION';
    deltaMilli: number;
  }>[];
  rawDeltaMilli: number;
  netPossessionDeltaMilli: number;
}> {
  const contributors = facts.flatMap((fact) => {
    const payload = asRecord(fact.payload);
    if (
      payload?.period !== coordinate.period ||
      payload.possessionIndex !== coordinate.possessionIndex
    ) {
      return [];
    }
    const contribution = opportunityContribution(fact);
    return contribution === null ? [] : [contribution];
  });
  const sources = new Set<string>();
  let rawDeltaMilli = 0;
  for (const contribution of contributors) {
    if (sources.has(contribution.sourceEventId)) {
      throw new Error('One source event may contribute at most one opportunity ledger delta.');
    }
    sources.add(contribution.sourceEventId);
    rawDeltaMilli += contribution.deltaMilli;
    if (!Number.isSafeInteger(rawDeltaMilli)) {
      throw new Error('Opportunity ledger sum exceeds the safe integer range.');
    }
  }
  return Object.freeze({
    contributors: Object.freeze(contributors),
    rawDeltaMilli,
    netPossessionDeltaMilli: clampFixedPoint(
      rawDeltaMilli,
      -MODEL_B_PARAMETER_REGISTRY.opportunityPossessionCapMilli,
      MODEL_B_PARAMETER_REGISTRY.opportunityPossessionCapMilli,
    ),
  });
}

function assertDenominator(value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error('A Model B analysis denominator must be a non-negative safe integer.');
  }
}

export function calculateModelBDefensiveBreakdownMetrics(
  session: ModelBSession,
  input: Readonly<{ defenseSide: MatchSide; opponentHalfCourtPossessions: number }>,
): Readonly<{
  defensiveBreakdownOpportunityEvents: number;
  defensiveBreakdownEvents: number;
  defensiveBreakdownOpportunityRate: number | null;
  defensiveBreakdownRate: number | null;
}> {
  assertDenominator(input.opponentHalfCourtPossessions);
  const eventsById = new Map(session.events.map((event) => [event.eventId, event]));
  const sources = new Set<string>();
  let defensiveBreakdownOpportunityEvents = 0;
  let defensiveBreakdownEvents = 0;
  for (const fact of session.facts) {
    const payload = asRecord(fact.payload);
    if (
      payload?.type !== 'DEFENSIVE_ACTION' ||
      payload.defenseSide !== input.defenseSide ||
      payload.breakdownOpportunity !== true
    ) {
      continue;
    }
    if (fact.sourceEventIds.length !== 1 || typeof payload.handlerId !== 'string') {
      throw new Error('A defensive breakdown opportunity must bind one source and handler.');
    }
    const sourceEventId = fact.sourceEventIds[0]!;
    if (sources.has(sourceEventId)) {
      throw new Error('One defensive source may count at most once in breakdown metrics.');
    }
    sources.add(sourceEventId);
    const source = eventsById.get(sourceEventId);
    if (source === undefined) throw new Error('A breakdown fact references an unknown source.');
    defensiveBreakdownOpportunityEvents += 1;
    if (
      session.events.some(
        (event) =>
          event.cursor > source.cursor &&
          event.period === source.period &&
          event.possessionIndex === source.possessionIndex &&
          event.payload.type === 'SHOT' &&
          event.payload.made &&
          event.payload.shooterId === payload.handlerId,
      )
    ) {
      defensiveBreakdownEvents += 1;
    }
  }
  const denominator = input.opponentHalfCourtPossessions;
  return Object.freeze({
    defensiveBreakdownOpportunityEvents,
    defensiveBreakdownEvents,
    defensiveBreakdownOpportunityRate:
      denominator === 0 ? null : defensiveBreakdownOpportunityEvents / denominator,
    defensiveBreakdownRate: denominator === 0 ? null : defensiveBreakdownEvents / denominator,
  });
}

export function calculateModelBTacticExecutionMetrics(
  session: ModelBSession,
  side: MatchSide,
): Readonly<{
  tacticExecutionOpportunities: number;
  successfulTacticExecutions: number;
  tacticExecutionRate: number | null;
}> {
  const eventsById = new Map(session.events.map((event) => [event.eventId, event]));
  const anchorsByHash = new Map(session.anchors.map((anchor) => [anchor.anchorHash, anchor]));
  let tacticExecutionOpportunities = 0;
  let successfulTacticExecutions = 0;
  for (const fact of session.facts) {
    const payload = asRecord(fact.payload);
    const source = eventsById.get(fact.sourceEventIds[0]!);
    if (payload?.type === 'CREATION' && source !== undefined) {
      const sourceSide = anchorsByHash.get(source.previousAnchorHash)?.possession.side;
      if (sourceSide !== side) continue;
      tacticExecutionOpportunities += 1;
      if (
        payload.nextBehaviorId !== null &&
        typeof payload.opportunityQualityDelta === 'number' &&
        payload.opportunityQualityDelta > 0
      ) {
        successfulTacticExecutions += 1;
      }
    } else if (payload?.type === 'DEFENSIVE_ACTION' && payload.defenseSide === side) {
      tacticExecutionOpportunities += 1;
      if (payload.result === 'SUCCESS') successfulTacticExecutions += 1;
    }
  }
  return Object.freeze({
    tacticExecutionOpportunities,
    successfulTacticExecutions,
    tacticExecutionRate:
      tacticExecutionOpportunities === 0
        ? null
        : successfulTacticExecutions / tacticExecutionOpportunities,
  });
}
