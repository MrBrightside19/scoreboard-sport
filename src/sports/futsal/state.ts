/**
 * Estado y normalización propios de futsal FIFA
 * (faltas acumuladas, tarjetas, exclusiones 2′, tiempos muertos).
 */
import { generateId } from '@/utils/id'
import type {
  FutsalAccumulatedFoulEvent,
  FutsalCardEvent,
  FutsalExclusionEvent,
  FutsalTimeoutEvent,
} from '@/sports/futsal/types'

export type {
  FutsalAccumulatedFoulEvent,
  FutsalCardEvent,
  FutsalExclusionEvent,
  FutsalTimeoutEvent,
} from '@/sports/futsal/types'

export interface FutsalStateSlice {
  futsalAccumulatedFouls: FutsalAccumulatedFoulEvent[]
  futsalCards: FutsalCardEvent[]
  futsalExclusions: FutsalExclusionEvent[]
  futsalTimeouts: FutsalTimeoutEvent[]
}

export function createFutsalStateSlice(): FutsalStateSlice {
  return {
    futsalAccumulatedFouls: [],
    futsalCards: [],
    futsalExclusions: [],
    futsalTimeouts: [],
  }
}

function normalizeFutsalAccumulatedFouls(raw: unknown): FutsalAccumulatedFoulEvent[] {
  if (!Array.isArray(raw)) return []
  return raw.map((item) => {
    const event = item as Partial<FutsalAccumulatedFoulEvent>
    return {
      id: String(event.id ?? generateId()),
      team: event.team === 'visit' ? 'visit' : 'local',
      playerId: String(event.playerId ?? ''),
      player: String(event.player ?? ''),
      period: typeof event.period === 'number' ? event.period : 1,
      gameMinute: String(event.gameMinute ?? ''),
      createdAt: String(event.createdAt ?? new Date().toISOString()),
    }
  })
}

function normalizeFutsalCards(raw: unknown): FutsalCardEvent[] {
  if (!Array.isArray(raw)) return []
  return raw.map((item) => {
    const event = item as Partial<FutsalCardEvent>
    const kind =
      event.kind === 'blue' || event.kind === 'red' ? event.kind : 'yellow'
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

function normalizeFutsalExclusions(raw: unknown): FutsalExclusionEvent[] {
  if (!Array.isArray(raw)) return []
  return raw.map((item) => {
    const event = item as Partial<FutsalExclusionEvent>
    return {
      id: String(event.id ?? generateId()),
      team: event.team === 'visit' ? 'visit' : 'local',
      playerId: String(event.playerId ?? ''),
      player: String(event.player ?? ''),
      time: String(event.time ?? '02:00'),
      period: typeof event.period === 'number' ? event.period : 1,
      createdAt: String(event.createdAt ?? new Date().toISOString()),
    }
  })
}

function normalizeFutsalTimeouts(raw: unknown): FutsalTimeoutEvent[] {
  if (!Array.isArray(raw)) return []
  return raw.map((item) => {
    const event = item as Partial<FutsalTimeoutEvent>
    return {
      id: String(event.id ?? generateId()),
      team: event.team === 'visit' ? 'visit' : 'local',
      period: typeof event.period === 'number' ? event.period : 1,
      gameMinute: String(event.gameMinute ?? ''),
      createdAt: String(event.createdAt ?? new Date().toISOString()),
    }
  })
}

export function normalizeFutsalStateSlice(
  source: Record<string, unknown>,
): FutsalStateSlice {
  return {
    futsalAccumulatedFouls: normalizeFutsalAccumulatedFouls(source.futsalAccumulatedFouls),
    futsalCards: normalizeFutsalCards(source.futsalCards),
    futsalExclusions: normalizeFutsalExclusions(source.futsalExclusions),
    futsalTimeouts: normalizeFutsalTimeouts(source.futsalTimeouts),
  }
}
