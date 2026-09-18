/**
 * Estado completo del marcador: núcleo + slices por deporte.
 * Las rutas/stores usan esto; cada deporte solo mantiene su `state.ts`.
 */
import { DEFAULT_SPORT, parseSportId, type SportId } from '@/types/sport'
import {
  createScoreboardCore,
  DEFAULT_GAME_TIME,
  normalizeScoreboardCore,
  type ScoreboardCore,
} from '@/types/scoreboard'
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
