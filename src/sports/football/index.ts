import { createDefaultScoreboardState } from '@/sports/scoreboardState'
import type { SportModule } from '@/sports/types'
import { normalizeFootballPeriodLength } from '@/sports/football/state'
import {
  FOOTBALL_BREAK_TIME,
  FOOTBALL_HALF_TIME,
  FOOTBALL_PERIODS,
  FOOTBALL_EXTRA_TIME,
} from '@/sports/football/types'

/** UI: ControlsShell + FootballControls (layout hockey, reglas FIFA). Live/Overlay = diseño principal. */

export const FOOTBALL_STATE_VERSION = 4

export const footballSport: SportModule = {
  id: 'football',
  label: 'Fútbol',
  shortLabel: 'Fútbol',
  available: true,
  description:
    'FIFA campo: reloj desde 00:00, duración por periodo configurable, descanso 15′, goles, tarjetas y nómina.',
  stateVersion: FOOTBALL_STATE_VERSION,
  clock: {
    direction: 'up',
    defaultPeriodTime: FOOTBALL_HALF_TIME,
    overtimePeriodTime: FOOTBALL_EXTRA_TIME,
    periods: FOOTBALL_PERIODS,
    overtimeLabel: 'Prórroga',
    intermissionDefault: FOOTBALL_BREAK_TIME,
  },
  scoringUnit: 'goal',
  features: {
    roster: true,
    shots: false,
    penalties: false,
    intermission: true,
    officials: true,
  },
  periodLabel(period) {
    if (period > FOOTBALL_PERIODS) {
      const et = period - FOOTBALL_PERIODS
      return `PR${et}`
    }
    return `${period}T`
  },
  createDefaultState(localTeam, visitTeam, periodLength) {
    const state = createDefaultScoreboardState(
      localTeam,
      visitTeam,
      '00:00',
      'football',
    )
    state.footballPeriodLength = normalizeFootballPeriodLength(
      periodLength ?? FOOTBALL_HALF_TIME,
    )
    state.intermissionDuration = FOOTBALL_BREAK_TIME
    state.intermissionTime = FOOTBALL_BREAK_TIME
    state.localColor = '#0b6e4f'
    state.visitColor = '#c1121f'
    return state
  },
}
