export interface TeamPenalty {
  player: string
  time: string
}

export interface ScoreboardState {
  localTeam: string
  visitTeam: string
  goalLocal: number
  goalVisit: number
  gamePeriod: number
  timeGame: string
  penaltiesLocal: TeamPenalty[]
  penaltiesVisit: TeamPenalty[]
  isPaused: boolean
  updatedAt: string
}

export const DEFAULT_GAME_TIME = '20:00'
export const DEFAULT_PENALTY_TIME = '02:00'
export const MAX_PERIODS = 3
export const MAX_PENALTIES_PER_TEAM = 2

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
    penaltiesLocal: [],
    penaltiesVisit: [],
    isPaused: true,
    updatedAt: new Date().toISOString(),
  }
}

/** Migra estados antiguos (penalizedLocal/penaltyGame) al formato actual. */
export function normalizeScoreboardState(raw: unknown): ScoreboardState {
  const source = (raw ?? {}) as Partial<ScoreboardState> & Record<string, unknown>
  const base = createDefaultScoreboardState(
    (source.localTeam as string) ?? 'Local',
    (source.visitTeam as string) ?? 'Visita',
    (source.timeGame as string) ?? DEFAULT_GAME_TIME,
  )

  const merged: ScoreboardState = {
    ...base,
    ...source,
    localTeam: (source.localTeam as string) ?? base.localTeam,
    visitTeam: (source.visitTeam as string) ?? base.visitTeam,
    goalLocal: typeof source.goalLocal === 'number' ? source.goalLocal : base.goalLocal,
    goalVisit: typeof source.goalVisit === 'number' ? source.goalVisit : base.goalVisit,
    gamePeriod: typeof source.gamePeriod === 'number' ? source.gamePeriod : base.gamePeriod,
    timeGame: (source.timeGame as string) ?? base.timeGame,
    isPaused: typeof source.isPaused === 'boolean' ? source.isPaused : base.isPaused,
    updatedAt: (source.updatedAt as string) ?? base.updatedAt,
    penaltiesLocal: [],
    penaltiesVisit: [],
  }

  if (Array.isArray(source.penaltiesLocal)) {
    merged.penaltiesLocal = source.penaltiesLocal
      .slice(0, MAX_PENALTIES_PER_TEAM)
      .map((penalty) => ({
        player: String((penalty as TeamPenalty).player ?? ''),
        time: String((penalty as TeamPenalty).time ?? DEFAULT_PENALTY_TIME),
      }))
  } else if (source.penalizedLocal) {
    merged.penaltiesLocal = [{
      player: '',
      time: String(source.penaltyGame ?? DEFAULT_PENALTY_TIME),
    }]
  }

  if (Array.isArray(source.penaltiesVisit)) {
    merged.penaltiesVisit = source.penaltiesVisit
      .slice(0, MAX_PENALTIES_PER_TEAM)
      .map((penalty) => ({
        player: String((penalty as TeamPenalty).player ?? ''),
        time: String((penalty as TeamPenalty).time ?? DEFAULT_PENALTY_TIME),
      }))
  } else if (source.penalizedVisit) {
    merged.penaltiesVisit = [{
      player: '',
      time: String(source.penaltyGame ?? DEFAULT_PENALTY_TIME),
    }]
  }

  return merged
}
