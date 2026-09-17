export type PlanId = 'free' | 'pro' | 'event'
export type EntitlementStatus = 'active' | 'canceled' | 'expired' | 'past_due'

export interface PlanLimits {
  maxLiveMatches: number
  maxActiveTournaments: number
  maxCalendarMatches: number
  maxAssistants: number
  sports: 'hockey' | 'all'
  showBranding: boolean
}

export interface PlanDefinition {
  id: PlanId
  name: string
  tagline: string
  priceLabel: string
  priceHint: string
  highlighted?: boolean
  limits: PlanLimits
  features: string[]
}

export interface Entitlement {
  user_id: string
  plan: PlanId
  status: EntitlementStatus
  current_period_end: string | null
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  created_at: string
  updated_at: string
}

export class EntitlementError extends Error {
  readonly code = 'ENTITLEMENT'

  constructor(message: string) {
    super(message)
    this.name = 'EntitlementError'
  }
}
