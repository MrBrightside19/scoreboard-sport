import { generateId } from '@/utils/id'
import { findPlayerById, playerLabel } from '@/utils/roster'
import type { ScoreboardState } from '@/sports/scoreboardState'
import {
  FOOTBALL_MAX_STOPPAGE_MINUTES,
  type FootballCardKind,
} from '@/sports/football/types'
import { clockDirection } from '@/sports/clockRules'
import { interpolateClock } from '@/utils/clock'

export function cardCount(
  state: ScoreboardState,
  team: 'local' | 'visit',
  kind?: FootballCardKind,
): number {
  return (state.footballCards ?? []).filter(
    (card) => card.team === team && (!kind || card.kind === kind),
  ).length
}

export function playerYellowCount(
  state: ScoreboardState,
  team: 'local' | 'visit',
  playerId: string,
): number {
  if (!playerId) return 0
  return (state.footballCards ?? []).filter(
    (card) =>
      card.team === team &&
      card.kind === 'yellow' &&
      card.playerId === playerId,
  ).length
}

export function isPlayerExpelled(
  state: ScoreboardState,
  team: 'local' | 'visit',
  playerId: string,
): boolean {
  if (!playerId) return false
  return (state.footballCards ?? []).some(
    (card) =>
      card.team === team &&
      card.kind === 'red' &&
      card.playerId === playerId,
  )
}

export interface AddFootballCardResult {
  patch: Partial<ScoreboardState>
  secondYellowExpulsion: boolean
  blockedReason?: 'already_expelled' | 'player_required'
}

export function addFootballCard(
  state: ScoreboardState,
  team: 'local' | 'visit',
  kind: FootballCardKind,
  playerId: string,
): AddFootballCardResult {
  const roster = team === 'local' ? state.rosterLocal : state.rosterVisit
  const player = findPlayerById(roster, playerId)
  const label = player ? playerLabel(player) : ''
  const now = new Date().toISOString()
  const cards = [...(state.footballCards ?? [])]
  const gameMinute = interpolateClock(
    state.timeGame,
    state.isPaused,
    state.updatedAt,
    Date.now(),
    clockDirection(state.sport),
  )

  if (playerId && isPlayerExpelled(state, team, playerId)) {
    return {
      patch: {},
      secondYellowExpulsion: false,
      blockedReason: 'already_expelled',
    }
  }

  if (kind === 'yellow' && !playerId) {
    return {
      patch: {},
      secondYellowExpulsion: false,
      blockedReason: 'player_required',
    }
  }

  const base = {
    team,
    playerId,
    player: label,
    period: state.gamePeriod,
    gameMinute,
    createdAt: now,
  }

  if (kind === 'yellow') {
    const priorYellows = playerYellowCount(state, team, playerId)
    cards.push({
      id: generateId(),
      ...base,
      kind: 'yellow',
    })
    if (priorYellows >= 1) {
      cards.push({
        id: generateId(),
        ...base,
        kind: 'red',
        fromSecondYellow: true,
      })
      return {
        patch: { footballCards: cards },
        secondYellowExpulsion: true,
      }
    }
    return {
      patch: { footballCards: cards },
      secondYellowExpulsion: false,
    }
  }

  cards.push({
    id: generateId(),
    ...base,
    kind: 'red',
  })
  return {
    patch: { footballCards: cards },
    secondYellowExpulsion: false,
  }
}

export function undoLastFootballCard(
  state: ScoreboardState,
  team: 'local' | 'visit',
): Partial<ScoreboardState> | null {
  const cards = [...(state.footballCards ?? [])]
  const index = [...cards].reverse().findIndex((item) => item.team === team)
  if (index < 0) return null
  const realIndex = cards.length - 1 - index
  const removed = cards[realIndex]

  cards.splice(realIndex, 1)

  // Si era roja por doble amarilla, quitar también la 2.ª amarilla del mismo jugador.
  if (removed?.kind === 'red' && removed.fromSecondYellow && removed.playerId) {
    for (let i = cards.length - 1; i >= 0; i -= 1) {
      const card = cards[i]
      if (
        card.team === team &&
        card.kind === 'yellow' &&
        card.playerId === removed.playerId
      ) {
        cards.splice(i, 1)
        break
      }
    }
  }

  return { footballCards: cards }
}

export function footballStoppageMinutes(state: ScoreboardState): number {
  if (state.sport !== 'football') return 0
  const raw = state.footballStoppageMinutes
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return 0
  return Math.max(0, Math.min(FOOTBALL_MAX_STOPPAGE_MINUTES, Math.floor(raw)))
}

/** Etiqueta del cartel (`+4`), o null si no debe verse en el marcador. */
export function footballStoppageLabel(state: ScoreboardState): string | null {
  if (state.intermissionActive) return null
  const minutes = footballStoppageMinutes(state)
  if (minutes <= 0) return null
  return `+${minutes}`
}

export function clampFootballStoppage(minutes: number): number {
  if (!Number.isFinite(minutes)) return 0
  return Math.max(0, Math.min(FOOTBALL_MAX_STOPPAGE_MINUTES, Math.floor(minutes)))
}
