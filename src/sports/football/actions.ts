import { generateId } from '@/utils/id'
import { findPlayerById, playerLabel } from '@/utils/roster'
import type { ScoreboardState } from '@/sports/scoreboardState'
import type { FootballCardKind } from '@/sports/football/types'

export function cardCount(
  state: ScoreboardState,
  team: 'local' | 'visit',
  kind?: FootballCardKind,
): number {
  return (state.footballCards ?? []).filter(
    (card) => card.team === team && (!kind || card.kind === kind),
  ).length
}

export function addFootballCard(
  state: ScoreboardState,
  team: 'local' | 'visit',
  kind: FootballCardKind,
  playerId: string,
): Partial<ScoreboardState> {
  const roster = team === 'local' ? state.rosterLocal : state.rosterVisit
  const player = findPlayerById(roster, playerId)
  return {
    footballCards: [
      ...(state.footballCards ?? []),
      {
        id: generateId(),
        team,
        playerId,
        player: player ? playerLabel(player) : '',
        kind,
        period: state.gamePeriod,
        gameMinute: state.timeGame,
        createdAt: new Date().toISOString(),
      },
    ],
  }
}

export function undoLastFootballCard(
  state: ScoreboardState,
  team: 'local' | 'visit',
): Partial<ScoreboardState> | null {
  const cards = [...(state.footballCards ?? [])]
  const index = [...cards].reverse().findIndex((item) => item.team === team)
  if (index < 0) return null
  cards.splice(cards.length - 1 - index, 1)
  return { footballCards: cards }
}
