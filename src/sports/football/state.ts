/**
 * Estado y normalización propios de fútbol de campo FIFA (tarjetas amarilla/roja).
 */
import { generateId } from '@/utils/id'
import {
  FOOTBALL_HALF_TIME,
  FOOTBALL_MAX_PERIOD_MINUTES,
  FOOTBALL_MIN_PERIOD_MINUTES,
  FOOTBALL_MAX_STOPPAGE_MINUTES,
  type FootballCardEvent,
} from '@/sports/football/types'
import { formatSecondsToTime, parseTimeToSeconds } from '@/utils/clock'

export type { FootballCardEvent } from '@/sports/football/types'

export interface FootballStateSlice {
  footballCards: FootballCardEvent[]
  /** Minutos de descuento del periodo actual (cartel del cuarto árbitro). */
  footballStoppageMinutes: number
  /** Duración de cada tiempo reglamentario (p. ej. 45:00 o 35:00). */
  footballPeriodLength: string
}

export function normalizeFootballPeriodLength(raw: unknown): string {
  const seconds =
    typeof raw === 'number' && Number.isFinite(raw)
      ? raw * 60
      : typeof raw === 'string' && raw.trim()
        ? parseTimeToSeconds(raw)
        : NaN
  if (!Number.isFinite(seconds) || seconds <= 0) return FOOTBALL_HALF_TIME
  const minutes = Math.round(seconds / 60)
  const clamped = Math.min(
    FOOTBALL_MAX_PERIOD_MINUTES,
    Math.max(FOOTBALL_MIN_PERIOD_MINUTES, minutes),
  )
  return formatSecondsToTime(clamped * 60)
}

export function createFootballStateSlice(): FootballStateSlice {
  return {
    footballCards: [],
    footballStoppageMinutes: 0,
    footballPeriodLength: FOOTBALL_HALF_TIME,
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
      fromSecondYellow: Boolean(event.fromSecondYellow),
    }
  })
}

export function normalizeFootballStateSlice(
  source: Record<string, unknown>,
): FootballStateSlice {
  const rawStoppage = Number(source.footballStoppageMinutes)
  return {
    footballCards: normalizeFootballCards(source.footballCards),
    footballStoppageMinutes:
      Number.isFinite(rawStoppage) && rawStoppage > 0
        ? Math.min(FOOTBALL_MAX_STOPPAGE_MINUTES, Math.floor(rawStoppage))
        : 0,
    footballPeriodLength: normalizeFootballPeriodLength(source.footballPeriodLength),
  }
}
