export type FutsalCardKind = 'yellow' | 'blue' | 'red'

export interface FutsalAccumulatedFoulEvent {
  id: string
  team: 'local' | 'visit'
  playerId: string
  player: string
  period: number
  gameMinute: string
  createdAt: string
}

export interface FutsalCardEvent {
  id: string
  team: 'local' | 'visit'
  playerId: string
  player: string
  kind: FutsalCardKind
  period: number
  gameMinute: string
  createdAt: string
}

/** Exclusión temporal de 2′ (tarjeta azul / temporal). */
export interface FutsalExclusionEvent {
  id: string
  team: 'local' | 'visit'
  playerId: string
  player: string
  time: string
  period: number
  createdAt: string
}

export interface FutsalTimeoutEvent {
  id: string
  team: 'local' | 'visit'
  period: number
  gameMinute: string
  createdAt: string
}

export const FUTSAL_PERIODS = 2
export const FUTSAL_HALF_TIME = '20:00'
export const FUTSAL_BREAK_TIME = '10:00'
export const FUTSAL_ACCUMULATED_FOUL_LIMIT = 5
export const FUTSAL_EXCLUSION_TIME = '02:00'
export const FUTSAL_TIMEOUTS_PER_PERIOD = 1

export const FUTSAL_CARD_LABELS: Record<FutsalCardKind, string> = {
  yellow: 'Amarilla',
  blue: 'Azul (2′)',
  red: 'Roja',
}
