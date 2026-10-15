/**
 * Estado y normalización propios de hockey (penalidades con tiempo, tiros/atajadas).
 */
import { generateId } from '@/utils/id'
import { secondsToClock } from '@/data/penaltyCatalog'

export interface TeamPenalty {
  id: string
  playerId: string
  player: string
  penaltyTypeId: string
  infraction: string
  time: string
}

/** miss = tiro al arco sin contacto del arquero; save = atajada. */
export type ShotResult = 'miss' | 'save'

export interface ShotEvent {
  id: string
  /** miss = equipo que tira; save = equipo del arquero. */
  team: 'local' | 'visit'
  result: ShotResult
  goalkeeperPlayerId: string
  gameMinute: string
  period: number
  createdAt: string
}

export interface HockeyTimeoutEvent {
  id: string
  team: 'local' | 'visit'
  period: number
  gameMinute: string
  createdAt: string
}

export interface HockeyPowerPlayEvent {
  id: string
  team: 'local' | 'visit'
  period: number
  gameMinute: string
  createdAt: string
  /** Gol que originó el registro, si aplica. */
  goalId?: string
}

export interface HockeyStateSlice {
  shots: ShotEvent[]
  penaltiesLocal: TeamPenalty[]
  penaltiesVisit: TeamPenalty[]
  hockeyTimeouts: HockeyTimeoutEvent[]
  hockeyPowerPlayOpportunities: HockeyPowerPlayEvent[]
  hockeyPowerPlayGoals: HockeyPowerPlayEvent[]
}

export const DEFAULT_PENALTY_TYPE_ID = 'minor'
export const MAX_PERIODS = 3
export const MAX_PENALTIES_PER_TEAM = 2
/** World Skate: 1 tiempo muerto por equipo en cada periodo. */
export const HOCKEY_TIMEOUTS_PER_PERIOD = 1

export function createHockeyStateSlice(): HockeyStateSlice {
  return {
    shots: [],
    penaltiesLocal: [],
    penaltiesVisit: [],
    hockeyTimeouts: [],
    hockeyPowerPlayOpportunities: [],
    hockeyPowerPlayGoals: [],
  }
}

function normalizePenalty(raw: unknown, fallbackTime: string): TeamPenalty {
  const penalty = raw as Partial<TeamPenalty> & { player?: string; time?: string }
  return {
    id: String(penalty.id ?? generateId()),
    playerId: String(penalty.playerId ?? ''),
    player: String(penalty.player ?? ''),
    penaltyTypeId: String(penalty.penaltyTypeId ?? DEFAULT_PENALTY_TYPE_ID),
    infraction: String(penalty.infraction ?? ''),
    time: String(penalty.time ?? fallbackTime),
  }
}

function normalizeTimeouts(raw: unknown): HockeyTimeoutEvent[] {
  if (!Array.isArray(raw)) return []
  return raw.map((item) => {
    const event = item as Partial<HockeyTimeoutEvent>
    return {
      id: String(event.id ?? generateId()),
      team: event.team === 'visit' ? 'visit' : 'local',
      period: typeof event.period === 'number' ? event.period : 1,
      gameMinute: String(event.gameMinute ?? ''),
      createdAt: String(event.createdAt ?? new Date().toISOString()),
    }
  })
}

function normalizePowerPlayEvents(raw: unknown): HockeyPowerPlayEvent[] {
  if (!Array.isArray(raw)) return []
  return raw.map((item) => {
    const event = item as Partial<HockeyPowerPlayEvent>
    return {
      id: String(event.id ?? generateId()),
      team: event.team === 'visit' ? 'visit' : 'local',
      period: typeof event.period === 'number' ? event.period : 1,
      gameMinute: String(event.gameMinute ?? ''),
      createdAt: String(event.createdAt ?? new Date().toISOString()),
      ...(event.goalId ? { goalId: String(event.goalId) } : {}),
    }
  })
}

function normalizeShots(raw: unknown): ShotEvent[] {
  if (!Array.isArray(raw)) return []
  return raw.map((item) => {
    const shot = item as Partial<ShotEvent>
    return {
      id: String(shot.id ?? generateId()),
      team: shot.team === 'visit' ? 'visit' : 'local',
      result: shot.result === 'save' ? 'save' : 'miss',
      goalkeeperPlayerId: String(shot.goalkeeperPlayerId ?? ''),
      gameMinute: String(shot.gameMinute ?? ''),
      period: typeof shot.period === 'number' ? shot.period : 1,
      createdAt: String(shot.createdAt ?? new Date().toISOString()),
    }
  })
}

export function normalizeHockeyStateSlice(
  source: Record<string, unknown>,
): HockeyStateSlice {
  const legacyTime = String(source.penaltyGame ?? secondsToClock(90))
  const slice = createHockeyStateSlice()
  slice.shots = normalizeShots(source.shots)
  slice.hockeyTimeouts = normalizeTimeouts(source.hockeyTimeouts)
  slice.hockeyPowerPlayOpportunities = normalizePowerPlayEvents(
    source.hockeyPowerPlayOpportunities,
  )
  slice.hockeyPowerPlayGoals = normalizePowerPlayEvents(source.hockeyPowerPlayGoals)

  if (Array.isArray(source.penaltiesLocal)) {
    slice.penaltiesLocal = source.penaltiesLocal
      .slice(0, MAX_PENALTIES_PER_TEAM)
      .map((penalty) => normalizePenalty(penalty, legacyTime))
  } else if (source.penalizedLocal) {
    slice.penaltiesLocal = [normalizePenalty({ player: '', time: legacyTime }, legacyTime)]
  }

  if (Array.isArray(source.penaltiesVisit)) {
    slice.penaltiesVisit = source.penaltiesVisit
      .slice(0, MAX_PENALTIES_PER_TEAM)
      .map((penalty) => normalizePenalty(penalty, legacyTime))
  } else if (source.penalizedVisit) {
    slice.penaltiesVisit = [normalizePenalty({ player: '', time: legacyTime }, legacyTime)]
  }

  return slice
}
