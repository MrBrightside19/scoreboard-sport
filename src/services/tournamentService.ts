import type {
  CsvMatchRow,
  Tournament,
  TournamentCourtStream,
  TournamentMatch,
} from '@/types/tournament'
import type { ScoreboardState } from '@/types/hockeyScoreboard'
import { createDefaultScoreboardState } from '@/types/hockeyScoreboard'
import { generateMatchId } from '@/utils/matchId'
import { supabaseRest } from './supabaseRest'
import { createMatch, finishMatch } from './matchSync'
import { upsertCourtStream } from './tournamentCourtStream'

export async function fetchTournaments(organizerId?: string): Promise<Tournament[]> {
  const filter = organizerId
    ? `organizer_id=eq.${organizerId}`
    : 'visibility=eq.public'
  return supabaseRest<Tournament[]>(
    `tournaments?${filter}&select=*&order=created_at.desc`,
  )
}

export async function fetchPublicTournaments(): Promise<Tournament[]> {
  return supabaseRest<Tournament[]>(
    'tournaments?visibility=eq.public&select=*&order=start_date.desc',
  )
}

export async function fetchTournament(id: string): Promise<Tournament | null> {
  const rows = await supabaseRest<Tournament[]>(`tournaments?id=eq.${id}&select=*`)
  return rows[0] ?? null
}

export async function createTournament(
  payload: Pick<Tournament, 'name' | 'description' | 'start_date' | 'end_date' | 'visibility'>,
  organizerId: string,
): Promise<Tournament> {
  const rows = await supabaseRest<Tournament[]>('tournaments', {
    method: 'POST',
    body: {
      ...payload,
      organizer_id: organizerId,
      status: 'draft',
      sport: 'hockey',
    },
    prefer: 'return=representation',
  })

  if (!rows[0]) {
    throw new Error(
      'El torneo no se guardó. Verifica que iniciaste sesión como organizador.',
    )
  }

  return rows[0]
}

export async function updateTournamentStatus(
  id: string,
  status: Tournament['status'],
): Promise<void> {
  await supabaseRest(`tournaments?id=eq.${id}`, {
    method: 'PATCH',
    body: { status },
  })
}

export async function fetchTournamentMatches(
  tournamentId: string,
): Promise<TournamentMatch[]> {
  return supabaseRest<TournamentMatch[]>(
    `tournament_matches?tournament_id=eq.${tournamentId}&select=*&order=sort_order.asc`,
  )
}

export async function importTournamentCsv(
  tournamentId: string,
  rows: CsvMatchRow[],
): Promise<void> {
  const payload = rows.map((row, index) => ({
    tournament_id: tournamentId,
    local_team: row.local,
    visit_team: row.visita,
    game_time: row.tiempo_juego,
    court: row.cancha,
    scheduled_at: row.fecha_programada
      ? new Date(row.fecha_programada.replace(' ', 'T')).toISOString()
      : null,
    status: 'scheduled' as const,
    sort_order: index,
  }))

  await supabaseRest('tournament_matches', {
    method: 'POST',
    body: payload,
    prefer: 'resolution=merge-duplicates',
  })
}

export async function startTournamentMatch(
  tournamentMatch: TournamentMatch,
  organizerId: string,
): Promise<string> {
  const matchId = generateMatchId()
  const state = createDefaultScoreboardState(
    tournamentMatch.local_team,
    tournamentMatch.visit_team,
    tournamentMatch.game_time,
  )

  await createMatch(matchId, state, organizerId)
  await supabaseRest(`matches?id=eq.${matchId}`, {
    method: 'PATCH',
    body: {
      tournament_id: tournamentMatch.tournament_id,
      court: tournamentMatch.court,
    },
  })

  await supabaseRest(`tournament_matches?id=eq.${tournamentMatch.id}`, {
    method: 'PATCH',
    body: {
      status: 'live',
      match_id: matchId,
    },
  })

  await upsertCourtStream(
    tournamentMatch.tournament_id,
    tournamentMatch.court,
    matchId,
  )

  await updateTournamentStatus(tournamentMatch.tournament_id, 'active')

  return matchId
}

export async function finishTournamentMatch(
  tournamentMatch: TournamentMatch,
  state: ScoreboardState,
): Promise<void> {
  if (!tournamentMatch.match_id) return

  await finishMatch(tournamentMatch.match_id, state)
  await supabaseRest(`tournament_matches?id=eq.${tournamentMatch.id}`, {
    method: 'PATCH',
    body: {
      status: 'finished',
      goal_local: state.goalLocal,
      goal_visit: state.goalVisit,
    },
  })
}

export async function fetchTournamentMatchByMatchId(
  matchId: string,
): Promise<TournamentMatch | null> {
  const rows = await supabaseRest<TournamentMatch[]>(
    `tournament_matches?match_id=eq.${matchId}&select=*&limit=1`,
  )
  return rows[0] ?? null
}

export async function advanceToNextTournamentMatch(
  currentMatchId: string,
  state: ScoreboardState,
  organizerId: string,
): Promise<{
  matchId: string
  localTeam: string
  visitTeam: string
  timeGame: string
  tournamentId: string
  court: string
} | null> {
  const current = await fetchTournamentMatchByMatchId(currentMatchId)
  if (!current) {
    throw new Error('Este partido no pertenece a un torneo.')
  }

  await finishTournamentMatch(current, state)

  const next = await getNextScheduledMatch(current.tournament_id, current.court)
  if (!next) return null

  const newMatchId = await startTournamentMatch(next, organizerId)
  return {
    matchId: newMatchId,
    localTeam: next.local_team,
    visitTeam: next.visit_team,
    timeGame: next.game_time,
    tournamentId: current.tournament_id,
    court: current.court,
  }
}

export async function getNextScheduledMatch(
  tournamentId: string,
  court: string,
): Promise<TournamentMatch | null> {
  const rows = await supabaseRest<TournamentMatch[]>(
    `tournament_matches?tournament_id=eq.${tournamentId}&court=eq.${court}&status=eq.scheduled&select=*&order=sort_order.asc&limit=1`,
  )
  return rows[0] ?? null
}

export async function fetchCourtStreams(
  tournamentId: string,
): Promise<TournamentCourtStream[]> {
  return supabaseRest<TournamentCourtStream[]>(
    `tournament_court_streams?tournament_id=eq.${tournamentId}&select=*`,
  )
}
