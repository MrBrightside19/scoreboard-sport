import { generateId } from '@/utils/id'
import { secondsToClock } from '@/data/penaltyCatalog'

export type PlayerRole = 'player' | 'goalkeeper' | 'captain' | 'assistant_captain'

export interface RosterPlayer {
  id: string
  number: string
  /** Nombre completo del jugador. */
  name: string
  role: PlayerRole
}

export interface TeamPenalty {
  id: string
  playerId: string
  player: string
  penaltyTypeId: string
  infraction: string
  time: string
}

export interface GoalEvent {
  id: string
  team: 'local' | 'visit'
  scorerPlayerId: string
  assistPlayerId: string | null
  gameMinute: string
  period: number
  createdAt: string
  status: 'pending' | 'confirmed'
}

export function isGoalPending(goal: GoalEvent): boolean {
  return goal.status === 'pending' || !goal.scorerPlayerId
}

/** miss = tiro al arco sin contacto del arquero; save = atajada. */
export type ShotResult = 'miss' | 'save'

export interface ShotEvent {
  id: string
  /** miss = equipo que tira; save = equipo del arquero. */
  team: 'local' | 'visit'
  result: ShotResult
  /** Arquero acreditado en una atajada; vacío si el roster no lo define. */
  goalkeeperPlayerId: string
  gameMinute: string
  period: number
  createdAt: string
}

export interface ScoreboardState {
  localTeam: string
  visitTeam: string
  matchCategory: string
  localLogo: string
  visitLogo: string
  localColor: string
  visitColor: string
  goalLocal: number
  goalVisit: number
  gamePeriod: number
  timeGame: string
  rosterLocal: RosterPlayer[]
  rosterVisit: RosterPlayer[]
  goals: GoalEvent[]
  shots: ShotEvent[]
  penaltiesLocal: TeamPenalty[]
  penaltiesVisit: TeamPenalty[]
  isPaused: boolean
  /** Descanso entre periodos activo (cuenta regresiva en TV). */
  intermissionActive: boolean
  /** Tiempo restante del descanso (cuenta regresiva). */
  intermissionTime: string
  /** Duración configurada del descanso (por defecto 05:00 al crear el partido). */
  intermissionDuration: string
  /** Árbitros del partido (hasta 2). */
  referee1: string
  referee2: string
  /** Oficiales de mesa (hasta 3). */
  tableOfficial1: string
  tableOfficial2: string
  tableOfficial3: string
  updatedAt: string
}

export const DEFAULT_GAME_TIME = '20:00'
export const DEFAULT_INTERMISSION_TIME = '05:00'
export const DEFAULT_PENALTY_TYPE_ID = 'minor'
export const MAX_PERIODS = 3
export const MAX_PENALTIES_PER_TEAM = 2
export const DEFAULT_LOCAL_COLOR = '#3da5ff'
export const DEFAULT_VISIT_COLOR = '#ff5a36'

export function createDefaultScoreboardState(
  localTeam = 'Local',
  visitTeam = 'Visita',
  timeGame = DEFAULT_GAME_TIME,
): ScoreboardState {
  return {
    localTeam,
    visitTeam,
    matchCategory: '',
    localLogo: '',
    visitLogo: '',
    localColor: DEFAULT_LOCAL_COLOR,
    visitColor: DEFAULT_VISIT_COLOR,
    goalLocal: 0,
    goalVisit: 0,
    gamePeriod: 1,
    timeGame,
    rosterLocal: [],
    rosterVisit: [],
    goals: [],
    shots: [],
    penaltiesLocal: [],
    penaltiesVisit: [],
    isPaused: true,
    intermissionActive: false,
    intermissionTime: DEFAULT_INTERMISSION_TIME,
    intermissionDuration: DEFAULT_INTERMISSION_TIME,
    referee1: '',
    referee2: '',
    tableOfficial1: '',
    tableOfficial2: '',
    tableOfficial3: '',
    updatedAt: new Date().toISOString(),
  }
}

