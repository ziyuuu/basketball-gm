import { clampFixedPoint, roundHalfUp } from '../../core/index.js';
import { MODEL_B_PARAMETER_REGISTRY, type ModelBBehaviorId } from './registries.js';

export type ShotZone = 'INSIDE' | 'MID_RANGE' | 'THREE_POINT';
export type CreationBehaviorId = Extract<
  ModelBBehaviorId,
  'DRIVE' | 'SHAKE' | 'ISO' | 'STEP_BACK' | 'POSTUP' | 'HIGH_POST_CREATION'
>;

function assertExecutionMilli(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < -100_000 || value > 100_000) {
    throw new Error(`${label} must be a safe execution milli value.`);
  }
}

function coefficientDeltaMilli(
  executionDifferenceMilli: number,
  numerator: number,
  denominator: number,
): number {
  return roundHalfUp(executionDifferenceMilli * numerator, denominator * 1_000);
}

export function calculateTurnoverProbabilityMilli(
  input: Readonly<{
    defensivePressureMilli: number;
    ballSecurityMilli: number;
    actionPressureMilli: -3_000 | 4_000;
    pace: 'SLOW' | 'BALANCED' | 'FAST';
    teamExecutionModifierMilli: number;
    additionalRiskMilli?: number;
  }>,
): number {
  assertExecutionMilli(input.defensivePressureMilli, 'defensivePressureMilli');
  assertExecutionMilli(input.ballSecurityMilli, 'ballSecurityMilli');
  assertExecutionMilli(input.teamExecutionModifierMilli, 'teamExecutionModifierMilli');
  const parameters = MODEL_B_PARAMETER_REGISTRY.turnover;
  const probability =
    parameters.baseMilli +
    coefficientDeltaMilli(
      input.defensivePressureMilli - input.ballSecurityMilli,
      parameters.differenceCoefficientNumerator,
      parameters.differenceCoefficientDenominator,
    ) +
    coefficientDeltaMilli(input.actionPressureMilli, 2, 1) +
    MODEL_B_PARAMETER_REGISTRY.paceTurnoverModifierMilli[input.pace] -
    coefficientDeltaMilli(input.teamExecutionModifierMilli, 2, 1) +
    (input.additionalRiskMilli ?? 0);
  return clampFixedPoint(probability, parameters.minimumMilli, parameters.maximumMilli);
}

export function calculatePressuredTurnoverClassificationProbabilityMilli(
  input: Readonly<{
    defensivePressureMilli: number;
    ballSecurityMilli: number;
    actionPressureMilli: -3_000 | 4_000;
  }>,
): number {
  const parameters = MODEL_B_PARAMETER_REGISTRY.turnover;
  const probability =
    parameters.pressuredBaseMilli +
    roundHalfUp(input.actionPressureMilli * parameters.pressuredActionCoefficientMilli, 1_000) +
    coefficientDeltaMilli(
      input.defensivePressureMilli - input.ballSecurityMilli,
      parameters.pressuredDifferenceCoefficientNumerator,
      parameters.pressuredDifferenceCoefficientDenominator,
    );
  return clampFixedPoint(
    probability,
    parameters.pressuredMinimumMilli,
    parameters.pressuredMaximumMilli,
  );
}

export function calculateShotProbabilityMilli(
  input: Readonly<{
    zone: ShotZone;
    offensiveExecutionMilli: number;
    defensiveExecutionMilli: number;
    opportunityQualityMilli: number;
  }>,
): number {
  assertExecutionMilli(input.offensiveExecutionMilli, 'offensiveExecutionMilli');
  assertExecutionMilli(input.defensiveExecutionMilli, 'defensiveExecutionMilli');
  assertExecutionMilli(input.opportunityQualityMilli, 'opportunityQualityMilli');
  const parameters = MODEL_B_PARAMETER_REGISTRY.shot;
  const probability =
    parameters.baseMilli[input.zone] +
    coefficientDeltaMilli(
      input.offensiveExecutionMilli - input.defensiveExecutionMilli,
      parameters.executionCoefficientNumerator,
      parameters.executionCoefficientDenominator,
    ) +
    coefficientDeltaMilli(
      input.opportunityQualityMilli - 50_000,
      parameters.opportunityCoefficientNumerator,
      parameters.opportunityCoefficientDenominator,
    );
  return clampFixedPoint(
    probability,
    parameters.minimumMilli[input.zone],
    parameters.maximumMilli[input.zone],
  );
}

export function calculateFreeThrowProbabilityMilli(
  shootingMilli: number,
  fatiguePenaltyMilli: number,
): number {
  assertExecutionMilli(shootingMilli, 'shootingMilli');
  assertExecutionMilli(fatiguePenaltyMilli, 'fatiguePenaltyMilli');
  const parameters = MODEL_B_PARAMETER_REGISTRY.freeThrow;
  const probability =
    parameters.baseMilli +
    coefficientDeltaMilli(shootingMilli - 50_000, parameters.shootingCoefficientMilli, 1) -
    coefficientDeltaMilli(fatiguePenaltyMilli, parameters.fatigueCoefficientMilli, 1);
  return clampFixedPoint(probability, parameters.minimumMilli, parameters.maximumMilli);
}

