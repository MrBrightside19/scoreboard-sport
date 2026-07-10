import type { TournamentCourtStream } from '@/types/tournament'
import { supabaseRest } from './supabaseRest'

export async function fetchCourtStream(
  tournamentId: string,
  court: string,
): Promise<TournamentCourtStream | null> {
  const rows = await supabaseRest<TournamentCourtStream[]>(
    `tournament_court_streams?tournament_id=eq.${tournamentId}&court=eq.${court}&select=*`,
  )
  return rows[0] ?? null
}

export async function upsertCourtStream(
  tournamentId: string,
  court: string,
  matchId: string,
): Promise<TournamentCourtStream> {
  const rows = await supabaseRest<TournamentCourtStream[]>(
    'tournament_court_streams',
    {
      method: 'POST',
      body: {
        tournament_id: tournamentId,
        court,
        match_id: matchId,
      },
      prefer: 'resolution=merge-duplicates,return=representation',
    },
  )
  return rows[0]
}
