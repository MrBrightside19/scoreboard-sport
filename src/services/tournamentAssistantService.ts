import type { Profile } from '@/types/auth'
import { MAX_TOURNAMENT_ASSISTANTS, type TournamentAssistant } from '@/types/tournament'
import { supabaseRest } from './supabaseRest'

export async function findProfileByEmail(email: string): Promise<Profile | null> {
  const normalized = email.trim().toLowerCase()
  if (!normalized) return null

  const rows = await supabaseRest<Profile[]>(
    `profiles?email=ilike.${encodeURIComponent(normalized)}&select=*&limit=1`,
  )
  return rows[0] ?? null
}

export async function fetchTournamentAssistants(
  tournamentId: string,
): Promise<TournamentAssistant[]> {
  return supabaseRest<TournamentAssistant[]>(
    `tournament_assistants?tournament_id=eq.${tournamentId}&select=*&order=created_at.asc`,
  )
}

export async function fetchAssistantTournamentIds(userId: string): Promise<string[]> {
  const rows = await supabaseRest<{ tournament_id: string }[]>(
    `tournament_assistants?user_id=eq.${userId}&select=tournament_id`,
  )
  return rows.map((row) => row.tournament_id)
}

export async function assignTournamentAssistant(
  tournamentId: string,
  email: string,
  assignedBy: string,
  organizerId: string,
): Promise<TournamentAssistant> {
  if (assignedBy !== organizerId) {
    throw new Error('Solo el organizador puede asignar asistentes.')
  }

  const profile = await findProfileByEmail(email)
  if (!profile) {
    throw new Error('No hay ninguna cuenta registrada con ese correo.')
  }

  if (profile.id === organizerId) {
    throw new Error('El organizador del torneo no puede ser asistente.')
  }

  const current = await fetchTournamentAssistants(tournamentId)
  if (current.length >= MAX_TOURNAMENT_ASSISTANTS) {
    throw new Error(`Este torneo ya tiene ${MAX_TOURNAMENT_ASSISTANTS} asistentes asignados.`)
  }

  if (current.some((assistant) => assistant.user_id === profile.id)) {
    throw new Error('Esa persona ya es asistente de este torneo.')
  }

  const rows = await supabaseRest<TournamentAssistant[]>(
    'tournament_assistants',
    {
      method: 'POST',
      body: {
        tournament_id: tournamentId,
        user_id: profile.id,
        email: profile.email,
        assigned_by: assignedBy,
      },
      prefer: 'return=representation',
    },
  )

  if (!rows[0]) {
    throw new Error('No se pudo asignar el asistente.')
  }

  return rows[0]
}

export async function removeTournamentAssistant(
  tournamentId: string,
  userId: string,
): Promise<void> {
  await supabaseRest(
    `tournament_assistants?tournament_id=eq.${tournamentId}&user_id=eq.${userId}`,
    { method: 'DELETE' },
  )
}

export async function canAccessTournament(
  tournamentId: string,
  userId: string,
  organizerId: string,
): Promise<boolean> {
  if (organizerId === userId) return true
  const assistants = await fetchTournamentAssistants(tournamentId)
  return assistants.some((assistant) => assistant.user_id === userId)
}
