/**
 * Estado completo del marcador: núcleo + slices por deporte.
 * Las rutas/stores usan esto; cada deporte solo mantiene su `state.ts`.
 */
import { DEFAULT_SPORT, parseSportId, type SportId } from '@/types/sport'
import {
  createScoreboardCore,
  DEFAULT_GAME_TIME,
  DEFAULT_INTERMISSION_TIME,
  normalizeScoreboardCore,
  type ScoreboardCore,
} from '@/types/scoreboard'
import { BASKETBALL_QUARTER_TIME } from '@/sports/basketball/types'
import { FOOTBALL_BREAK_TIME } from '@/sports/football/types'
import { FUTSAL_HALF_TIME } from '@/sports/futsal/types'
import {
  createBasketballStateSlice,
  normalizeBasketballStateSlice,
  type BasketballStateSlice,
} from '@/sports/basketball/state'
import {
  createFootballStateSlice,
  normalizeFootballStateSlice,
  type FootballStateSlice,
} from '@/sports/football/state'
import {
  createFutsalStateSlice,
  normalizeFutsalStateSlice,
  type FutsalStateSlice,
} from '@/sports/futsal/state'
import {
  createHockeyStateSlice,
  normalizeHockeyStateSlice,
  type HockeyStateSlice,
} from '@/sports/hockey/state'

export type ScoreboardState = ScoreboardCore &
  HockeyStateSlice &
  BasketballStateSlice &
  FutsalStateSlice &
  FootballStateSlice

export function createDefaultScoreboardState(
  localTeam = 'Local',
  visitTeam = 'Visita',
  timeGame = DEFAULT_GAME_TIME,
  sport: SportId = DEFAULT_SPORT,
): ScoreboardState {
  return {
    ...createScoreboardCore(localTeam, visitTeam, timeGame, sport),
    ...createHockeyStateSlice(),
    ...createBasketballStateSlice(),
    ...createFutsalStateSlice(),
    ...createFootballStateSlice(),
  }
}

function kickoffTimeForSport(sport: SportId): string {
  if (sport === 'football') return '00:00'
  if (sport === 'futsal') return FUTSAL_HALF_TIME
  if (sport === 'basketball') return BASKETBALL_QUARTER_TIME
  return DEFAULT_GAME_TIME
}

function breakTimeForSport(sport: SportId, configured: string): string {
  if (configured) return configured
  if (sport === 'football') return FOOTBALL_BREAK_TIME
  return DEFAULT_INTERMISSION_TIME
}

/** Deja el marcador en 0 para un partido nuevo en la misma mesa. Conserva equipos, logos y nómina. */
export function resetScoreboardPlay(state: ScoreboardState): Partial<ScoreboardState> {
  return {
    goalLocal: 0,
    goalVisit: 0,
    gamePeriod: 1,
    timeGame: kickoffTimeForSport(state.sport),
    goals: [],
    isPaused: true,
    intermissionActive: false,
    intermissionTime: breakTimeForSport(state.sport, state.intermissionDuration),
    matchSaveLocked: false,
    shots: [],
    penaltiesLocal: [],
    penaltiesVisit: [],
    hockeyTimeouts: [],
    hockeyPowerPlayOpportunities: [],
    hockeyPowerPlayGoals: [],
    footballCards: [],
    footballStoppageMinutes: 0,
    futsalAccumulatedFouls: [],
    futsalCards: [],
    futsalExclusions: [],
    futsalTimeouts: [],
    basketballScores: [],
    rebounds: [],
    basketballFouls: [],
  }
}

/** Migra estados antiguos al formato actual (núcleo + slices). */
export function normalizeScoreboardState(raw: unknown): ScoreboardState {
  const source = (raw ?? {}) as Partial<ScoreboardState> & Record<string, unknown>
  const sport = parseSportId(source.sport)
  const base = createDefaultScoreboardState(
    (source.localTeam as string) ?? 'Local',
    (source.visitTeam as string) ?? 'Visita',
    (source.timeGame as string) ?? DEFAULT_GAME_TIME,
    sport,
  )

  return {
    ...normalizeScoreboardCore(source, base),
    ...normalizeHockeyStateSlice(source),
    ...normalizeBasketballStateSlice(source),
    ...normalizeFutsalStateSlice(source),
    ...normalizeFootballStateSlice(source),
  }
}

export type { ScoreboardCore, GoalEvent, RosterPlayer, PlayerRole } from '@/types/scoreboard'
export {
  isGoalPending,
  DEFAULT_GAME_TIME,
  DEFAULT_INTERMISSION_TIME,
  DEFAULT_LOCAL_COLOR,
  DEFAULT_VISIT_COLOR,
} from '@/types/scoreboard'
export type { TeamPenalty, ShotEvent, ShotResult } from '@/sports/hockey/state'
export {
  DEFAULT_PENALTY_TYPE_ID,
  MAX_PERIODS,
  MAX_PENALTIES_PER_TEAM,
} from '@/sports/hockey/state'
