import type { Profile } from '@/types/auth'
import { isSupabaseConfigured } from '@/services/supabaseClient'
import { getSupabaseClient } from '@/services/supabaseClient'
import { supabaseRest } from '@/services/supabaseRest'
import {
  cacheSavedTeamLogos,
  clearSavedTeamLogosCache,
  getSavedTeamLogos,
  type SavedTeamLogo,
} from '@/utils/userPreferences'

function isMissingColumn(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error)
  return (
    message.includes('saved_team_logos') ||
    message.includes('42703') ||
    message.includes('pgrst204')
  )
}

export async function persistSavedTeamLogos(): Promise<void> {
  if (!isSupabaseConfigured) return
  try {
    const supabase = getSupabaseClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session?.user) return
    await supabaseRest(`profiles?id=eq.${session.user.id}`, {
      method: 'PATCH',
      body: { saved_team_logos: getSavedTeamLogos() },
    })
  } catch (error) {
    if (isMissingColumn(error)) return
    console.warn('No se pudieron sincronizar los logos de equipo', error)
  }
}

export async function hydrateSavedTeamLogosFromProfile(
  profile: Profile | null,
): Promise<void> {
  if (!profile) {
    clearSavedTeamLogosCache()
    return
  }
  const incoming = profile.saved_team_logos
  if (Array.isArray(incoming) && incoming.length > 0) {
    cacheSavedTeamLogos(incoming)
    return
  }
  if (getSavedTeamLogos().length > 0) {
    await persistSavedTeamLogos()
  }
}

export type { SavedTeamLogo }
