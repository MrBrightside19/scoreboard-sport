import { createMatch, fetchActiveFreeMatch, fetchMatchState } from '@/services/matchSync'
import { isSupabaseConfigured } from '@/services/supabaseClient'
import { getSportModule } from '@/sports/registry'
import { EntitlementError } from '@/types/billing'
import { parseSportId, type SportId } from '@/types/sport'
import { generateMatchId } from '@/utils/matchId'
import { getStorageKey, readMatchIdFromStorage } from '@/utils/localSync'

/** Crea un partido libre o reanuda el que ya está en vivo del mismo deporte. */
export async function createOrResumeFreeMatch(
  sportId: SportId,
  organizerId?: string | null,
): Promise<string> {
  let matchId: string | null = null

  if (isSupabaseConfigured && organizerId) {
    const active = await fetchActiveFreeMatch(organizerId)
    if (active?.id) {
      const record = await fetchMatchState(active.id)
      const activeSport = parseSportId(record?.sport ?? record?.state?.sport)
      if (activeSport === sportId) {
        matchId = active.id
      } else {
        throw new EntitlementError(
          `Ya tienes un partido en vivo de ${getSportModule(activeSport).label}. Finalízalo antes de crear uno de otro deporte.`,
        )
      }
    }
  } else {
    const localId = readMatchIdFromStorage()
    if (localId) {
      const raw = localStorage.getItem(getStorageKey(localId))
      if (raw) {
        const parsed = JSON.parse(raw) as { sport?: string }
        if (parseSportId(parsed.sport) === sportId) matchId = localId
      }
    }
  }

  if (!matchId) {
    matchId = generateMatchId()
    const sport = getSportModule(sportId)
    const state = sport.createDefaultState()
    if (isSupabaseConfigured) {
      await createMatch(matchId, state, organizerId, sport.id)
    } else {
      localStorage.setItem(getStorageKey(matchId), JSON.stringify(state))
    }
  }

  return matchId
}
