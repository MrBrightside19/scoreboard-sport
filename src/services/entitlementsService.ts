import { PLAN_LIMITS } from '@/config/plans'
import {
  EntitlementError,
  type Entitlement,
  type PlanId,
  type PlanLimits,
} from '@/types/billing'
import type { SportId } from '@/types/sport'
import { supabaseRest } from './supabaseRest'

function fallbackEntitlement(userId: string): Entitlement {
  return {
    user_id: userId,
    plan: 'free',
    status: 'active',
    current_period_end: null,
    stripe_customer_id: null,
    stripe_subscription_id: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
}

export function isEntitlementActive(row: Entitlement): boolean {
  if (row.status !== 'active') return false
  if (!row.current_period_end) return row.plan === 'free'
  return new Date(row.current_period_end).getTime() > Date.now()
}

export function resolvePlan(row: Entitlement | null): PlanId {
  if (!row || !isEntitlementActive(row)) return 'free'
  return row.plan
}

export function resolveLimits(row: Entitlement | null): PlanLimits {
  return PLAN_LIMITS[resolvePlan(row)]
}

export async function fetchEntitlement(userId: string): Promise<Entitlement> {
  try {
    const rows = await supabaseRest<Entitlement[]>(
      `entitlements?user_id=eq.${userId}&select=*`,
    )
    return rows[0] ?? fallbackEntitlement(userId)
  } catch {
    return fallbackEntitlement(userId)
  }
}

export async function countOrganizerLiveMatches(organizerId: string): Promise<number> {
  const rows = await supabaseRest<{ id: string }[]>(
    `matches?organizer_id=eq.${organizerId}&is_live=eq.true&finished_at=is.null&select=id`,
  )
  return rows.length
}

export async function countOrganizerActiveTournaments(
  organizerId: string,
): Promise<number> {
  const rows = await supabaseRest<{ id: string }[]>(
    `tournaments?organizer_id=eq.${organizerId}&status=in.(draft,active)&select=id`,
  )
  return rows.length
}

export async function countTournamentCalendarMatches(
  tournamentId: string,
): Promise<number> {
  const rows = await supabaseRest<{ id: string }[]>(
    `tournament_matches?tournament_id=eq.${tournamentId}&select=id`,
  )
  return rows.length
}

export async function assertCanStartLiveMatch(
  organizerId: string,
  options: { sport?: SportId | string | null; ignoreMatchId?: string } = {},
): Promise<void> {
  const entitlement = await fetchEntitlement(organizerId)
  const limits = resolveLimits(entitlement)

  if (options.sport && limits.sports !== 'all' && options.sport !== 'hockey') {
    throw new EntitlementError(
      'El plan Free solo incluye hockey. Actualiza a Pro o Pase evento para otros deportes.',
    )
  }

  const live = await countOrganizerLiveMatches(organizerId)
  const effective = options.ignoreMatchId ? Math.max(0, live - 1) : live
  if (effective >= limits.maxLiveMatches) {
    throw new EntitlementError(
      limits.maxLiveMatches === 1
        ? 'El plan Free permite 1 partido en vivo. Finaliza el actual o actualiza tu plan.'
        : `Llegaste al máximo de ${limits.maxLiveMatches} partidos en vivo de tu plan.`,
    )
  }
}

export async function assertCanCreateTournament(
  organizerId: string,
  sport?: SportId | string | null,
): Promise<void> {
  const entitlement = await fetchEntitlement(organizerId)
  const limits = resolveLimits(entitlement)

  if (sport && limits.sports !== 'all' && sport !== 'hockey') {
    throw new EntitlementError(
      'El plan Free solo incluye hockey. Actualiza a Pro o Pase evento para otros deportes.',
    )
  }

  const active = await countOrganizerActiveTournaments(organizerId)
  if (active >= limits.maxActiveTournaments) {
    throw new EntitlementError(
      'El plan Free permite 1 torneo activo. Finalízalo o actualiza tu plan.',
    )
  }
}

export async function assertCanAddCalendarMatch(
  organizerId: string,
  tournamentId: string,
): Promise<void> {
  const entitlement = await fetchEntitlement(organizerId)
  const limits = resolveLimits(entitlement)
  if (!Number.isFinite(limits.maxCalendarMatches)) return

  const count = await countTournamentCalendarMatches(tournamentId)
  if (count >= limits.maxCalendarMatches) {
    throw new EntitlementError(
      `El plan Free permite hasta ${limits.maxCalendarMatches} partidos en el calendario.`,
    )
  }
}

export async function assertCanAddAssistant(
  organizerId: string,
  currentCount: number,
): Promise<void> {
  const entitlement = await fetchEntitlement(organizerId)
  const limits = resolveLimits(entitlement)
  if (currentCount >= limits.maxAssistants) {
    throw new EntitlementError(
      `Tu plan permite hasta ${limits.maxAssistants} asistente${limits.maxAssistants === 1 ? '' : 's'}.`,
    )
  }
}
