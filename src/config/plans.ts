import type { PlanDefinition, PlanId, PlanLimits } from '@/types/billing'

export const PLAN_LIMITS: Record<PlanId, PlanLimits> = {
  free: {
    maxLiveMatches: 1,
    maxActiveTournaments: 1,
    maxCalendarMatches: 8,
    maxAssistants: 1,
    sports: 'all',
    showBranding: true,
  },
  pro: {
    maxLiveMatches: 4,
    maxActiveTournaments: Number.POSITIVE_INFINITY,
    maxCalendarMatches: Number.POSITIVE_INFINITY,
    maxAssistants: 8,
    sports: 'all',
    showBranding: false,
  },
  event: {
    maxLiveMatches: 4,
    maxActiveTournaments: Number.POSITIVE_INFINITY,
    maxCalendarMatches: Number.POSITIVE_INFINITY,
    maxAssistants: 8,
    sports: 'all',
    showBranding: false,
  },
}

export const PLANS: PlanDefinition[] = [
  {
    id: 'free',
    name: 'Free',
    tagline: 'Para probar la mesa de verdad',
    priceLabel: 'Gratis',
    priceHint: 'Sin tarjeta',
    limits: PLAN_LIMITS.free,
    features: [
      '1 partido en vivo a la vez',
      '1 torneo activo (hasta 8 partidos)',
      'Hockey, futsal, básquetbol y fútbol',
      '1 asistente',
      'Live, overlay y TV públicos',
      'Marca ScoreDesk en overlay',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    tagline: 'Para ligas y uso frecuente',
    priceLabel: 'Mensual',
    priceHint: 'Cancela cuando quieras',
    highlighted: true,
    limits: PLAN_LIMITS.pro,
    features: [
      'Hasta 4 canchas en vivo',
      'Torneos y calendario ilimitados',
      'Todos los deportes disponibles',
      'Hasta 8 asistentes',
      'Sin marca en overlay / TV',
      'Informes y plantillas Excel',
    ],
  },
  {
    id: 'event',
    name: 'Pase evento',
    tagline: 'Un fin de semana de torneo',
    priceLabel: '48–72 h',
    priceHint: 'Pago único',
    limits: PLAN_LIMITS.event,
    features: [
      'Mismos techos que Pro',
      'Vigencia de 72 horas',
      'Ideal para un torneo al año',
      'Sin suscripción mensual',
      'Sin marca en overlay / TV',
    ],
  },
]

export function getPlanDefinition(plan: PlanId): PlanDefinition {
  return PLANS.find((item) => item.id === plan) ?? PLANS[0]!
}

export function formatLimit(value: number): string {
  return Number.isFinite(value) ? String(value) : 'Ilimitado'
}
