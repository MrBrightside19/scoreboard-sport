import type {
  CsvMatchRow,
  CsvPlayerRow,
  Tournament,
  TournamentCourtStream,
  TournamentMatch,
  TournamentRosterPlayer,
  TournamentTeam,
} from '@/types/tournament'
import {
  DEFAULT_TEAM_COLOR_LOCAL,
  DEFAULT_TEAM_COLOR_VISIT,
  TEAM_COLOR_PALETTE,
} from '@/types/tournament'
import type { RosterPlayer, ScoreboardState } from '@/types/hockeyScoreboard'
import { createDefaultScoreboardState } from '@/types/hockeyScoreboard'
import { generateMatchId } from '@/utils/matchId'
import { generateId } from '@/utils/id'
import { normalizeGameTime } from '@/utils/clock'
import { parseRoleFromText, joinPersonName, roleToPositionText } from '@/utils/roster'
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
      name: joinPersonName(player.name, player.last_name),
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

export async function updateTournamentVisibility(
  id: string,
  visibility: Tournament['visibility'],
): Promise<Tournament> {
  const rows = await supabaseRest<Tournament[]>(`tournaments?id=eq.${id}`, {
    method: 'PATCH',
    body: { visibility },
    prefer: 'return=representation',
  })

  if (!rows[0]) {
    throw new Error('No se pudo actualizar la visibilidad del torneo.')
  }

  return rows[0]
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

  await supabaseRest(`tournament_teams?tournament_id=eq.${tournamentId}`, {
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

export async function fetchTournamentTeams(
  tournamentId: string,
): Promise<TournamentTeam[]> {
  return supabaseRest<TournamentTeam[]>(
    `tournament_teams?tournament_id=eq.${tournamentId}&select=*&order=team.asc`,
  )
}

export function findTournamentTeam(
  teams: TournamentTeam[],
  teamName: string,
): TournamentTeam | undefined {
  const key = normalizeLabel(teamName)
  return teams.find((item) => normalizeLabel(item.team) === key)
}

/** Crea filas de equipos a partir del calendario y plantillas, sin pisar color/logo existentes. */
export async function syncTournamentTeams(
  tournamentId: string,
): Promise<TournamentTeam[]> {
  const [matches, rosters, existing] = await Promise.all([
    fetchTournamentMatches(tournamentId),
    fetchTournamentRosters(tournamentId),
    fetchTournamentTeams(tournamentId),
  ])

  const names = new Map<string, string>()
  for (const match of matches) {
    const local = match.local_team.trim()
    const visit = match.visit_team.trim()
    if (local) names.set(normalizeLabel(local), local)
    if (visit) names.set(normalizeLabel(visit), visit)
  }
  for (const player of rosters) {
    const team = player.team.trim()
    if (team) names.set(normalizeLabel(team), team)
  }

  const existingByKey = new Map(
    existing.map((team) => [normalizeLabel(team.team), team] as const),
  )

  const missing = [...names.entries()].filter(([key]) => !existingByKey.has(key))
  if (missing.length > 0) {
    const payload = missing.map(([, team], index) => ({
      tournament_id: tournamentId,
      team,
      color: TEAM_COLOR_PALETTE[(existing.length + index) % TEAM_COLOR_PALETTE.length],
      logo_url: '',
    }))
    await supabaseRest('tournament_teams', {
      method: 'POST',
      body: payload,
    })
  }

  return fetchTournamentTeams(tournamentId)
}

export async function updateTournamentTeam(
  teamId: string,
  input: { color?: string; logo_url?: string; team?: string },
): Promise<TournamentTeam> {
  const body: Record<string, string> = {}
  if (input.color !== undefined) body.color = input.color.trim() || DEFAULT_TEAM_COLOR_LOCAL
  if (input.logo_url !== undefined) body.logo_url = input.logo_url.trim()
  if (input.team !== undefined) body.team = input.team.trim()

  const rows = await supabaseRest<TournamentTeam[]>(
    `tournament_teams?id=eq.${teamId}`,
    {
      method: 'PATCH',
      body,
      prefer: 'return=representation',
    },
  )

  if (!rows[0]) {
    throw new Error('No se pudo actualizar el equipo.')
  }

  return rows[0]
}

export type TournamentRosterInput = {
  number?: string
  name?: string
  category?: string | null
  position?: string | null
}

export async function updateTournamentRosterPlayer(
  playerId: string,
  input: TournamentRosterInput,
): Promise<TournamentRosterPlayer> {
  const body: Record<string, string | null> = {}
  if (input.number !== undefined) body.number = input.number.trim()
  if (input.name !== undefined) {
    body.name = input.name.trim()
    body.last_name = ''
  }
  if (input.category !== undefined) body.category = input.category?.trim() || null
  if (input.position !== undefined) body.position = input.position?.trim() || null

  const rows = await supabaseRest<TournamentRosterPlayer[]>(
    `tournament_rosters?id=eq.${playerId}`,
    {
      method: 'PATCH',
      body,
      prefer: 'return=representation',
    },
  )

  if (!rows[0]) {
    throw new Error('No se pudo actualizar el jugador.')
  }

  return rows[0]
}

/**
 * Filas de nómina del torneo que corresponden al equipo/categoría del partido actual.
 * Misma regla que al cargar la nómina en un partido nuevo.
 */
function rosterRowsForMatchScope(
  players: TournamentRosterPlayer[],
  teamName: string,
  matchCategory: string | null,
): TournamentRosterPlayer[] {
  const team = normalizeLabel(teamName)
  return players.filter(
    (player) =>
      normalizeLabel(player.team) === team &&
      playerMatchesCategory(player.category, matchCategory),
  )
}

function mergeRosterPlayers(
  primary: RosterPlayer[],
  secondary: RosterPlayer[],
): RosterPlayer[] {
  const byNumber = new Map<string, RosterPlayer>()
  for (const player of [...secondary, ...primary]) {
    const number = player.number.trim()
    if (!number) continue
    byNumber.set(number, player)
  }
  return [...byNumber.values()]
}

/** Serializa syncs del mismo torneo para evitar choques de unique index. */
const rosterSyncChain = new Map<string, Promise<void>>()

function enqueueTournamentRosterSync(
  tournamentId: string,
  task: () => Promise<void>,
): Promise<void> {
  const previous = rosterSyncChain.get(tournamentId) ?? Promise.resolve()
  const next = previous.catch(() => undefined).then(task)
  rosterSyncChain.set(
    tournamentId,
    next.then(() => undefined).catch(() => undefined),
  )
  return next
}

/**
 * Reemplaza en el torneo la nómina de un equipo (misma categoría del partido)
 * con los jugadores actuales del marcador. Así los próximos partidos heredan
 * correcciones, altas y bajas hechas desde Controles.
 */
export async function syncMatchRosterToTournament(
  tournamentId: string,
  teamName: string,
  matchCategory: string | null | undefined,
  players: RosterPlayer[],
): Promise<void> {
  const team = teamName.trim()
  if (!tournamentId || !team) return

  const category = matchCategory?.trim() || null

  const seenNumbers = new Set<string>()
  const desired: Array<{
    number: string
    name: string
    position: string
  }> = []

  for (const player of players) {
    const number = player.number.trim()
    if (!number || seenNumbers.has(number)) continue
    seenNumbers.add(number)
    desired.push({
      number,
      name: player.name.trim(),
      position: roleToPositionText(player.role),
    })
  }

  const existing = await fetchTournamentRosters(tournamentId)
  const scoped = rosterRowsForMatchScope(existing, team, category)

  /** Por dorsal, preferir la fila de la categoría exacta del partido. */
  const preferredByNumber = new Map<string, TournamentRosterPlayer>()
  for (const row of scoped) {
    const number = row.number.trim()
    if (!number) continue
    const current = preferredByNumber.get(number)
    if (!current) {
      preferredByNumber.set(number, row)
      continue
    }
    const rowExact = normalizeLabel(row.category) === normalizeLabel(category)
    const currentExact = normalizeLabel(current.category) === normalizeLabel(category)
    if (rowExact && !currentExact) preferredByNumber.set(number, row)
  }

  const keptIds = new Set<string>()
  const toInsert: Array<{
    tournament_id: string
    team: string
    category: string | null
    number: string
    name: string
    last_name: string
    position: string
  }> = []
  const toUpdate: Array<{
    id: string
    number: string
    name: string
    position: string
  }> = []

  for (const player of desired) {
    const current = preferredByNumber.get(player.number)
    if (current) {
      keptIds.add(current.id)
      const needsUpdate =
        current.name !== player.name ||
        (current.last_name ?? '') !== '' ||
        (current.position ?? '') !== player.position ||
        normalizeLabel(current.team) !== normalizeLabel(team) ||
        normalizeLabel(current.category) !== normalizeLabel(category)

      if (needsUpdate) {
        toUpdate.push({
          id: current.id,
          number: player.number,
          name: player.name,
          position: player.position,
        })
      }
      continue
    }

    toInsert.push({
      tournament_id: tournamentId,
      team,
      category,
      number: player.number,
      name: player.name,
      last_name: '',
      position: player.position,
    })
  }

  // Borrar primero (incluye duplicados vacío/categoría) para no chocar el unique index.
  const toRemove = scoped.filter((row) => !keptIds.has(row.id))
  if (toRemove.length > 0) {
    const ids = toRemove.map((row) => row.id).join(',')
    await supabaseRest(`tournament_rosters?id=in.(${ids})`, {
      method: 'DELETE',
    })
  }

  for (const row of toUpdate) {
    await supabaseRest(`tournament_rosters?id=eq.${row.id}`, {
      method: 'PATCH',
      body: {
        team,
        category,
        number: row.number,
        name: row.name,
        last_name: '',
        position: row.position,
      },
    })
  }

  if (toInsert.length > 0) {
    await supabaseRest('tournament_rosters', {
      method: 'POST',
      body: toInsert,
    })
  }
}

export async function syncBothMatchRostersToTournament(
  tournamentId: string,
  matchCategory: string | null | undefined,
  localTeam: string,
  visitTeam: string,
  rosterLocal: RosterPlayer[],
  rosterVisit: RosterPlayer[],
): Promise<void> {
  return enqueueTournamentRosterSync(tournamentId, async () => {
    const local = localTeam.trim()
    const visit = visitTeam.trim()

    // Mismo nombre en ambos lados: una sola escritura (si no, el 2º insert choca).
    if (local && normalizeLabel(local) === normalizeLabel(visit)) {
      await syncMatchRosterToTournament(
        tournamentId,
        local,
        matchCategory,
        mergeRosterPlayers(rosterLocal, rosterVisit),
      )
      return
    }

    await syncMatchRosterToTournament(
      tournamentId,
      local,
      matchCategory,
      rosterLocal,
    )
    await syncMatchRosterToTournament(
      tournamentId,
      visit,
      matchCategory,
      rosterVisit,
    )
  })
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
      last_name: '',
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
  state.matchCategory = tournamentMatch.category?.trim() || ''

  try {
    const [tournamentPlayers, tournamentTeams] = await Promise.all([
      fetchTournamentRosters(tournamentMatch.tournament_id),
      fetchTournamentTeams(tournamentMatch.tournament_id),
    ])
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

    const localMeta = findTournamentTeam(tournamentTeams, tournamentMatch.local_team)
    const visitMeta = findTournamentTeam(tournamentTeams, tournamentMatch.visit_team)
    state.localLogo = localMeta?.logo_url ?? ''
    state.visitLogo = visitMeta?.logo_url ?? ''
    state.localColor = localMeta?.color || DEFAULT_TEAM_COLOR_LOCAL
    state.visitColor = visitMeta?.color || DEFAULT_TEAM_COLOR_VISIT
  } catch {
    // Si falla la carga de plantillas/equipos, el partido inicia sin ellos.
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
  // Persistir plantilla del partido en el torneo antes de cerrar,
  // para que el siguiente partido herede altas/bajas/correcciones.
  await syncBothMatchRostersToTournament(
    tournamentMatch.tournament_id,
    state.matchCategory || tournamentMatch.category,
    state.localTeam || tournamentMatch.local_team,
    state.visitTeam || tournamentMatch.visit_team,
    state.rosterLocal,
    state.rosterVisit,
  )

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
