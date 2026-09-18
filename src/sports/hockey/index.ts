import {
  createDefaultScoreboardState,
  MAX_PERIODS,
} from '@/sports/scoreboardState'
import type { SportModule } from '@/sports/types'

/** UI: ControlsShell + HockeyControls (reglas Worldskate), HockeyScoreBoard, HockeyTvBoard, HockeyOverlayBoard. */

export const HOCKEY_STATE_VERSION = 1

export const hockeySport: SportModule = {
  id: 'hockey',
  label: 'Hockey en línea',
  shortLabel: 'Hockey',
  available: true,
  description: '3 periodos, faltas Worldskate, goles, tiros y nómina con arquero.',
  stateVersion: HOCKEY_STATE_VERSION,
  clock: {
    direction: 'down',
    defaultPeriodTime: '20:00',
    periods: MAX_PERIODS,
    overtimeLabel: 'OT',
    intermissionDefault: '05:00',
  },
  scoringUnit: 'goal',
  features: {
    roster: true,
    shots: true,
    penalties: true,
    intermission: true,
    officials: true,
  },
  periodLabel(period) {
    if (period > MAX_PERIODS) return 'OT'
    return `P${period}`
  },
  createDefaultState(localTeam, visitTeam, timeGame) {
    return createDefaultScoreboardState(
      localTeam,
      visitTeam,
      timeGame ?? '20:00',
      'hockey',
    )
  },
}
