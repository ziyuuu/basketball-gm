import {
  GENESIS_MATCH_ANCHOR_HASH,
  MatchInputSchema,
  MODEL_B_RULES_CONTENT_HASH,
  MODEL_B_RULES_VERSION,
  deriveGameId,
  deriveMatchId,
  deriveMatchInputHash,
  type MatchInput,
  type ModelBMatchInput,
  type PhysicalMatchPlayerSnapshotV1,
} from '../../packages/domain/src/match/index.js';

type MatchKind = MatchInput['matchKind'];
type MatchPlayer = PhysicalMatchPlayerSnapshotV1;

function makePlayer(playerId: string, index: number, rating = 50): MatchPlayer {
  const positions = ['PG', 'SG', 'SF', 'PF', 'C'] as const;
  const primaryPosition = positions[index % positions.length]!;
  const secondaryPosition = positions[(index + 1) % positions.length]!;
  return {
    snapshotVersion: 'P02_MATCH_PLAYER_PHYSICAL_V1',
    playerId,
    primaryPosition,
    secondaryPosition,
    abilityProfile: {
      version: 'P02_CORE_11_V1',
      values: {
        finishing: rating,
        shooting: rating,
        ballHandling: rating,
        playmaking: rating,
        perimeterDefense: rating,
        interiorDefense: rating,
        rebounding: rating,
        athleticism: rating,
        stamina: rating,
        tacticalUnderstanding: rating,
        strength: rating,
      },
    },
    physicalProfile: {
      version: 'HEIGHT_WINGSPAN_CM_V1',
      heightCm: 178,
      wingspanCm: 184,
    },
    tendencies: {
      possessionParticipation: 50,
      passSelection: 50,
      shotZones: { perimeter: 34, midRange: 33, inside: 33 },
      transitionParticipation: 50,
      defensiveRisk: 50,
      offensiveRebounding: 50,
    },
    archetypeTrait: null,
    fatigueMilli: 0,
    chemistryMilli: 50_000,
  };
}

function makeTeam(
  teamId: string,
  playerPrefix: string,
  rosterSize: 12,
  rating = 50,
  playerIds?: readonly string[],
) {
  const players = Array.from({ length: rosterSize }, (_, index) =>
    makePlayer(
      playerIds?.[index] ?? `${playerPrefix}-${String(index + 1).padStart(2, '0')}`,
      index,
      rating,
    ),
  );
  return {
    teamId,
    registeredRosterIds: players.map(({ playerId }) => playerId),
    players,
    startingLineup: {
      PG: players[0]!.playerId,
      SG: players[1]!.playerId,
      SF: players[2]!.playerId,
      PF: players[3]!.playerId,
      C: players[4]!.playerId,
    },
    roles: {
      primaryOrganizer: players[0]!.playerId,
      offensiveHub: players[1]!.playerId,
      defensiveCaptain: players[4]!.playerId,
    },
    tactics: {
      pace: 'BALANCED' as const,
      offensiveFocus: 'BALANCED' as const,
      defensiveFocus: 'BALANCED' as const,
    },
    rotationPreset: 'BALANCED' as const,
  };
}

export function makeP02MatchInput(
  options: Readonly<{
    matchKind?: MatchKind;
    rootSeed?: string;
    matchSeed?: readonly [number, number, number, number];
    homeRating?: number;
    awayRating?: number;
    homePlayerIds?: readonly string[];
  }> = {},
): ModelBMatchInput {
  const matchKind = options.matchKind ?? 'OFFICIAL';
  const gameIdentity = {
    rootSeed: options.rootSeed ?? 'p02-003-test-root',
    newGameDescriptor: { fixture: 'p02-003' },
    rulesVersion: MODEL_B_RULES_VERSION,
    contentHashes: { modelB: MODEL_B_RULES_CONTENT_HASH },
  };
  const gameId = deriveGameId(gameIdentity);
  const classification =
    matchKind === 'OFFICIAL'
      ? { matchKind, recordScope: 'OFFICIAL_CAREER' as const }
      : matchKind === 'FRIENDLY'
        ? { matchKind, recordScope: 'FRIENDLY_ARCHIVE' as const }
        : { matchKind, recordScope: 'SCRIMMAGE_OBSERVATION' as const };
  const identity = {
    gameIdentity,
    gameId,
    matchId: GENESIS_MATCH_ANCHOR_HASH,
    absoluteWeek: 1,
    slotIdentity: `fixture-${matchKind.toLowerCase()}`,
    rules: {
      regularPeriodSeconds: 600 as const,
      overtimePeriodSeconds: 300 as const,
      foulOutLimit: 5 as const,
    },
    matchSeed: [...(options.matchSeed ?? [1, 2, 3, 4])] as [number, number, number, number],
    controlStrategy: 'INSTANT' as const,
    matchInputHash: GENESIS_MATCH_ANCHOR_HASH,
    ...classification,
  };
  const base =
    matchKind === 'SCRIMMAGE'
      ? (() => {
          const sourcePlayers = Array.from({ length: 12 }, (_, index) =>
            makePlayer(
              `SCRIMMAGE-${String(index + 1).padStart(2, '0')}`,
              index,
              options.homeRating ?? 50,
            ),
          );
          const home = makeTeam('SCRIMMAGE-TEAM', 'unused-home', 6);
          const away = makeTeam('SCRIMMAGE-TEAM', 'unused-away', 6);
          home.players = sourcePlayers.slice(0, 6);
          home.registeredRosterIds = home.players.map(({ playerId }) => playerId);
          home.startingLineup = {
            PG: home.players[0]!.playerId,
            SG: home.players[1]!.playerId,
            SF: home.players[2]!.playerId,
            PF: home.players[3]!.playerId,
            C: home.players[4]!.playerId,
          };
          home.roles = {
            primaryOrganizer: home.players[0]!.playerId,
            offensiveHub: home.players[1]!.playerId,
            defensiveCaptain: home.players[4]!.playerId,
          };
          away.players = sourcePlayers.slice(6);
          away.registeredRosterIds = away.players.map(({ playerId }) => playerId);
          away.startingLineup = {
            PG: away.players.find((p) => p.primaryPosition === 'PG')!.playerId,
            SG: away.players.find((p) => p.primaryPosition === 'SG')!.playerId,
            SF: away.players.find((p) => p.primaryPosition === 'SF')!.playerId,
            PF: away.players.find((p) => p.primaryPosition === 'PF')!.playerId,
            C: away.players.find((p) => p.primaryPosition === 'C')!.playerId,
          };
          away.roles = {
            primaryOrganizer: away.players[0]!.playerId,
            offensiveHub: away.players[1]!.playerId,
            defensiveCaptain: away.players[4]!.playerId,
          };
          return {
            ...identity,
            sourceTeamId: 'SCRIMMAGE-TEAM',
            sourceRosterIds: sourcePlayers.map(({ playerId }) => playerId),
            homeTeam: home,
            awayTeam: away,
          };
        })()
      : {
          ...identity,
          homeTeam: makeTeam(
            'HOME-TEAM',
            'HOME',
            12,
            options.homeRating ?? 50,
            options.homePlayerIds,
          ),
          awayTeam: makeTeam('AWAY-TEAM', 'AWAY', 12, options.awayRating ?? 50),
        };
  const matchId = deriveMatchId(base as MatchInput);
  const withMatchId = { ...base, matchId } as MatchInput;
  const input = { ...withMatchId, matchInputHash: deriveMatchInputHash(withMatchId) } as MatchInput;
  return MatchInputSchema.parse(input) as ModelBMatchInput;
}
