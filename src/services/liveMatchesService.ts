import dayjs from 'dayjs'
import type { LiveMatchSummary, MatchRecord } from '@/types/match'
import type { Tournament, TournamentMatch } from '@/types/tournament'
import { LIVE_WINDOW_HOURS } from '@/config/poll'
import { finishMatch } from './matchSync'
import { supabaseRest } from './supabaseRest'

function toSummary(
  match: MatchRecord,
  tournamentName: string | null = null,
  category: string | null = null,
): LiveMatchSummary {
  return {
    id: match.id,
    title: match.title ?? `${match.state.localTeam} vs ${match.state.visitTeam}`,
    localTeam: match.state.localTeam,
    visitTeam: match.state.visitTeam,
    goalLocal: match.state.goalLocal,
    goalVisit: match.state.goalVisit,
    updatedAt: match.updated_at,
    tournamentId: match.tournament_id,
    tournamentName,
    category,
    court: match.court,
  }
}

async function loadTournamentNames(
  tournamentIds: string[],
): Promise<Map<string, string>> {
  const unique = [...new Set(tournamentIds.filter(Boolean))]
  const names = new Map<string, string>()
  if (!unique.length) return names

  const filter = unique.map((id) => `"${id}"`).join(',')
  const rows = await supabaseRest<Pick<Tournament, 'id' | 'name'>[]>(
    `tournaments?id=in.(${filter})&select=id,name`,
  )
  for (const row of rows) {
    names.set(row.id, row.name)
  }
  return names
}

export async function fetchLiveMatches(): Promise<LiveMatchSummary[]> {
  const cutoff = dayjs().subtract(LIVE_WINDOW_HOURS, 'hour').toISOString()
  const rows = await supabaseRest<MatchRecord[]>(
    `matches?is_live=eq.true&updated_at=gte.${cutoff}&finished_at=is.null&select=*&order=updated_at.desc`,
  )

  const kept: { match: MatchRecord; category: string | null }[] = []
  /** Una sola entrada en vivo por cancha de torneo (la más reciente). */
  const seenCourt = new Set<string>()

  for (const match of rows) {
    let category: string | null = null

    if (match.tournament_id) {
      const linked = await supabaseRest<TournamentMatch[]>(
        `tournament_matches?match_id=eq.${match.id}&select=*&limit=1`,
      )
      const tm = linked[0]
      category = tm?.category?.trim() || null
      // Calendario ya cerrado pero matches.is_live sigue true → sanear y omitir.
      if (tm && tm.status !== 'live') {
        try {
          await finishMatch(match.id, match.state)
        } catch {
          // No bloquear el listado si falla el saneamiento.
        }
        continue
      }

      const courtKey = `${match.tournament_id}::${match.court ?? ''}`
      if (seenCourt.has(courtKey)) {
        // Partido anterior de la misma cancha que quedó sin finalizar.
        try {
          await finishMatch(match.id, match.state)
          if (tm) {
            await supabaseRest(`tournament_matches?id=eq.${tm.id}`, {
              method: 'PATCH',
              body: {
                status: 'finished',
                goal_local: match.goal_local ?? match.state.goalLocal,
                goal_visit: match.goal_visit ?? match.state.goalVisit,
              },
            })
          }
        } catch {
          // No bloquear el listado.
        }
        continue
      }
      seenCourt.add(courtKey)
    }
    kept.push({ match, category })
  }

  const tournamentNames = await loadTournamentNames(
    kept
      .map(({ match }) => match.tournament_id)
      .filter((id): id is string => Boolean(id)),
  )

  return kept.map(({ match, category }) =>
    toSummary(
      match,
      match.tournament_id ? tournamentNames.get(match.tournament_id) ?? null : null,
      category,
    ),
  )
}

export async function setMatchLiveStatus(
  matchId: string,
  isLive: boolean,
): Promise<void> {
  await supabaseRest(`matches?id=eq.${matchId}`, {
    method: 'PATCH',
    body: {
      is_live: isLive,
      updated_at: new Date().toISOString(),
    },
  })
}
