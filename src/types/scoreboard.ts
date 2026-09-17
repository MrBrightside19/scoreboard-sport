/**
 * Núcleo compartido del marcador (equipos, reloj, goles, nómina, oficiales).
 * Lo específico de cada deporte vive en `src/sports/<deporte>/state.ts`.
 */
import { generateId } from '@/utils/id'
import { DEFAULT_SPORT, parseSportId, type SportId } from '@/types/sport'

export type PlayerRole = 'player' | 'goalkeeper' | 'captain' | 'assistant_captain'

export interface RosterPlayer {
  id: string
  number: string
  /** Nombre completo del jugador. */
  name: string
  role: PlayerRole
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

export interface ScoreboardCore {
  sport: SportId
  stateVersion: number
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
  isPaused: boolean
  intermissionActive: boolean
  intermissionTime: string
  intermissionDuration: string
  referee1: string
  referee2: string
  tableOfficial1: string
  tableOfficial2: string
  tableOfficial3: string
  updatedAt: string
  showBranding: boolean
}

export const DEFAULT_GAME_TIME = '20:00'
export const DEFAULT_INTERMISSION_TIME = '05:00'
export const DEFAULT_LOCAL_COLOR = '#3da5ff'
export const DEFAULT_VISIT_COLOR = '#ff5a36'

export function createScoreboardCore(
  localTeam = 'Local',
  visitTeam = 'Visita',
  timeGame = DEFAULT_GAME_TIME,
  sport: SportId = DEFAULT_SPORT,
): ScoreboardCore {
  return {
    sport,
    stateVersion: 1,
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
    showBranding: true,
  }
}

export function normalizeRoster(raw: unknown): RosterPlayer[] {
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

export function normalizeGoals(raw: unknown): GoalEvent[] {
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

export function normalizeScoreboardCore(
  source: Partial<ScoreboardCore> & Record<string, unknown>,
  base: ScoreboardCore,
): ScoreboardCore {
  return {
    ...base,
    sport: parseSportId(source.sport ?? base.sport),
    stateVersion:
      typeof source.stateVersion === 'number' ? source.stateVersion : base.stateVersion,
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
    showBranding:
      typeof source.showBranding === 'boolean' ? source.showBranding : base.showBranding,
    rosterLocal: normalizeRoster(source.rosterLocal),
    rosterVisit: normalizeRoster(source.rosterVisit),
    goals: normalizeGoals(source.goals),
  }
}