export function calculateOffensiveReboundProbabilityMilli(
  offensiveExecutionMilli: number,
  defensiveExecutionMilli: number,
): number {
  const parameters = MODEL_B_PARAMETER_REGISTRY.offensiveRebound;
  return clampFixedPoint(
    parameters.baseMilli +
      coefficientDeltaMilli(
        offensiveExecutionMilli - defensiveExecutionMilli,
        parameters.differenceCoefficientNumerator,
        parameters.differenceCoefficientDenominator,
      ),
    parameters.minimumMilli,
    parameters.maximumMilli,
  );
}

export function calculateDefensiveFoulProbabilityMilli(
  input: Readonly<{
    context: 'PRESSURE' | 'JUMP_SHOT' | 'INSIDE';
    offensiveContactMilli: number;
    defensiveControlMilli: number;
    actionMode: 'SAFE' | 'RISKY';
  }>,
): number {
  const parameters = MODEL_B_PARAMETER_REGISTRY.defensiveFoul;
  return clampFixedPoint(
    parameters.baseMilli[input.context] +
      coefficientDeltaMilli(
        input.offensiveContactMilli - input.defensiveControlMilli,
        parameters.differenceCoefficientNumerator,
        parameters.differenceCoefficientDenominator,
      ) +
      parameters.actionRiskMilli[input.actionMode],
    parameters.minimumMilli,
    parameters.maximumMilli,
  );
}

export function calculateOffensiveFoulProbabilityMilli(
  defensiveControlMilli: number,
  offensiveControlMilli: number,
): number {
  const parameters = MODEL_B_PARAMETER_REGISTRY.offensiveFoul;
  return clampFixedPoint(
    parameters.baseMilli +
      coefficientDeltaMilli(
        defensiveControlMilli - offensiveControlMilli,
        parameters.differenceCoefficientMilli,
        1,
      ),
    parameters.minimumMilli,
    parameters.maximumMilli,
  );
}

export function calculateAttributionProbabilityMilli(
  kind: 'STEAL' | 'BLOCK' | 'ASSIST',
  actorExecutionMilli: number,
  opponentExecutionMilli: number,
): number {
  const difference = actorExecutionMilli - opponentExecutionMilli;
  if (kind === 'STEAL') {
    const parameters = MODEL_B_PARAMETER_REGISTRY.attribution.steal;
    return clampFixedPoint(
      parameters.baseMilli + coefficientDeltaMilli(difference, parameters.coefficientMilli, 1),
      parameters.minimumMilli,
      parameters.maximumMilli,
    );
  }
  if (kind === 'BLOCK') {
    const parameters = MODEL_B_PARAMETER_REGISTRY.attribution.block;
    return clampFixedPoint(
      parameters.baseMilli + coefficientDeltaMilli(difference, parameters.coefficientMilli, 1),
      parameters.minimumMilli,
      parameters.maximumMilli,
    );
  }
  const parameters = MODEL_B_PARAMETER_REGISTRY.attribution.assist;
  return clampFixedPoint(
    parameters.baseMilli +
      coefficientDeltaMilli(
        difference,
        parameters.coefficientNumerator,
        parameters.coefficientDenominator,
      ),
    parameters.minimumMilli,
    parameters.maximumMilli,
  );
}

export function calculateCreationProbabilityMilli(
  behaviorId: CreationBehaviorId,
  offensiveExecutionMilli: number,
  defensiveExecutionMilli: number,
): number {
  const parameters = MODEL_B_PARAMETER_REGISTRY.creation[behaviorId];
  return clampFixedPoint(
    parameters.baseMilli +
      coefficientDeltaMilli(
        offensiveExecutionMilli - defensiveExecutionMilli,
        parameters.coefficientMilli,
        1,
      ),
    parameters.minimumMilli,
    parameters.maximumMilli,
  );
}

export type ExecutionBehaviorId = 'SCREEN' | 'CUT' | 'DOUBLECREATE' | 'HELPD' | 'DOUBLET' | 'PRESS';

export function calculateBehaviorExecutionProbabilityMilli(
  behaviorId: ExecutionBehaviorId,
  actorExecutionMilli: number,
  opponentExecutionMilli: number,
): number {
  const parameters = MODEL_B_PARAMETER_REGISTRY.behaviorExecution[behaviorId];
  return clampFixedPoint(
    parameters.baseMilli +
      coefficientDeltaMilli(
        actorExecutionMilli - opponentExecutionMilli,
        parameters.coefficientMilli,
        1,
      ),
    parameters.minimumMilli,
    parameters.maximumMilli,
  );
}
