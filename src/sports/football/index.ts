import { createDefaultScoreboardState } from '@/sports/scoreboardState'
import type { SportModule } from '@/sports/types'
import {
  FOOTBALL_BREAK_TIME,
  FOOTBALL_HALF_TIME,
  FOOTBALL_PERIODS,
} from '@/sports/football/types'

/** UI: ControlsShell + FootballControls (layout hockey, reglas FIFA). Live/Overlay = diseño principal. */

export const FOOTBALL_STATE_VERSION = 1

export const footballSport: SportModule = {
  id: 'football',
  label: 'Fútbol',
  shortLabel: 'Fútbol',
  available: true,
  description:
    'FIFA campo: 2×45′, descanso 15′, goles, tarjetas amarilla/roja y nómina.',
  stateVersion: FOOTBALL_STATE_VERSION,
  clock: {
    direction: 'down',
    defaultPeriodTime: FOOTBALL_HALF_TIME,
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
  createDefaultState(localTeam, visitTeam, timeGame) {
    const state = createDefaultScoreboardState(
      localTeam,
      visitTeam,
      timeGame ?? FOOTBALL_HALF_TIME,
      'football',
    )
    state.intermissionDuration = FOOTBALL_BREAK_TIME
    state.intermissionTime = FOOTBALL_BREAK_TIME
    state.localColor = '#0b6e4f'
    state.visitColor = '#c1121f'
    return state
  },
}
