import type { StandingRow } from '@/types/tournament'

interface MatchResult {
  local: string
  visit: string
  goalLocal: number
  goalVisit: number
}

export function calculateStandings(matches: MatchResult[]): StandingRow[] {
  const table = new Map<string, StandingRow>()

  const ensureTeam = (team: string): StandingRow => {
    if (!table.has(team)) {
      table.set(team, {
        team,
        played: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        goalDiff: 0,
        points: 0,
      })
    }
    return table.get(team)!
  }

  for (const match of matches) {
    const local = ensureTeam(match.local)
    const visit = ensureTeam(match.visit)

    local.played += 1
    visit.played += 1
    local.goalsFor += match.goalLocal
    local.goalsAgainst += match.goalVisit
    visit.goalsFor += match.goalVisit
    visit.goalsAgainst += match.goalLocal

    if (match.goalLocal > match.goalVisit) {
      local.wins += 1
      local.points += 3
      visit.losses += 1
    } else if (match.goalLocal < match.goalVisit) {
      visit.wins += 1
      visit.points += 3
      local.losses += 1
    } else {
      local.draws += 1
      visit.draws += 1
      local.points += 1
      visit.points += 1
    }
  }

  return [...table.values()]
    .map((row) => ({
      ...row,
      goalDiff: row.goalsFor - row.goalsAgainst,
    }))
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points
      if (b.goalDiff !== a.goalDiff) return b.goalDiff - a.goalDiff
      return b.goalsFor - a.goalsFor
    })
}
