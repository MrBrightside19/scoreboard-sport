/**
 * @deprecated Preferir imports desde:
 * - `@/types/scoreboard` (núcleo)
 * - `@/sports/scoreboardState` (estado completo)
 * - `@/sports/<deporte>/state` (slice del deporte)
 *
 * Se mantiene como fachada de compatibilidad para no romper imports antiguos.
 */
export type {
  PlayerRole,
  RosterPlayer,
  GoalEvent,
  ScoreboardCore,
} from '@/types/scoreboard'
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

export type { ScoreboardState } from '@/sports/scoreboardState'
export {
  createDefaultScoreboardState,
  normalizeScoreboardState,
} from '@/sports/scoreboardState'
