import type { ScoreboardState } from '@/types/hockeyScoreboard'
import { isGoalPending } from '@/types/hockeyScoreboard'
import { findPlayerById, playerLabel } from '@/utils/roster'

export interface PlayerStatLine {
  /** Clave estable entre partidos: equipo + número. */
  key: string
  team: string
  number: string
  name: string
  label: string
  category: string
  goals: number
  assists: number
  saves: number
}

export interface AwardWinner {
  label: string
  team: string
  value: number
}

export interface MatchAwards {
  topScorer: AwardWinner | null
  topAssists: AwardWinner | null
  topGoalkeeper: AwardWinner | null
}

function statKey(team: string, number: string, name: string): string {
  const normalizedTeam = team.trim().toLowerCase()
  const normalizedNumber = number.trim()
  if (normalizedNumber) return `${normalizedTeam}|#${normalizedNumber}`
  return `${normalizedTeam}|${name.trim().toLowerCase()}`
}

function emptyLine(
  key: string,
  team: string,
  number: string,
  name: string,
  label: string,
  category: string,
): PlayerStatLine {
  return { key, team, number, name, label, category, goals: 0, assists: 0, saves: 0 }
}

/**
 * Estadísticas por jugador de un partido. Los ids del roster se regeneran en
 * cada partido, por eso la clave combina equipo y número.
 */
export function playerStatsFromState(
  state: ScoreboardState,
  category = '',
): PlayerStatLine[] {
  const lines = new Map<string, PlayerStatLine>()
  const resolvedCategory = category || state.matchCategory || ''

  const touch = (team: 'local' | 'visit', playerId: string): PlayerStatLine | null => {
    if (!playerId) return null
    const roster = team === 'local' ? state.rosterLocal : state.rosterVisit
    const player = findPlayerById(roster, playerId)
    if (!player) return null

    const teamName = team === 'local' ? state.localTeam : state.visitTeam
    const fullName = `${player.name} ${player.lastName}`.trim()
    const key = statKey(teamName, player.number, fullName)
    const existing = lines.get(key)
    if (existing) return existing

    const line = emptyLine(
      key,
      teamName,
      player.number,
      fullName,
      playerLabel(player),
      resolvedCategory,
    )
    lines.set(key, line)
    return line
  }

  for (const goal of state.goals) {
    if (isGoalPending(goal)) continue
    const scorer = touch(goal.team, goal.scorerPlayerId)
    if (scorer) scorer.goals += 1
    if (goal.assistPlayerId) {
      const assist = touch(goal.team, goal.assistPlayerId)
      if (assist) assist.assists += 1
    }
  }

  for (const shot of state.shots) {
    if (shot.result !== 'save') continue
    const keeper = touch(shot.team, shot.goalkeeperPlayerId)
    if (keeper) keeper.saves += 1
  }

  return [...lines.values()]
}

/** Suma líneas de varios partidos manteniendo la clave equipo + número. */
export function mergePlayerStats(groups: PlayerStatLine[][]): PlayerStatLine[] {
  const merged = new Map<string, PlayerStatLine>()

  for (const group of groups) {
    for (const line of group) {
      const existing = merged.get(line.key)
      if (!existing) {
        merged.set(line.key, { ...line })
        continue
      }
      existing.goals += line.goals
      existing.assists += line.assists
      existing.saves += line.saves
      if (!existing.category) existing.category = line.category
    }
  }

  return [...merged.values()]
}

export type StatMetric = 'goals' | 'assists' | 'saves'

/** Ranking descendente por métrica; descarta a quienes tienen cero. */
export function rankPlayers(
  lines: PlayerStatLine[],
  metric: StatMetric,
  limit: number,
): PlayerStatLine[] {
  return lines
    .filter((line) => line[metric] > 0)
    .sort((a, b) => {
      if (b[metric] !== a[metric]) return b[metric] - a[metric]
      return a.label.localeCompare(b.label)
    })
    .slice(0, limit)
}

function toWinner(line: PlayerStatLine | undefined, metric: StatMetric): AwardWinner | null {
  if (!line) return null
  return { label: line.label, team: line.team, value: line[metric] }
}

export function matchAwards(lines: PlayerStatLine[]): MatchAwards {
  return {
    topScorer: toWinner(rankPlayers(lines, 'goals', 1)[0], 'goals'),
    topAssists: toWinner(rankPlayers(lines, 'assists', 1)[0], 'assists'),
    topGoalkeeper: toWinner(rankPlayers(lines, 'saves', 1)[0], 'saves'),
  }
}

export interface CategoryAwards {
  category: string
  topScorers: PlayerStatLine[]
  topAssists: PlayerStatLine[]
  topGoalkeepers: PlayerStatLine[]
}

/** Top N por categoría para premiar goleador, asistencias y arquero. */
export function awardsByCategory(
  entries: Array<{ category: string; lines: PlayerStatLine[] }>,
  limit = 3,
): CategoryAwards[] {
  const grouped = new Map<string, PlayerStatLine[][]>()

  for (const entry of entries) {
    const category = entry.category.trim() || 'Sin categoría'
    const bucket = grouped.get(category) ?? []
    bucket.push(entry.lines)
    grouped.set(category, bucket)
  }

  return [...grouped.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([category, groups]) => {
      const lines = mergePlayerStats(groups)
      return {
        category,
        topScorers: rankPlayers(lines, 'goals', limit),
        topAssists: rankPlayers(lines, 'assists', limit),
        topGoalkeepers: rankPlayers(lines, 'saves', limit),
      }
    })
}
