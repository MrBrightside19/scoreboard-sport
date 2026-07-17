export type TournamentVisibility = 'public' | 'private'
export type TournamentStatus = 'draft' | 'active' | 'finished'
export type TournamentMatchStatus = 'scheduled' | 'live' | 'finished'

export interface Tournament {
  id: string
  name: string
  description: string | null
  start_date: string | null
  end_date: string | null
  organizer_id: string
  visibility: TournamentVisibility
  status: TournamentStatus
  sport: string
  created_at: string
}

export interface TournamentMatch {
  id: string
  tournament_id: string
  local_team: string
  visit_team: string
  game_time: string
  court: string
  category: string | null
  scheduled_at: string | null
  status: TournamentMatchStatus
  match_id: string | null
  sort_order: number
  goal_local: number | null
  goal_visit: number | null
}

export interface TournamentCourtStream {
  tournament_id: string
  court: string
  match_id: string | null
}

export interface CsvMatchRow {
  local: string
  visita: string
  tiempo_juego: string
  cancha: string
  categoria?: string
  fecha_programada?: string
}

/** Jugador de plantilla importada (por equipo y categoría del torneo). */
export interface CsvPlayerRow {
  equipo: string
  categoria?: string
  numero: string
  nombre: string
  apellido: string
  posicion?: string
}

export interface TournamentRosterPlayer {
  id: string
  tournament_id: string
  team: string
  category: string | null
  number: string
  name: string
  last_name: string
  position: string | null
  created_at: string
}

export interface TournamentImportPayload {
  matches: CsvMatchRow[]
  players: CsvPlayerRow[]
}

export interface StandingRow {
  team: string
  played: number
  wins: number
  draws: number
  losses: number
  goalsFor: number
  goalsAgainst: number
  goalDiff: number
  points: number
}

export interface TournamentAssistant {
  tournament_id: string
  user_id: string
  email: string
  assigned_by: string
  created_at: string
}

export const MAX_TOURNAMENT_ASSISTANTS = 2
