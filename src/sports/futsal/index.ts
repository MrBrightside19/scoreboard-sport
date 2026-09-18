import { createDefaultScoreboardState } from '@/sports/scoreboardState'
import type { SportModule } from '@/sports/types'
import {
  FUTSAL_BREAK_TIME,
  FUTSAL_HALF_TIME,
  FUTSAL_PERIODS,
} from '@/sports/futsal/types'

/** UI: ControlsShell + FutsalControls (FIFA), FutsalScoreBoard, FutsalTvBoard, FutsalOverlayBoard. */

export const FUTSAL_STATE_VERSION = 2

export const futsalSport: SportModule = {
  id: 'futsal',
  label: 'Futsal',
  shortLabel: 'Futsal',
  available: true,
  description:
    'FIFA: 2×20′, faltas acumuladas (5), tarjetas, exclusión 2′ y 1 tiempo muerto por tiempo.',
  stateVersion: FUTSAL_STATE_VERSION,
  clock: {
    direction: 'down',
    defaultPeriodTime: FUTSAL_HALF_TIME,
    periods: FUTSAL_PERIODS,
    overtimeLabel: 'Prórroga',
    intermissionDefault: FUTSAL_BREAK_TIME,
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
    if (period > FUTSAL_PERIODS) return `PR${period - FUTSAL_PERIODS}`
    return `${period}T`
  },
  createDefaultState(localTeam, visitTeam, timeGame) {
    const state = createDefaultScoreboardState(
      localTeam,
      visitTeam,
      timeGame ?? FUTSAL_HALF_TIME,
      'futsal',
    )
    state.intermissionDuration = FUTSAL_BREAK_TIME
    state.intermissionTime = FUTSAL_BREAK_TIME
    state.localColor = '#1b9aaa'
    state.visitColor = '#e4572e'
    return state
  },
}

export { FUTSAL_PERIODS } from '@/sports/futsal/types'
