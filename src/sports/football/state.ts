/**
 * Estado y normalización propios de fútbol de campo FIFA (tarjetas amarilla/roja).
 */
import { generateId } from '@/utils/id'
import type { FootballCardEvent } from '@/sports/football/types'

export type { FootballCardEvent } from '@/sports/football/types'

export interface FootballStateSlice {
  footballCards: FootballCardEvent[]
}

export function createFootballStateSlice(): FootballStateSlice {
  return {
    footballCards: [],
  }
}

function normalizeFootballCards(raw: unknown): FootballCardEvent[] {
  if (!Array.isArray(raw)) return []
  return raw.map((item) => {
    const event = item as Partial<FootballCardEvent>
    return {
      id: String(event.id ?? generateId()),
      team: event.team === 'visit' ? 'visit' : 'local',
      playerId: String(event.playerId ?? ''),
      player: String(event.player ?? ''),
      kind: event.kind === 'red' ? 'red' : 'yellow',
      period: typeof event.period === 'number' ? event.period : 1,
      gameMinute: String(event.gameMinute ?? ''),
      createdAt: String(event.createdAt ?? new Date().toISOString()),
    }
  })
}

export function normalizeFootballStateSlice(
  source: Record<string, unknown>,
): FootballStateSlice {
  return {
    footballCards: normalizeFootballCards(source.footballCards),
  }
}
