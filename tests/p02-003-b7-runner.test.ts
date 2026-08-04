import { describe, expect, it } from 'vitest';
import {
  createModelBSession,
  finalizeModelBProtocolBundle,
  replayMatch,
  runToEnd,
  stepToNextControlBoundary,
} from '../packages/domain/src/match/index.js';
import { makeP02MatchInput } from './helpers/p02-003-fixtures.js';

describe('P02-003 B7 headless runner identity', () => {
  for (const matchKind of ['OFFICIAL', 'FRIENDLY', 'SCRIMMAGE'] as const) {
    it(`${matchKind}: step, runToEnd and replay are authoritative-object identical`, () => {
      const input = makeP02MatchInput({ matchKind, rootSeed: `b7-${matchKind}` });
      let stepped = createModelBSession(input);
      while (stepped.anchors.at(-1)!.status === 'IN_PROGRESS') {
        stepped = stepToNextControlBoundary(stepped);
      }
      const ran = runToEnd(createModelBSession(input));
      const replayed = replayMatch(input);
      expect(stepped.events).toEqual(ran.events);
      expect(stepped.facts).toEqual(ran.facts);
      expect(stepped.anchors).toEqual(ran.anchors);
      expect(stepped.transcriptEntries).toEqual(ran.transcriptEntries);
      expect(ran).toEqual(replayed);
      expect(finalizeModelBProtocolBundle(stepped)).toEqual(finalizeModelBProtocolBundle(replayed));
    });
  }
});
