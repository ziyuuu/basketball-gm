import { GameStateSchema, createInitialGame, stableHash } from '@sunny-court/domain';
import { describe, expect, it } from 'vitest';

import { GameSession, createAdvanceWeekCommand, createTrainingPlanCommand } from './index.js';

function createSession(seed: string): GameSession {
  const initial = createInitialGame({
    rootSeed: seed,
    schoolName: '测试高中',
    managerName: '测试经理',
  });
  return new GameSession({
    state: initial.state,
    rng: initial.rng,
    auditClock: () => '2026-07-31T00:00:00.000Z',
  });
}

describe('application command transaction', () => {
  it('commits a valid week atomically', () => {
    const session = createSession('commit');
    const result = session.execute(createAdvanceWeekCommand(session, 'command-1'));

    expect(result.ok).toBe(true);
    expect(session.revision).toBe(1);
    expect(session.state().metrics.resolvedCalendarWeeks).toBe(1);
    expect(session.recentCommandLog()).toHaveLength(1);
    expect(GameStateSchema.safeParse(session.state()).success).toBe(true);
  });

  it('does not contaminate state, RNG, revision, or audit log on a revision conflict', () => {
    const session = createSession('revision-conflict');
    const beforeState = session.state();
    const beforeRng = session.rngSnapshot();
    const command = createAdvanceWeekCommand(session, 'stale-command');
    command.expectedRevision = 99;

    const result = session.execute(command);

    expect(result).toMatchObject({
      ok: false,
      code: 'REVISION_CONFLICT',
    });
    expect(stableHash(session.state())).toBe(stableHash(beforeState));
    expect(session.rngSnapshot()).toEqual(beforeRng);
    expect(session.revision).toBe(0);
    expect(session.recentCommandLog()).toEqual([]);
  });

  it('does not contaminate state when a domain rule rejects an operation', () => {
    const initial = createInitialGame({
      rootSeed: 'budget-reject',
      schoolName: '测试高中',
      managerName: '测试经理',
    });
    initial.state.budget.balance = 0;
    initial.state.budget.ledger.at(-1)!.balanceAfter = 0;
    const session = new GameSession({
      state: initial.state,
      rng: initial.rng,
      auditClock: () => '2026-07-31T00:00:00.000Z',
    });
    const beforeHash = stableHash(session.state());
    const beforeRng = session.rngSnapshot();

    const result = session.execute(createAdvanceWeekCommand(session, 'unaffordable-week'));

    expect(result).toMatchObject({
      ok: false,
      code: 'DOMAIN_RULE_REJECTED',
      domainReasonCode: 'BUDGET_INSUFFICIENT',
    });
    expect(stableHash(session.state())).toBe(beforeHash);
    expect(session.rngSnapshot()).toEqual(beforeRng);
    expect(session.recentCommandLog()).toEqual([]);
  });

  it('accepts a typed training-plan command without consuming rules RNG', () => {
    const session = createSession('training-plan');
    const rngBefore = session.rngSnapshot();
    const result = session.execute(
      createTrainingPlanCommand(session, 'training-command', {
        intensity: 2,
        focus: 'DEFENSE',
      }),
    );

    expect(result.ok).toBe(true);
    expect(session.state().trainingPlan).toEqual({
      intensity: 2,
      focus: 'DEFENSE',
    });
    expect(session.rngSnapshot()).toEqual(rngBefore);
  });
});
