export interface ScoreboardState {
  localTeam: string
  visitTeam: string
  goalLocal: number
  goalVisit: number
  gamePeriod: number
  timeGame: string
  penaltyGame: string
  isPaused: boolean
  penalizedLocal: boolean
  penalizedVisit: boolean
  updatedAt: string
}

export const DEFAULT_GAME_TIME = '20:00'
export const DEFAULT_PENALTY_TIME = '02:00'
export const MAX_PERIODS = 3

export function createDefaultScoreboardState(
  localTeam = 'Local',
  visitTeam = 'Visita',
  timeGame = DEFAULT_GAME_TIME,
): ScoreboardState {
  return {
    localTeam,
    visitTeam,
    goalLocal: 0,
    goalVisit: 0,
    gamePeriod: 1,
    timeGame,
    penaltyGame: DEFAULT_PENALTY_TIME,
    isPaused: true,
    penalizedLocal: false,
    penalizedVisit: false,
    updatedAt: new Date().toISOString(),
  }
}
