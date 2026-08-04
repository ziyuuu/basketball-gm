import { describe, expect, it } from 'vitest';
import {
  MatchProtocolBundleSchema,
  MODEL_B_BEHAVIOR_REGISTRY,
  MODEL_B_RUNNER_SELECTABLE_BEHAVIOR_IDS,
  createModelBSession,
  finalizeModelBProtocolBundle,
  replayMatch,
  runToEnd,
  stepToNextControlBoundary,
} from '../packages/domain/src/match/index.js';
import { makeP02MatchInput } from './helpers/p02-003-fixtures.js';

describe('P02-003 B7 headless runner identity', () => {
  it('orchestrates the complete frozen selectable matrix rather than a runner-local subset', () => {
    expect(MODEL_B_RUNNER_SELECTABLE_BEHAVIOR_IDS).toEqual(
      MODEL_B_BEHAVIOR_REGISTRY.filter(({ selectable }) => selectable).map(
        ({ behaviorId }) => behaviorId,
      ),
    );
    expect(MODEL_B_RUNNER_SELECTABLE_BEHAVIOR_IDS).toHaveLength(34);
  });

  for (const matchKind of ['OFFICIAL', 'FRIENDLY', 'SCRIMMAGE'] as const) {
    it(`${matchKind}: step, runToEnd and replay are authoritative-object identical`, () => {
      const input = makeP02MatchInput({ matchKind, rootSeed: `b7-${matchKind}` });
      let stepped = createModelBSession(input);
      while (stepped.anchors.at(-1)!.status === 'IN_PROGRESS') {
        stepped = stepToNextControlBoundary(stepped);
      }
      const ran = runToEnd(createModelBSession(input));
      const bundle = finalizeModelBProtocolBundle(ran);
      const replayed = replayMatch(input, bundle);
      expect(stepped.events).toEqual(ran.events);
      expect(stepped.facts).toEqual(ran.facts);
      expect(stepped.anchors).toEqual(ran.anchors);
      expect(stepped.transcriptEntries).toEqual(ran.transcriptEntries);
      expect(ran).toEqual(replayed);
      expect(bundle).toEqual(finalizeModelBProtocolBundle(stepped));
      expect(bundle).toEqual(finalizeModelBProtocolBundle(replayed));
      expect(MatchProtocolBundleSchema.safeParse(bundle).success).toBe(true);
      expect(ran.events.some((event) => event.payload.type === 'SHOT')).toBe(true);
      expect(ran.events.some((event) => event.payload.type === 'TURNOVER')).toBe(true);
      expect(ran.facts.length).toBeGreaterThan(0);
      expect(new Set(ran.transcriptEntries.map(({ actor }) => actor))).toEqual(
        new Set(['ASSISTANT', 'OPPONENT', 'RULES']),
      );
    }, 120_000);
  }

  it('rejects a transcript/result identity that does not match the replayed protocol', () => {
    const input = makeP02MatchInput({ rootSeed: 'b7-authoritative-replay' });
    const bundle = finalizeModelBProtocolBundle(runToEnd(createModelBSession(input)));
    const tampered = structuredClone(bundle);
    tampered.result.matchResultId = bundle.result.finalAnchor.anchorHash;
    expect(MatchProtocolBundleSchema.safeParse(tampered).success).toBe(false);
    expect(() => replayMatch(input, tampered)).toThrow(/protocol|identity|diverge/i);

    const transcriptTampered = structuredClone(bundle);
    const automated = transcriptTampered.result.transcript.entries.find(
      ({ actor }) => actor === 'ASSISTANT' || actor === 'OPPONENT' || actor === 'RULES',
    );
    expect(automated).toBeDefined();
    automated!.previousTranscriptHash = bundle.result.transcript.transcriptHash;
    expect(MatchProtocolBundleSchema.safeParse(transcriptTampered).success).toBe(false);
    expect(() => replayMatch(input, transcriptTampered)).toThrow(
      /protocol|identity|diverge|hash|chain/i,
    );
  }, 120_000);
});
