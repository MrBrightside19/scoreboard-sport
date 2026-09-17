export type BasketballPoints = 1 | 2 | 3
export type ReboundKind = 'offensive' | 'defensive'
export type BasketballFoulKind =
  | 'personal'
  | 'offensive'
  | 'technical'
  | 'unsportsmanlike'
  | 'disqualifying'

export interface BasketballScoreEvent {
  id: string
  team: 'local' | 'visit'
  points: BasketballPoints
  scorerPlayerId: string
  assistPlayerId: string | null
  period: number
  gameMinute: string
  createdAt: string
}

export interface ReboundEvent {
  id: string
  team: 'local' | 'visit'
  playerId: string
  kind: ReboundKind
  period: number
  gameMinute: string
  createdAt: string
}

export interface BasketballFoulEvent {
  id: string
  team: 'local' | 'visit'
  playerId: string
  player: string
  kind: BasketballFoulKind
  period: number
  gameMinute: string
  createdAt: string
}

export const BASKETBALL_PERIODS = 4
export const BASKETBALL_QUARTER_TIME = '10:00'
export const BASKETBALL_BREAK_TIME = '02:00'
export const BASKETBALL_BONUS_FOULS = 5
export const BASKETBALL_PLAYER_FOUL_LIMIT = 5

export const BASKETBALL_FOUL_LABELS: Record<BasketballFoulKind, string> = {
  personal: 'Personal',
  offensive: 'Ofensiva',
  technical: 'Técnica',
  unsportsmanlike: 'Antideportiva',
  disqualifying: 'Descalificante',
}

export function basketballPointsLabel(points: BasketballPoints): string {
  if (points === 1) return 'Tiro libre'
  if (points === 3) return 'Triple'
  return 'Doble'
}
