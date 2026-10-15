import type { ScoreboardState } from '@/sports/scoreboardState'
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
  tournamentName: string | null
  category: string | null
  court: string | null
}

export interface SavedMatchRecord {
  id: string
  organizer_id: string
  source_match_id: string | null
  sport: SportId
  title: string | null
  local_team: string
  visit_team: string
  goal_local: number
  goal_visit: number
  state: ScoreboardState
  saved_at: string
}

export interface SavedMatchSummary {
  id: string
  title: string
  localTeam: string
  visitTeam: string
  goalLocal: number
  goalVisit: number
  savedAt: string
  sport: SportId
  sportLabel: string
}
