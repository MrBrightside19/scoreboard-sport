import { generateId } from '@/utils/id'
import { findPlayerById, playerLabel } from '@/utils/roster'
import type { ScoreboardState } from '@/sports/scoreboardState'
import type { FutsalCardKind } from '@/sports/futsal/types'
import {
  FUTSAL_ACCUMULATED_FOUL_LIMIT,
  FUTSAL_EXCLUSION_TIME,
  FUTSAL_TIMEOUTS_PER_PERIOD,
} from '@/sports/futsal/types'

export function accumulatedFoulsInPeriod(
  state: ScoreboardState,
  team: 'local' | 'visit',
  period = state.gamePeriod,
): number {
  return (state.futsalAccumulatedFouls ?? []).filter(
    (foul) => foul.team === team && foul.period === period,
  ).length
}

/** Desde la 6.ª falta acumulada del tiempo → doble penalti / libre directo sin barrera. */
export function isInDoublePenalty(
  state: ScoreboardState,
  team: 'local' | 'visit',
  period = state.gamePeriod,
): boolean {
  return accumulatedFoulsInPeriod(state, team, period) >= FUTSAL_ACCUMULATED_FOUL_LIMIT
}

export function timeoutsUsedInPeriod(
  state: ScoreboardState,
  team: 'local' | 'visit',
  period = state.gamePeriod,
): number {
  return (state.futsalTimeouts ?? []).filter(
    (item) => item.team === team && item.period === period,
  ).length
}

export function canUseTimeout(
  state: ScoreboardState,
  team: 'local' | 'visit',
  period = state.gamePeriod,
): boolean {
  return timeoutsUsedInPeriod(state, team, period) < FUTSAL_TIMEOUTS_PER_PERIOD
}

export function activeExclusions(
  state: ScoreboardState,
  team?: 'local' | 'visit',
) {
  return (state.futsalExclusions ?? []).filter(
    (item) => !team || item.team === team,
  )
}

export function addAccumulatedFoul(
  state: ScoreboardState,
  team: 'local' | 'visit',
  playerId = '',
): Partial<ScoreboardState> {
  const roster = team === 'local' ? state.rosterLocal : state.rosterVisit
  const player = findPlayerById(roster, playerId)
  return {
    futsalAccumulatedFouls: [
      ...(state.futsalAccumulatedFouls ?? []),
      {
        id: generateId(),
        team,
        playerId,
        player: player ? playerLabel(player) : '',
        period: state.gamePeriod,
        gameMinute: state.timeGame,
        createdAt: new Date().toISOString(),
      },
    ],
  }
}

export function undoLastAccumulatedFoul(
  state: ScoreboardState,
  team: 'local' | 'visit',
): Partial<ScoreboardState> | null {
  const items = [...(state.futsalAccumulatedFouls ?? [])]
  const index = [...items].reverse().findIndex(
    (item) => item.team === team && item.period === state.gamePeriod,
  )
  if (index < 0) return null
  items.splice(items.length - 1 - index, 1)
  return { futsalAccumulatedFouls: items }
}

export function addFutsalCard(
  state: ScoreboardState,
  team: 'local' | 'visit',
  kind: FutsalCardKind,
  playerId: string,
): Partial<ScoreboardState> {
  const roster = team === 'local' ? state.rosterLocal : state.rosterVisit
  const player = findPlayerById(roster, playerId)
  const label = player ? playerLabel(player) : ''
  const next: Partial<ScoreboardState> = {
    futsalCards: [
      ...(state.futsalCards ?? []),
      {
        id: generateId(),
        team,
        playerId,
        player: label,
        kind,
        period: state.gamePeriod,
        gameMinute: state.timeGame,
        createdAt: new Date().toISOString(),
      },
    ],
  }

  if (kind === 'blue') {
    next.futsalExclusions = [
      ...(state.futsalExclusions ?? []),
      {
        id: generateId(),
        team,
        playerId,
        player: label,
        time: FUTSAL_EXCLUSION_TIME,
        period: state.gamePeriod,
        createdAt: new Date().toISOString(),
      },
    ]
  }

  return next
}

export function undoLastFutsalCard(
  state: ScoreboardState,
  team: 'local' | 'visit',
): Partial<ScoreboardState> | null {
  const cards = [...(state.futsalCards ?? [])]
  const index = [...cards].reverse().findIndex((item) => item.team === team)
  if (index < 0) return null
  const realIndex = cards.length - 1 - index
  const [removed] = cards.splice(realIndex, 1)
  if (!removed) return null

  let exclusions = [...(state.futsalExclusions ?? [])]
  if (removed.kind === 'blue') {
    const exIndex = [...exclusions]
      .reverse()
      .findIndex(
        (item) =>
          item.team === team &&
          (item.playerId === removed.playerId || item.player === removed.player),
      )
    if (exIndex >= 0) exclusions.splice(exclusions.length - 1 - exIndex, 1)
  }

  return { futsalCards: cards, futsalExclusions: exclusions }
}

export function addTimeout(
  state: ScoreboardState,
  team: 'local' | 'visit',
): Partial<ScoreboardState> | null {
  if (!canUseTimeout(state, team)) return null
  return {
    futsalTimeouts: [
      ...(state.futsalTimeouts ?? []),
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

export function undoLastTimeout(
  state: ScoreboardState,
  team: 'local' | 'visit',
): Partial<ScoreboardState> | null {
  const items = [...(state.futsalTimeouts ?? [])]
  const index = [...items].reverse().findIndex(
    (item) => item.team === team && item.period === state.gamePeriod,
  )
  if (index < 0) return null
  items.splice(items.length - 1 - index, 1)
  return { futsalTimeouts: items }
}

/** Al marcar, se puede liberar una exclusión del equipo que recibió el gol. */
export function releaseOneExclusion(
  state: ScoreboardState,
  team: 'local' | 'visit',
): Partial<ScoreboardState> | null {
  const items = [...(state.futsalExclusions ?? [])]
  const index = items.findIndex((item) => item.team === team)
  if (index < 0) return null
  items.splice(index, 1)
  return { futsalExclusions: items }
}

export function removeExclusion(
  state: ScoreboardState,
  exclusionId: string,
): Partial<ScoreboardState> {
  return {
    futsalExclusions: (state.futsalExclusions ?? []).filter(
      (item) => item.id !== exclusionId,
    ),
  }
}
