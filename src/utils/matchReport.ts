import type { ScoreboardState } from '@/types/hockeyScoreboard'
import { normalizeScoreboardState } from '@/types/hockeyScoreboard'
import type { TournamentMatch } from '@/types/tournament'
import { findPlayerById, playerLabel } from '@/utils/roster'
import { penaltyTypeLabel } from '@/data/penaltyCatalog'
import {
  matchAwards,
  playerStatsFromState,
  type MatchAwards,
  type PlayerStatLine,
} from '@/utils/playerStats'

export interface MatchReportMeta {
  localTeam: string
  visitTeam: string
  category: string
  court: string
  status: TournamentMatch['status'] | string
  matchId: string | null
  tournamentMatchId?: string
}

export interface MatchReportGoalRow {
  team: 'local' | 'visit'
  teamName: string
  period: number
  gameMinute: string
  scorer: string
  assist: string
  status: string
}

export interface MatchReportShotRow {
  team: 'local' | 'visit'
  teamName: string
  result: 'miss' | 'save'
  resultLabel: string
  period: number
  gameMinute: string
}

export interface MatchReportPenaltyRow {
  team: 'local' | 'visit'
  teamName: string
  player: string
  type: string
  infraction: string
  time: string
}

export interface MatchReportOfficials {
  referee1: string
  referee2: string
  tableOfficial1: string
  tableOfficial2: string
  tableOfficial3: string
}

export interface MatchReport {
  meta: MatchReportMeta
  officials: MatchReportOfficials
  goalLocal: number
  goalVisit: number
  gamePeriod: number
  shotsMissLocal: number
  shotsMissVisit: number
  savesLocal: number
  savesVisit: number
  goals: MatchReportGoalRow[]
  shots: MatchReportShotRow[]
  penalties: MatchReportPenaltyRow[]
  playerStats: PlayerStatLine[]
  awards: MatchAwards
}

export function emptyMatchOfficials(): MatchReportOfficials {
  return {
    referee1: '',
    referee2: '',
    tableOfficial1: '',
    tableOfficial2: '',
    tableOfficial3: '',
  }
}

/** Nombres de mesa no vacíos, unidos para resúmenes compactos. */
export function formatTableOfficials(officials: MatchReportOfficials): string {
  return [officials.tableOfficial1, officials.tableOfficial2, officials.tableOfficial3]
    .map((name) => name.trim())
    .filter(Boolean)
    .join(', ')
}

export function hasMatchOfficials(officials: MatchReportOfficials): boolean {
  return Boolean(
    officials.referee1.trim() ||
      officials.referee2.trim() ||
      officials.tableOfficial1.trim() ||
      officials.tableOfficial2.trim() ||
      officials.tableOfficial3.trim(),
  )
}

export function matchReportMetaFromTournamentMatch(tm: TournamentMatch): MatchReportMeta {
  return {
    localTeam: tm.local_team,
    visitTeam: tm.visit_team,
    category: tm.category ?? '',
    court: tm.court,
    status: tm.status,
    matchId: tm.match_id,
    tournamentMatchId: tm.id,
  }
}

export function buildMatchReport(
  meta: MatchReportMeta,
  rawState: unknown,
): MatchReport {
  const state = normalizeScoreboardState(rawState ?? {})
  const localTeam = state.localTeam || meta.localTeam
  const visitTeam = state.visitTeam || meta.visitTeam

  const teamName = (team: 'local' | 'visit') =>
    team === 'local' ? localTeam : visitTeam

  const goals: MatchReportGoalRow[] = state.goals.map((goal) => {
    const roster = goal.team === 'local' ? state.rosterLocal : state.rosterVisit
    const scorer = findPlayerById(roster, goal.scorerPlayerId)
    const assist = goal.assistPlayerId
      ? findPlayerById(roster, goal.assistPlayerId)
      : undefined
    return {
      team: goal.team,
      teamName: teamName(goal.team),
      period: goal.period,
      gameMinute: goal.gameMinute,
      scorer: scorer ? playerLabel(scorer) : '—',
      assist: assist ? playerLabel(assist) : '—',
      status: goal.status === 'confirmed' && goal.scorerPlayerId ? 'Confirmado' : 'Pendiente',
    }
  })

  const shots: MatchReportShotRow[] = state.shots.map((shot) => ({
    team: shot.team,
    teamName: teamName(shot.team),
    result: shot.result,
    resultLabel: shot.result === 'save' ? 'Atajada' : 'Tiro',
    period: shot.period,
    gameMinute: shot.gameMinute,
  }))

  const mapPenalties = (
    team: 'local' | 'visit',
    list: ScoreboardState['penaltiesLocal'],
  ): MatchReportPenaltyRow[] =>
    list.map((penalty) => ({
      team,
      teamName: teamName(team),
      player: penalty.player || '—',
      type: penaltyTypeLabel(penalty.penaltyTypeId),
      infraction: penalty.infraction || '—',
      time: penalty.time,
    }))

  const playerStats = playerStatsFromState(
    { ...state, localTeam, visitTeam },
    meta.category,
  )

  return {
    meta: {
      ...meta,
      localTeam,
      visitTeam,
    },
    officials: {
      referee1: state.referee1.trim(),
      referee2: state.referee2.trim(),
      tableOfficial1: state.tableOfficial1.trim(),
      tableOfficial2: state.tableOfficial2.trim(),
      tableOfficial3: state.tableOfficial3.trim(),
    },
    goalLocal: state.goalLocal,
    goalVisit: state.goalVisit,
    gamePeriod: state.gamePeriod,
    shotsMissLocal: state.shots.filter((s) => s.team === 'local' && s.result === 'miss').length,
    shotsMissVisit: state.shots.filter((s) => s.team === 'visit' && s.result === 'miss').length,
    savesLocal: state.shots.filter((s) => s.team === 'local' && s.result === 'save').length,
    savesVisit: state.shots.filter((s) => s.team === 'visit' && s.result === 'save').length,
    goals,
    shots,
    penalties: [
      ...mapPenalties('local', state.penaltiesLocal),
      ...mapPenalties('visit', state.penaltiesVisit),
    ],
    playerStats,
    awards: matchAwards(playerStats),
  }
}

export function buildMatchReportFromFinishedScores(
  meta: MatchReportMeta,
  goalLocal: number,
  goalVisit: number,
): MatchReport {
  return {
    meta,
    officials: emptyMatchOfficials(),
    goalLocal,
    goalVisit,
    gamePeriod: 0,
    shotsMissLocal: 0,
    shotsMissVisit: 0,
    savesLocal: 0,
    savesVisit: 0,
    goals: [],
    shots: [],
    penalties: [],
    playerStats: [],
    awards: { topScorer: null, topAssists: null, topGoalkeeper: null },
  }
}
