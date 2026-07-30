import { CONTENT_PACK_HASHES, ENGINE_VERSION, SAVE_SCHEMA_VERSION } from './constants.js';
import { DeterministicRng } from './rng.js';
import {
  GameStateSchema,
  type GameDate,
  type GameState,
  type Player,
  type Position,
} from './schemas.js';

const positions: Position[] = ['PG', 'SG', 'SF', 'PF', 'C'];
const firstNames = [
  '晨',
  '宁',
  '遥',
  '夏',
  '澄',
  '禾',
  '昭',
  '言',
  '岚',
  '月',
  '楠',
  '青',
  '棠',
  '星',
  '雨',
  '安',
  '榆',
  '羽',
  '晴',
  '川',
  '珂',
  '霁',
] as const;
const surnames = ['林', '陈', '周', '许', '方', '唐', '沈', '苏', '顾', '陆', '叶'] as const;

export interface CreateInitialGameOptions {
  rootSeed: string;
  schoolName: string;
  managerName: string;
  teamName?: string;
}

export interface InitialGame {
  state: GameState;
  rng: DeterministicRng;
  contentPackHashes: Readonly<Record<string, string>>;
}

function initialDate(): GameDate {
  return {
    schoolYearIndex: 1,
    term: 1,
    weekOfTerm: 1,
  };
}

function createPlayer(index: number, rng: DeterministicRng): Player {
  const isGuide = index === 0;
  const grade = index >= 18 ? 2 : 1;
  const bestPosition = positions[index % positions.length];
  const swingPosition = positions[(index + 1) % positions.length];
  if (!bestPosition || !swingPosition) throw new Error('Position fixture is incomplete.');

  const base = 42 + rng.nextInt('generated-player', 0, 18);
  const displayName = `${surnames[index % surnames.length]}${firstNames[index % firstNames.length]}`;
  const joinedAt = initialDate();

  return {
    id: `player-p01-${String(index + 1).padStart(2, '0')}`,
    definition: isGuide
      ? {
          kind: 'unique',
          catalogId: 'CHAR_P01_GUIDE_FIXTURE',
        }
      : {
          kind: 'generated',
          snapshot: {
            generationSeed: `${rng.rootSeed}:player:${index}`,
            displayName,
            abilityArchetype:
              bestPosition === 'PG' || bestPosition === 'SG'
                ? 'GUARD'
                : bestPosition === 'C'
                  ? 'CENTER'
                  : bestPosition === 'PF'
                    ? 'FORWARD'
                    : 'WING',
            personalityArchetype: rng.pick('generated-player', [
              'STEADY',
              'DRIVEN',
              'SOCIAL',
              'CAUTIOUS',
            ] as const),
            visualFixtureId: `P01-NON-CANONICAL-${index + 1}`,
          },
        },
    rarity: isGuide ? 4 : index % 5 === 0 ? 3 : 2,
    grade,
    activeStatus: 'ACTIVE',
    positions: {
      best: [bestPosition],
      swing: [swingPosition],
      roleTags: [bestPosition === 'C' ? 'RIM' : bestPosition === 'PG' ? 'CREATOR' : 'UTILITY'],
    },
    attributes: {
      offense: Math.min(100, base + (isGuide ? 12 : rng.nextInt('generated-player', -4, 6))),
      defense: Math.min(100, base + rng.nextInt('generated-player', -5, 7)),
      athleticism: Math.min(100, base + rng.nextInt('generated-player', -4, 8)),
      stamina: Math.min(100, base + rng.nextInt('generated-player', -3, 8)),
    },
    skills: isGuide
      ? [
          {
            skillId: 'SKILL_P01_GUIDE_FIXTURE',
            proficiency: 40,
          },
        ]
      : [],
    condition: {
      fatigue: 0,
      morale: 70,
      focus: 65,
      pressure: 30,
    },
    careerLog: [
      {
        at: joinedAt,
        type: 'JOINED',
        detail: 'P01 fixed lifecycle fixture; not formal recruitment content.',
      },
    ],
    lifecycle: {
      joinedAt,
      expectedGraduationYear: grade === 1 ? 3 : 2,
    },
  };
}

export function createInitialGame(options: CreateInitialGameOptions): InitialGame {
  const rng = new DeterministicRng(options.rootSeed);
  const players = Array.from({ length: 22 }, (_, index) => createPlayer(index, rng));
  const teamId = 'team-primary';
  const schoolId = 'school-primary';

  const state = GameStateSchema.parse({
    schemaVersion: SAVE_SCHEMA_VERSION,
    engineVersion: ENGINE_VERSION,
    revision: 0,
    status: 'ACTIVE',
    school: {
      id: schoolId,
      name: options.schoolName,
      managerName: options.managerName,
      createdYear: 1,
      teamId,
      reputationId: 'reputation-primary',
      budgetId: 'budget-primary',
      facilityIds: [],
      traditionIds: [],
    },
    team: {
      id: teamId,
      schoolId,
      name: options.teamName ?? `${options.schoolName}女子篮球队`,
      activePlayerIds: players.map((player) => player.id),
      rosterLimit: 22,
      registeredRosterIds: [],
      staffIds: [],
      history: {
        wins: 0,
        losses: 0,
        schoolYearsCompleted: 0,
      },
    },
    players,
    season: {
      id: 'season-1',
      schoolYearIndex: 1,
      competitionIds: [],
      objectives: ['P01: complete the deterministic school-year skeleton'],
    },
    currentWeek: {
      id: 'week-1-1-1',
      absoluteWeek: 1,
      schoolYearIndex: 1,
      term: 1,
      weekOfTerm: 1,
      phase: 'TERM_OPERATION',
      availableActions: 1,
      scheduledEventIds: [],
      resolved: false,
    },
    trainingPlan: {
      intensity: 1,
      focus: 'BALANCED',
    },
    budget: {
      id: 'budget-primary',
      balance: 100_000,
      annualGrant: 50_000,
      reserved: 0,
      ledger: [
        {
          sequence: 0,
          schoolYearIndex: 1,
          absoluteWeek: 0,
          amount: 100_000,
          balanceAfter: 100_000,
          reason: 'INITIAL_GRANT',
        },
      ],
    },
    reputation: {
      id: 'reputation-primary',
      competitive: 10,
      recruitmentAppeal: 10,
      basketballInfluence: 5,
    },
    careerArchives: [],
    matchResults: [],
    metrics: {
      resolvedCalendarWeeks: 0,
      resolvedOperationWeeks: 0,
      resolvedExamWeeks: 0,
      completedSchoolYears: 0,
      matches: 0,
    },
  });

  return {
    state,
    rng,
    contentPackHashes: CONTENT_PACK_HASHES,
  };
}
