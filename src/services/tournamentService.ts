import type {
  CsvMatchRow,
  CsvPlayerRow,
  Tournament,
  TournamentCourtStream,
  TournamentMatch,
  TournamentRosterPlayer,
} from '@/types/tournament'
import type { RosterPlayer, ScoreboardState } from '@/types/hockeyScoreboard'
import { createDefaultScoreboardState } from '@/types/hockeyScoreboard'
import { generateMatchId } from '@/utils/matchId'
import { generateId } from '@/utils/id'
import { normalizeGameTime } from '@/utils/clock'
import { parseRoleFromText } from '@/utils/roster'
import { parseScheduledAt } from '@/utils/tournamentImport'
import { supabaseRest } from './supabaseRest'
import { createMatch, fetchMatchState, finishMatch } from './matchSync'
import { upsertCourtStream } from './tournamentCourtStream'
import { fetchAssistantTournamentIds } from './tournamentAssistantService'

function normalizeLabel(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase()
}

function playerMatchesCategory(
  playerCategory: string | null,
  matchCategory: string | null,
): boolean {
  const playerCat = normalizeLabel(playerCategory)
  const matchCat = normalizeLabel(matchCategory)
  if (!matchCat) return true
  if (!playerCat) return true
  return playerCat === matchCat
}

export function rosterPlayersForMatch(
  players: TournamentRosterPlayer[],
  teamName: string,
  matchCategory: string | null,
): RosterPlayer[] {
  const team = normalizeLabel(teamName)
  return players
    .filter(
      (player) =>
        normalizeLabel(player.team) === team &&
        playerMatchesCategory(player.category, matchCategory),
    )
    .map((player) => ({
      id: generateId(),
      number: player.number,
      name: player.name,
      lastName: player.last_name ?? '',
      role: parseRoleFromText(player.position),
    }))
}

export async function fetchTournaments(organizerId?: string): Promise<Tournament[]> {
  const filter = organizerId
    ? `organizer_id=eq.${organizerId}`
    : 'visibility=eq.public'
  return supabaseRest<Tournament[]>(
    `tournaments?${filter}&select=*&order=created_at.desc`,
  )
}

