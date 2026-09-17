import type { ScoreboardState } from '@/sports/scoreboardState'
import type { SportId } from '@/types/sport'

export interface SportClockConfig {
  direction: 'down' | 'up'
  defaultPeriodTime: string
  periods: number
  overtimeLabel: string
  intermissionDefault: string
}

export interface SportModule {
  id: SportId
  label: string
  shortLabel: string
  available: boolean
  description: string
  stateVersion: number
  clock: SportClockConfig
  scoringUnit: 'goal' | 'point'
  features: {
    roster: boolean
    shots: boolean
    penalties: boolean
    intermission: boolean
    officials: boolean
  }
  periodLabel: (period: number) => string
  createDefaultState: (
    localTeam?: string,
    visitTeam?: string,
    timeGame?: string,
  ) => ScoreboardState
}
