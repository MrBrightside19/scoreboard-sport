import type { ScoreboardState } from './hockeyScoreboard'
import type { SportId } from './sport'

export interface MatchRecord {
  id: string
  state: ScoreboardState
  updated_at: string
  title: string | null
  organizer_id: string | null
  is_live: boolean
  tournament_id: string | null
  court: string | null
  goal_local: number | null
  goal_visit: number | null
  finished_at: string | null
  sport: SportId
}

export interface LiveMatchSummary {
  id: string
  title: string
  localTeam: string
  visitTeam: string
  goalLocal: number
  goalVisit: number
  updatedAt: string
  tournamentId: string | null
  court: string | null
}
