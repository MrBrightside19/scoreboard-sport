import type { MatchRecord } from '@/types/match'
import type { ScoreboardState } from '@/types/hockeyScoreboard'
import { supabaseRest } from './supabaseRest'

export async function fetchMatchState(matchId: string): Promise<MatchRecord | null> {
  const rows = await supabaseRest<MatchRecord[]>(
    `matches?id=eq.${matchId}&select=*`,
  )
  return rows[0] ?? null
}

export async function publishMatchState(
  matchId: string,
  state: ScoreboardState,
  meta: Partial<Pick<MatchRecord, 'title' | 'organizer_id' | 'is_live' | 'tournament_id' | 'court'>> = {},
): Promise<MatchRecord> {
  const payload = {
    state: {
      ...state,
      updatedAt: new Date().toISOString(),
    },
    updated_at: new Date().toISOString(),
    goal_local: state.goalLocal,
    goal_visit: state.goalVisit,
    ...meta,
  }

  const existing = await fetchMatchState(matchId)
  if (existing) {
    const rows = await supabaseRest<MatchRecord[]>(
      `matches?id=eq.${matchId}`,
      {
        method: 'PATCH',
        body: payload,
        prefer: 'return=representation',
      },
    )
    return rows[0]
  }

  const rows = await supabaseRest<MatchRecord[]>(
    'matches',
    {
      method: 'POST',
      body: {
        id: matchId,
        sport: 'hockey',
        is_live: true,
        title: meta.title ?? `${state.localTeam} vs ${state.visitTeam}`,
        ...payload,
      },
      prefer: 'return=representation',
    },
  )
  return rows[0]
}

export async function createMatch(
  matchId: string,
  state: ScoreboardState,
  organizerId?: string | null,
): Promise<MatchRecord> {
  return publishMatchState(matchId, state, {
    title: `${state.localTeam} vs ${state.visitTeam}`,
    organizer_id: organizerId ?? null,
    is_live: true,
  })
}

export async function finishMatch(matchId: string, state: ScoreboardState): Promise<void> {
  await supabaseRest(`matches?id=eq.${matchId}`, {
    method: 'PATCH',
    body: {
      state,
      is_live: false,
      finished_at: new Date().toISOString(),
      goal_local: state.goalLocal,
      goal_visit: state.goalVisit,
      updated_at: new Date().toISOString(),
    },
  })
}
