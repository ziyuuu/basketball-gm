import type {
  ModelBDrawContext,
  ModelBLineup,
  selectModelBBehavior,
} from './behavior-selection.js';
import type { MatchPlayerSnapshot } from './effective-values.js';

const _modelBDefensivePublicSelectionContract = {
  context: {} as ModelBDrawContext,
  behaviorSelectionOrdinal: 0,
  decisionPlayer: {} as MatchPlayerSnapshot,
  legalBehaviorIds: ['HELPD', 'CONTEST'] as const,
  safeFallbackBehaviorId: 'CONTEST' as const,
  currentLineup: {} as ModelBLineup,
  eligibleDefenderIds: [] as readonly string[],
  onBallDefenderId: 'away-pg',
} satisfies Parameters<typeof selectModelBBehavior>[0];

void _modelBDefensivePublicSelectionContract;
