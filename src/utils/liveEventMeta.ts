import dayjs from 'dayjs'
import {
  fetchTournament,
  fetchTournamentMatchByMatchId,
} from '@/services/tournamentService'
import type { Tournament } from '@/types/tournament'

export function formatLiveEventDate(raw: string | null | undefined): string | null {
  if (!raw) return null
  const parsed = dayjs(raw)
  if (!parsed.isValid()) return null
  return parsed.format('DD/MM/YYYY')
}

export function formatLiveEventDateRange(
  startRaw: string | null | undefined,
  endRaw: string | null | undefined,
): string | null {
  const start = formatLiveEventDate(startRaw)
  const end = formatLiveEventDate(endRaw)
  if (start && end && start !== end) return `${start} — ${end}`
  return start ?? end
}

function metaFromTournament(tournament: Tournament | null): {
  title: string | null
  date: string | null
} {
  if (!tournament) return { title: null, date: null }
  return {
    title: tournament.name,
    date: formatLiveEventDateRange(tournament.start_date, tournament.end_date),
  }
}

export async function loadLiveEventMeta(matchId: string | null, tournamentId?: string | null): Promise<{
  title: string | null
  date: string | null
}> {
  if (matchId) {
    const tournamentMatch = await fetchTournamentMatchByMatchId(matchId)
    if (tournamentMatch) {
      const tournament = await fetchTournament(tournamentMatch.tournament_id)
      return metaFromTournament(tournament)
    }
  }

  if (tournamentId) {
    const tournament = await fetchTournament(tournamentId)
    return metaFromTournament(tournament)
  }

  return { title: null, date: null }
}
