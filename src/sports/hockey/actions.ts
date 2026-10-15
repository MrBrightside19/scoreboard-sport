import { generateId } from '@/utils/id'
import type { ScoreboardState } from '@/sports/scoreboardState'
import {
  HOCKEY_TIMEOUTS_PER_PERIOD,
  type HockeyPowerPlayEvent,
} from '@/sports/hockey/state'

export function hockeyTimeoutsUsedInPeriod(
  state: ScoreboardState,
  team: 'local' | 'visit',
  period = state.gamePeriod,
): number {
  return (state.hockeyTimeouts ?? []).filter(
    (item) => item.team === team && item.period === period,
  ).length
}

export function canUseHockeyTimeout(
  state: ScoreboardState,
  team: 'local' | 'visit',
  period = state.gamePeriod,
): boolean {
  if (state.intermissionActive) return false
  return hockeyTimeoutsUsedInPeriod(state, team, period) < HOCKEY_TIMEOUTS_PER_PERIOD
}

export function addHockeyTimeout(
  state: ScoreboardState,
  team: 'local' | 'visit',
): Partial<ScoreboardState> | null {
  if (!canUseHockeyTimeout(state, team)) return null
  return {
    hockeyTimeouts: [
      ...(state.hockeyTimeouts ?? []),
      {
        id: generateId(),
        team,
        period: state.gamePeriod,
        gameMinute: state.timeGame,
        createdAt: new Date().toISOString(),
      },
    ],
    isPaused: true,
  }
}

export function undoLastHockeyTimeout(
  state: ScoreboardState,
  team: 'local' | 'visit',
): Partial<ScoreboardState> | null {
  const items = [...(state.hockeyTimeouts ?? [])]
  const index = [...items]
    .reverse()
    .findIndex((item) => item.team === team && item.period === state.gamePeriod)
  if (index < 0) return null
  items.splice(items.length - 1 - index, 1)
  return { hockeyTimeouts: items }
}

export function hasManpowerAdvantage(
  localPenalties: number,
  visitPenalties: number,
  team: 'local' | 'visit',
): boolean {
  return team === 'local' ? visitPenalties > localPenalties : localPenalties > visitPenalties
}

export function powerPlayRecord(
  state: ScoreboardState,
  team: 'local' | 'visit',
): { goals: number; opportunities: number } {
  return {
    goals: (state.hockeyPowerPlayGoals ?? []).filter((item) => item.team === team).length,
    opportunities: (state.hockeyPowerPlayOpportunities ?? []).filter(
      (item) => item.team === team,
    ).length,
  }
}

export function formatPowerPlay(state: ScoreboardState, team: 'local' | 'visit'): string {
  const { goals, opportunities } = powerPlayRecord(state, team)
  return `${goals}/${opportunities}`
}

function makePowerPlayEvent(
  state: ScoreboardState,
  team: 'local' | 'visit',
  extra: Partial<HockeyPowerPlayEvent> = {},
): HockeyPowerPlayEvent {
  return {
    id: generateId(),
    team,
    period: state.gamePeriod,
    gameMinute: state.timeGame,
    createdAt: new Date().toISOString(),
    ...extra,
  }
}

/** Cuenta una oportunidad cuando un equipo pasa a tener superioridad numérica. */
export function opportunitiesFromPenaltyChange(
  state: ScoreboardState,
  prevLocal: number,
  prevVisit: number,
  nextLocal: number,
  nextVisit: number,
): Partial<ScoreboardState> | null {
  const opportunities = [...(state.hockeyPowerPlayOpportunities ?? [])]
  let changed = false
  for (const team of ['local', 'visit'] as const) {
    const wasUp = hasManpowerAdvantage(prevLocal, prevVisit, team)
    const isUp = hasManpowerAdvantage(nextLocal, nextVisit, team)
    if (!wasUp && isUp) {
      opportunities.push(makePowerPlayEvent(state, team))
      changed = true
    }
  }
  return changed ? { hockeyPowerPlayOpportunities: opportunities } : null
}

export function recordPowerPlayGoal(
  state: ScoreboardState,
  team: 'local' | 'visit',
  goalId: string,
): Partial<ScoreboardState> | null {
  const local = state.penaltiesLocal.length
  const visit = state.penaltiesVisit.length
  if (!hasManpowerAdvantage(local, visit, team)) return null
  const goals = state.hockeyPowerPlayGoals ?? []
  if (goals.some((item) => item.goalId === goalId)) return null
  return {
    hockeyPowerPlayGoals: [...goals, makePowerPlayEvent(state, team, { goalId })],
  }
}

export function retractPowerPlayGoal(
  state: ScoreboardState,
  goalId: string,
): Partial<ScoreboardState> | null {
  const goals = state.hockeyPowerPlayGoals ?? []
  if (!goals.some((item) => item.goalId === goalId)) return null
  return {
    hockeyPowerPlayGoals: goals.filter((item) => item.goalId !== goalId),
  }
}
