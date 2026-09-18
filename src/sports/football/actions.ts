import { generateId } from '@/utils/id'
import { findPlayerById, playerLabel } from '@/utils/roster'
import type { ScoreboardState } from '@/sports/scoreboardState'
import type { FootballCardKind } from '@/sports/football/types'
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
