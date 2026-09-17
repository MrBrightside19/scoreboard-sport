export type FootballCardKind = 'yellow' | 'red'

export interface FootballCardEvent {
  id: string
  team: 'local' | 'visit'
  playerId: string
  player: string
  kind: FootballCardKind
  period: number
  gameMinute: string
  createdAt: string
  /** Roja automática por segunda amarilla (expulsión). */
  fromSecondYellow?: boolean
}

export const FOOTBALL_PERIODS = 2
export const FOOTBALL_EXTRA_PERIODS = 2
export const FOOTBALL_MAX_PERIODS = FOOTBALL_PERIODS + FOOTBALL_EXTRA_PERIODS
export const FOOTBALL_HALF_TIME = '45:00'
export const FOOTBALL_BREAK_TIME = '15:00'
export const FOOTBALL_EXTRA_TIME = '15:00'

export const FOOTBALL_CARD_LABELS: Record<FootballCardKind, string> = {
  yellow: 'Amarilla',
  red: 'Roja',
}
