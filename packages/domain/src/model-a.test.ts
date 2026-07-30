import { describe, expect, it } from 'vitest';

import { createInitialGame } from './create-game.js';
import { simulateModelAMatch } from './model-a.js';
import { MatchResultSchema } from './schemas.js';

describe('P01 match model A', () => {
  it('emits a valid structured result whose player points equal the team score', () => {
    const { state, rng } = createInitialGame({
      rootSeed: 'model-a',
      schoolName: '测试高中',
      managerName: '测试经理',
    });

    const result = simulateModelAMatch(state, rng);
    expect(MatchResultSchema.safeParse(result).success).toBe(true);
    expect(result.playerStats.reduce((sum, stat) => sum + stat.points, 0)).toBe(result.score.home);
    expect(result.score.home).not.toBe(result.score.away);
    expect(result.simVersion).toBe('model-a-p01');
  });
});
