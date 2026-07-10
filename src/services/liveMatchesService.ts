import dayjs from 'dayjs'
import type { LiveMatchSummary, MatchRecord } from '@/types/match'
import { LIVE_WINDOW_HOURS } from '@/config/poll'
import { supabaseRest } from './supabaseRest'

function toSummary(match: MatchRecord): LiveMatchSummary {
  return {
    id: match.id,
    title: match.title ?? `${match.state.localTeam} vs ${match.state.visitTeam}`,
    localTeam: match.state.localTeam,
    visitTeam: match.state.visitTeam,
    goalLocal: match.state.goalLocal,
    goalVisit: match.state.goalVisit,
    updatedAt: match.updated_at,
    tournamentId: match.tournament_id,
    court: match.court,
  }
}

export async function fetchLiveMatches(): Promise<LiveMatchSummary[]> {
  const cutoff = dayjs().subtract(LIVE_WINDOW_HOURS, 'hour').toISOString()
  const rows = await supabaseRest<MatchRecord[]>(
    `matches?is_live=eq.true&updated_at=gte.${cutoff}&finished_at=is.null&select=*&order=updated_at.desc`,
  )
  return rows.map(toSummary)
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