export async function fetchManagedTournaments(userId: string): Promise<Tournament[]> {
  const assistantIds = await fetchAssistantTournamentIds(userId)

  const filter = assistantIds.length > 0
    ? `or=(organizer_id.eq.${userId},id.in.(${assistantIds.join(',')}))`
    : `organizer_id=eq.${userId}`

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

/** Cierra partidos en vivo/sin jugar y marca el torneo como finalizado. */
export async function finishTournament(tournamentId: string): Promise<void> {
  const matches = await fetchTournamentMatches(tournamentId)

  for (const tm of matches.filter((m) => m.status === 'live')) {
    if (tm.match_id) {
      const record = await fetchMatchState(tm.match_id)
      const fallback = createDefaultScoreboardState(
        tm.local_team,
        tm.visit_team,
        normalizeGameTime(tm.game_time),
      )
      const state: ScoreboardState = record?.state
        ? {
            ...record.state,
            goalLocal: record.goal_local ?? record.state.goalLocal,
            goalVisit: record.goal_visit ?? record.state.goalVisit,
          }
        : fallback
      await finishTournamentMatch(tm, state)
    } else {
      await supabaseRest(`tournament_matches?id=eq.${tm.id}`, {
        method: 'PATCH',
        body: {
          status: 'finished',
          goal_local: 0,
          goal_visit: 0,
        },
      })
    }
  }

  await supabaseRest(
    `tournament_matches?tournament_id=eq.${tournamentId}&status=eq.scheduled`,
    {
      method: 'PATCH',
      body: {
        status: 'finished',
        goal_local: 0,
        goal_visit: 0,
      },
    },
  )

  await updateTournamentStatus(tournamentId, 'finished')
}

export async function fetchTournamentMatches(
  tournamentId: string,
): Promise<TournamentMatch[]> {
  return supabaseRest<TournamentMatch[]>(
    `tournament_matches?tournament_id=eq.${tournamentId}&select=*&order=sort_order.asc`,
  )
}

export async function clearTournamentCalendar(tournamentId: string): Promise<void> {
  const existing = await fetchTournamentMatches(tournamentId)
  const matchIds = existing
    .map((match) => match.match_id)
    .filter((matchId): matchId is string => Boolean(matchId))

  await supabaseRest(`tournament_court_streams?tournament_id=eq.${tournamentId}`, {
    method: 'DELETE',
  })

  await supabaseRest(`tournament_matches?tournament_id=eq.${tournamentId}`, {
    method: 'DELETE',
  })

  await supabaseRest(`tournament_rosters?tournament_id=eq.${tournamentId}`, {
    method: 'DELETE',
  })

  if (matchIds.length > 0) {
    await supabaseRest(`matches?id=in.(${matchIds.join(',')})`, {
      method: 'DELETE',
    })
  }

  await supabaseRest(`matches?tournament_id=eq.${tournamentId}`, {
    method: 'DELETE',
  })

  await updateTournamentStatus(tournamentId, 'draft')
}

/** Elimina el torneo y todos sus datos asociados. Solo el organizador (RLS). */
export async function deleteTournament(tournamentId: string): Promise<void> {
  await clearTournamentCalendar(tournamentId)
  await supabaseRest(`tournaments?id=eq.${tournamentId}`, {
    method: 'DELETE',
  })
}

export async function fetchTournamentRosters(
  tournamentId: string,
): Promise<TournamentRosterPlayer[]> {
  return supabaseRest<TournamentRosterPlayer[]>(
    `tournament_rosters?tournament_id=eq.${tournamentId}&select=*&order=team.asc,number.asc`,
  )
}

export async function importTournamentCsv(
  tournamentId: string,
  rows: CsvMatchRow[],
  players: CsvPlayerRow[] = [],
): Promise<void> {
  const payload = rows.map((row, index) => ({
    tournament_id: tournamentId,
    local_team: row.local,
    visit_team: row.visita,
    game_time: normalizeGameTime(row.tiempo_juego),
    court: row.cancha,
    category: row.categoria?.trim() || null,
    scheduled_at: parseScheduledAt(
      row.fecha_programada,
      `Calendario fila ${index + 2}`,
    ),
    status: 'scheduled' as const,
    sort_order: index,
  }))

  await supabaseRest('tournament_matches', {
    method: 'POST',
    body: payload,
  })

  if (players.length > 0) {
    const rosterPayload = players.map((player) => ({
      tournament_id: tournamentId,
      team: player.equipo.trim(),
      category: player.categoria?.trim() || null,
      number: player.numero.trim(),
      name: player.nombre.trim(),
      last_name: player.apellido.trim(),
      position: player.posicion?.trim() || null,
    }))

    await supabaseRest('tournament_rosters', {
      method: 'POST',
      body: rosterPayload,
    })
  }
}

export async function createTournamentMatch(
  tournamentId: string,
  input: {
    local_team: string
    visit_team: string
    court: string
    game_time?: string
    category?: string | null
    scheduled_at?: string | null
  },
): Promise<TournamentMatch> {
  const existing = await fetchTournamentMatches(tournamentId)
  const nextOrder =
    existing.reduce((max, match) => Math.max(max, match.sort_order), -1) + 1

  const rows = await supabaseRest<TournamentMatch[]>('tournament_matches', {
    method: 'POST',
    body: {
      tournament_id: tournamentId,
      local_team: input.local_team.trim(),
      visit_team: input.visit_team.trim(),
      game_time: normalizeGameTime(input.game_time || '20:00'),
      court: input.court.trim(),
      category: input.category?.trim() || null,
      scheduled_at: parseScheduledAt(input.scheduled_at ?? undefined),
      status: 'scheduled' as const,
      sort_order: nextOrder,
    },
    prefer: 'return=representation',
  })

  if (!rows[0]) {
    throw new Error('No se pudo crear el partido.')
  }

  return rows[0]
}

export type TournamentMatchInput = {
  local_team: string
  visit_team: string
  court: string
  game_time?: string
  category?: string | null
  scheduled_at?: string | null
}

export async function updateTournamentMatch(
  matchId: string,
  input: TournamentMatchInput,
): Promise<TournamentMatch> {
  const rows = await supabaseRest<TournamentMatch[]>(
    `tournament_matches?id=eq.${matchId}`,
    {
      method: 'PATCH',
      body: {
        local_team: input.local_team.trim(),
        visit_team: input.visit_team.trim(),
        game_time: normalizeGameTime(input.game_time || '20:00'),
        court: input.court.trim(),
        category: input.category?.trim() || null,
        scheduled_at: parseScheduledAt(input.scheduled_at ?? undefined),
      },
      prefer: 'return=representation',
    },
  )

  if (!rows[0]) {
    throw new Error('No se pudo actualizar el partido.')
  }

  return rows[0]
}

export async function deleteTournamentMatch(
  tournamentMatch: TournamentMatch,
): Promise<void> {
  if (tournamentMatch.status === 'live') {
    throw new Error('No se puede eliminar un partido en vivo. Finalízalo primero.')
  }

  await supabaseRest(`tournament_matches?id=eq.${tournamentMatch.id}`, {
    method: 'DELETE',
  })

  if (tournamentMatch.match_id) {
    await supabaseRest(`matches?id=eq.${tournamentMatch.match_id}`, {
      method: 'DELETE',
    })
  }
}

/** Cierra partidos en vivo de la misma cancha (p. ej. si se salió sin finalizar). */
export async function finishLiveMatchesOnCourt(
  tournamentId: string,
  court: string,
  exceptTournamentMatchId?: string,
): Promise<void> {
  const live = await supabaseRest<TournamentMatch[]>(
    `tournament_matches?tournament_id=eq.${tournamentId}&court=eq.${encodeURIComponent(court)}&status=eq.live&select=*`,
  )

  for (const tm of live) {
    if (exceptTournamentMatchId && tm.id === exceptTournamentMatchId) continue

    if (tm.match_id) {
      const record = await fetchMatchState(tm.match_id)
      const fallback = createDefaultScoreboardState(
        tm.local_team,
        tm.visit_team,
        normalizeGameTime(tm.game_time),
      )
      const state: ScoreboardState = record?.state
        ? {
            ...record.state,
            goalLocal: record.goal_local ?? record.state.goalLocal,
            goalVisit: record.goal_visit ?? record.state.goalVisit,
          }
        : fallback
      await finishTournamentMatch(tm, state)
    } else {
      await supabaseRest(`tournament_matches?id=eq.${tm.id}`, {
        method: 'PATCH',
        body: { status: 'finished' },
      })
    }
  }
}

export async function startTournamentMatch(
  tournamentMatch: TournamentMatch,
  organizerId: string,
): Promise<string> {
  const tournament = await fetchTournament(tournamentMatch.tournament_id)
  if (!tournament) {
    throw new Error('Torneo no encontrado.')
  }
  if (tournament.status === 'finished') {
    throw new Error('El torneo ya está finalizado. No se pueden iniciar partidos.')
  }

  await finishLiveMatchesOnCourt(
    tournamentMatch.tournament_id,
    tournamentMatch.court,
    tournamentMatch.id,
  )

  const matchId = generateMatchId()
  const state = createDefaultScoreboardState(
    tournamentMatch.local_team,
    tournamentMatch.visit_team,
    normalizeGameTime(tournamentMatch.game_time),
  )

  try {
    const tournamentPlayers = await fetchTournamentRosters(
      tournamentMatch.tournament_id,
    )
    state.rosterLocal = rosterPlayersForMatch(
      tournamentPlayers,
      tournamentMatch.local_team,
      tournamentMatch.category,
    )
    state.rosterVisit = rosterPlayersForMatch(
      tournamentPlayers,
      tournamentMatch.visit_team,
      tournamentMatch.category,
    )
  } catch {
    // Si falla la carga de plantillas, el partido inicia sin roster importado.
  }

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
  if (!tournamentMatch.match_id) {
    await supabaseRest(`tournament_matches?id=eq.${tournamentMatch.id}`, {
      method: 'PATCH',
      body: {
        status: 'finished',
        goal_local: state.goalLocal,
        goal_visit: state.goalVisit,
      },
    })
    return
  }

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
    timeGame: normalizeGameTime(next.game_time),
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
