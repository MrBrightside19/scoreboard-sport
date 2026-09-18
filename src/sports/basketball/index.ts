import { createDefaultScoreboardState } from '@/sports/scoreboardState'
import type { SportModule } from '@/sports/types'
import {
  BASKETBALL_BREAK_TIME,
  BASKETBALL_PERIODS,
  BASKETBALL_QUARTER_TIME,
} from '@/sports/basketball/types'

/** UI: ControlsShell + BasketballControls (1/2/3, rebotes, faltas), TV y overlay propios. */

export const BASKETBALL_STATE_VERSION = 1

export const basketballSport: SportModule = {
  id: 'basketball',
  label: 'Básquetbol',
  shortLabel: 'Básquet',
  available: true,
  description:
    '4 cuartos FIBA, anotación de 1/2/3, rebotes por jugador y faltas de equipo (bonus).',
  stateVersion: BASKETBALL_STATE_VERSION,
  clock: {
    direction: 'down',
    defaultPeriodTime: BASKETBALL_QUARTER_TIME,
    periods: BASKETBALL_PERIODS,
    overtimeLabel: 'Prórroga',
    intermissionDefault: BASKETBALL_BREAK_TIME,
  },
  scoringUnit: 'point',
  features: {
    roster: true,
    shots: false,
    penalties: false,
    intermission: true,
    officials: true,
  },
  periodLabel(period) {
    if (period > BASKETBALL_PERIODS) return `PR${period - BASKETBALL_PERIODS}`
    return `${period}C`
  },
  createDefaultState(localTeam, visitTeam, timeGame) {
    const state = createDefaultScoreboardState(
      localTeam,
      visitTeam,
      timeGame ?? BASKETBALL_QUARTER_TIME,
      'basketball',
    )
    state.intermissionDuration = BASKETBALL_BREAK_TIME
    state.intermissionTime = BASKETBALL_BREAK_TIME
    state.localColor = '#f77f00'
    state.visitColor = '#003049'
    return state
  },
}