function normalizeRoster(raw: unknown): RosterPlayer[] {
  if (!Array.isArray(raw)) return []
  return raw.map((item) => {
    const player = item as Partial<RosterPlayer> & { lastName?: string }
    const name = [player.name, player.lastName]
      .map((part) => String(part ?? '').trim())
      .filter(Boolean)
      .join(' ')
    return {
      id: String(player.id ?? generateId()),
      number: String(player.number ?? ''),
      name,
      role: (player.role as PlayerRole) ?? 'player',
    }
  })
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

function normalizeGoals(raw: unknown): GoalEvent[] {
  if (!Array.isArray(raw)) return []
  return raw.map((item) => {
    const goal = item as Partial<GoalEvent>
    return {
      id: String(goal.id ?? generateId()),
      team: goal.team === 'visit' ? 'visit' : 'local',
      scorerPlayerId: String(goal.scorerPlayerId ?? ''),
      assistPlayerId: goal.assistPlayerId ? String(goal.assistPlayerId) : null,
      gameMinute: String(goal.gameMinute ?? ''),
      period: typeof goal.period === 'number' ? goal.period : 1,
      createdAt: String(goal.createdAt ?? new Date().toISOString()),
      status: goal.scorerPlayerId
        ? 'confirmed'
        : goal.status === 'confirmed'
          ? 'confirmed'
          : 'pending',
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

/** Migra estados antiguos al formato actual. */
export function normalizeScoreboardState(raw: unknown): ScoreboardState {
  const source = (raw ?? {}) as Partial<ScoreboardState> & Record<string, unknown>
  const base = createDefaultScoreboardState(
    (source.localTeam as string) ?? 'Local',
    (source.visitTeam as string) ?? 'Visita',
    (source.timeGame as string) ?? DEFAULT_GAME_TIME,
  )

  const merged: ScoreboardState = {
    ...base,
    ...source,
    localTeam: (source.localTeam as string) ?? base.localTeam,
    visitTeam: (source.visitTeam as string) ?? base.visitTeam,
    matchCategory: String(source.matchCategory ?? base.matchCategory),
    localLogo: String(source.localLogo ?? base.localLogo),
    visitLogo: String(source.visitLogo ?? base.visitLogo),
    localColor: String(source.localColor ?? base.localColor) || DEFAULT_LOCAL_COLOR,
    visitColor: String(source.visitColor ?? base.visitColor) || DEFAULT_VISIT_COLOR,
    goalLocal: typeof source.goalLocal === 'number' ? source.goalLocal : base.goalLocal,
    goalVisit: typeof source.goalVisit === 'number' ? source.goalVisit : base.goalVisit,
    gamePeriod: typeof source.gamePeriod === 'number' ? source.gamePeriod : base.gamePeriod,
    timeGame: (source.timeGame as string) ?? base.timeGame,
    isPaused: typeof source.isPaused === 'boolean' ? source.isPaused : base.isPaused,
    intermissionActive:
      typeof source.intermissionActive === 'boolean'
        ? source.intermissionActive
        : base.intermissionActive,
    intermissionTime: String(source.intermissionTime ?? base.intermissionTime),
    intermissionDuration: String(
      source.intermissionDuration ?? base.intermissionDuration,
    ),
    referee1: String(source.referee1 ?? base.referee1),
    referee2: String(source.referee2 ?? base.referee2),
    tableOfficial1: String(source.tableOfficial1 ?? base.tableOfficial1),
    tableOfficial2: String(source.tableOfficial2 ?? base.tableOfficial2),
    tableOfficial3: String(source.tableOfficial3 ?? base.tableOfficial3),
    updatedAt: (source.updatedAt as string) ?? base.updatedAt,
    rosterLocal: normalizeRoster(source.rosterLocal),
    rosterVisit: normalizeRoster(source.rosterVisit),
    goals: normalizeGoals(source.goals),
    shots: normalizeShots(source.shots),
    penaltiesLocal: [],
    penaltiesVisit: [],
  }

  const legacyTime = String(source.penaltyGame ?? secondsToClock(90))

  if (Array.isArray(source.penaltiesLocal)) {
    merged.penaltiesLocal = source.penaltiesLocal
      .slice(0, MAX_PENALTIES_PER_TEAM)
      .map((penalty) => normalizePenalty(penalty, legacyTime))
  } else if (source.penalizedLocal) {
    merged.penaltiesLocal = [normalizePenalty({ player: '', time: legacyTime }, legacyTime)]
  }

  if (Array.isArray(source.penaltiesVisit)) {
    merged.penaltiesVisit = source.penaltiesVisit
      .slice(0, MAX_PENALTIES_PER_TEAM)
      .map((penalty) => normalizePenalty(penalty, legacyTime))
  } else if (source.penalizedVisit) {
    merged.penaltiesVisit = [normalizePenalty({ player: '', time: legacyTime }, legacyTime)]
  }

  return merged
}
