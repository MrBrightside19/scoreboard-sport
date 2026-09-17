import { generateId } from '@/utils/id'
import { findPlayerById, playerLabel } from '@/utils/roster'
import type { ScoreboardState } from '@/sports/scoreboardState'
import type {
  BasketballFoulKind,
  BasketballPoints,
  ReboundKind,
} from '@/sports/basketball/types'
import {
  BASKETBALL_BONUS_FOULS,
  BASKETBALL_PLAYER_FOUL_LIMIT,
} from '@/sports/basketball/types'

function countsForTeamFoul(kind: BasketballFoulKind): boolean {
  return kind === 'personal' || kind === 'unsportsmanlike' || kind === 'disqualifying'
}

export function teamFoulsInPeriod(
  state: ScoreboardState,
  team: 'local' | 'visit',
  period = state.gamePeriod,
): number {
  return (state.basketballFouls ?? []).filter(
    (foul) =>
      foul.team === team &&
      foul.period === period &&
      countsForTeamFoul(foul.kind),
  ).length
}

/** El equipo está en bonus si el rival ya cometió 5 faltas de equipo en el cuarto. */
export function isInBonus(
  state: ScoreboardState,
  team: 'local' | 'visit',
  period = state.gamePeriod,
): boolean {
  const opponent = team === 'local' ? 'visit' : 'local'
  return teamFoulsInPeriod(state, opponent, period) >= BASKETBALL_BONUS_FOULS
}

export function playerFoulCount(
  state: ScoreboardState,
  playerId: string,
): number {
  if (!playerId) return 0
  return (state.basketballFouls ?? []).filter(
    (foul) => foul.playerId === playerId && countsForTeamFoul(foul.kind),
  ).length
}

export function reboundCount(
  state: ScoreboardState,
  team: 'local' | 'visit',
  kind?: ReboundKind,
): number {
  return (state.rebounds ?? []).filter(
    (item) => item.team === team && (!kind || item.kind === kind),
  ).length
}

export function addBasketballScore(
  state: ScoreboardState,
  team: 'local' | 'visit',
  points: BasketballPoints,
  scorerPlayerId = '',
  assistPlayerId: string | null = null,
): Partial<ScoreboardState> {
  const event = {
    id: generateId(),
    team,
    points,
    scorerPlayerId,
    assistPlayerId,
    period: state.gamePeriod,
    gameMinute: state.timeGame,
    createdAt: new Date().toISOString(),
  }
  return {
    basketballScores: [...(state.basketballScores ?? []), event],
    goalLocal: state.goalLocal + (team === 'local' ? points : 0),
    goalVisit: state.goalVisit + (team === 'visit' ? points : 0),
  }
}

export function undoLastBasketballScore(
  state: ScoreboardState,
  team: 'local' | 'visit',
): Partial<ScoreboardState> | null {
  const scores = [...(state.basketballScores ?? [])]
  const index = [...scores].reverse().findIndex((item) => item.team === team)
  if (index < 0) return null
  const realIndex = scores.length - 1 - index
  const [removed] = scores.splice(realIndex, 1)
  if (!removed) return null
  return {
    basketballScores: scores,
    goalLocal: Math.max(0, state.goalLocal - (team === 'local' ? removed.points : 0)),
    goalVisit: Math.max(0, state.goalVisit - (team === 'visit' ? removed.points : 0)),
  }
}

export function addRebound(
  state: ScoreboardState,
  team: 'local' | 'visit',
  kind: ReboundKind,
  playerId: string,
): Partial<ScoreboardState> {
  return {
    rebounds: [
      ...(state.rebounds ?? []),
      {
        id: generateId(),
        team,
        playerId,
        kind,
        period: state.gamePeriod,
        gameMinute: state.timeGame,
        createdAt: new Date().toISOString(),
      },
    ],
  }
}

export function undoLastRebound(
  state: ScoreboardState,
  team: 'local' | 'visit',
): Partial<ScoreboardState> | null {
  const items = [...(state.rebounds ?? [])]
  const index = [...items].reverse().findIndex((item) => item.team === team)
  if (index < 0) return null
  items.splice(items.length - 1 - index, 1)
  return { rebounds: items }
}

export function addBasketballFoul(
  state: ScoreboardState,
  team: 'local' | 'visit',
  kind: BasketballFoulKind,
  playerId: string,
): Partial<ScoreboardState> {
  const roster = team === 'local' ? state.rosterLocal : state.rosterVisit
  const player = findPlayerById(roster, playerId)
  return {
    basketballFouls: [
      ...(state.basketballFouls ?? []),
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

export function undoLastFoul(
  state: ScoreboardState,
  team: 'local' | 'visit',
): Partial<ScoreboardState> | null {
  const items = [...(state.basketballFouls ?? [])]
  const index = [...items].reverse().findIndex((item) => item.team === team)
  if (index < 0) return null
  items.splice(items.length - 1 - index, 1)
  return { basketballFouls: items }
}

export function playerFoulLimitReached(
  state: ScoreboardState,
  playerId: string,
): boolean {
  return playerFoulCount(state, playerId) >= BASKETBALL_PLAYER_FOUL_LIMIT
}
