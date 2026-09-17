/**
 * Estado y normalización propios de básquet (1/2/3, rebotes, faltas).
 */
import { generateId } from '@/utils/id'
import type {
  BasketballFoulEvent,
  BasketballScoreEvent,
  ReboundEvent,
} from '@/sports/basketball/types'

export type {
  BasketballFoulEvent,
  BasketballScoreEvent,
  ReboundEvent,
} from '@/sports/basketball/types'

export interface BasketballStateSlice {
  basketballScores: BasketballScoreEvent[]
  rebounds: ReboundEvent[]
  basketballFouls: BasketballFoulEvent[]
}

export function createBasketballStateSlice(): BasketballStateSlice {
  return {
    basketballScores: [],
    rebounds: [],
    basketballFouls: [],
  }
}

function normalizeBasketballScores(raw: unknown): BasketballScoreEvent[] {
  if (!Array.isArray(raw)) return []
  return raw.map((item) => {
    const event = item as Partial<BasketballScoreEvent>
    const points = event.points === 1 || event.points === 3 ? event.points : 2
    return {
      id: String(event.id ?? generateId()),
      team: event.team === 'visit' ? 'visit' : 'local',
      points,
      scorerPlayerId: String(event.scorerPlayerId ?? ''),
      assistPlayerId: event.assistPlayerId ? String(event.assistPlayerId) : null,
      period: typeof event.period === 'number' ? event.period : 1,
      gameMinute: String(event.gameMinute ?? ''),
      createdAt: String(event.createdAt ?? new Date().toISOString()),
    }
  })
}

function normalizeRebounds(raw: unknown): ReboundEvent[] {
  if (!Array.isArray(raw)) return []
  return raw.map((item) => {
    const event = item as Partial<ReboundEvent>
    return {
      id: String(event.id ?? generateId()),
      team: event.team === 'visit' ? 'visit' : 'local',
      playerId: String(event.playerId ?? ''),
      kind: event.kind === 'offensive' ? 'offensive' : 'defensive',
      period: typeof event.period === 'number' ? event.period : 1,
      gameMinute: String(event.gameMinute ?? ''),
      createdAt: String(event.createdAt ?? new Date().toISOString()),
    }
  })
}

function normalizeBasketballFouls(raw: unknown): BasketballFoulEvent[] {
  if (!Array.isArray(raw)) return []
  return raw.map((item) => {
    const event = item as Partial<BasketballFoulEvent>
    const kind =
      event.kind === 'offensive' ||
      event.kind === 'technical' ||
      event.kind === 'unsportsmanlike' ||
      event.kind === 'disqualifying'
        ? event.kind
        : 'personal'
    return {
      id: String(event.id ?? generateId()),
      team: event.team === 'visit' ? 'visit' : 'local',
      playerId: String(event.playerId ?? ''),
      player: String(event.player ?? ''),
      kind,
      period: typeof event.period === 'number' ? event.period : 1,
      gameMinute: String(event.gameMinute ?? ''),
      createdAt: String(event.createdAt ?? new Date().toISOString()),
    }
  })
}

export function normalizeBasketballStateSlice(
  source: Record<string, unknown>,
): BasketballStateSlice {
  return {
    basketballScores: normalizeBasketballScores(source.basketballScores),
    rebounds: normalizeRebounds(source.rebounds),
    basketballFouls: normalizeBasketballFouls(source.basketballFouls),
  }
}
