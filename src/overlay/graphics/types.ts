import type { SportId } from '@/types/sport'

export type OverlayGraphicKind = 'lineup' | 'break'

export interface OverlayTeamSide {
  name: string
  shortName: string
  logo: string
  color: string
  score: number
}

export interface OverlayLineupPlayer {
  number: string
  name: string
  role?: 'goalkeeper' | 'captain' | 'assistant_captain' | 'player'
}

export interface OverlayLineupModel {
  sport: SportId
  sportLabel: string
  category: string
  local: OverlayTeamSide
  visit: OverlayTeamSide
  localRoster: OverlayLineupPlayer[]
  visitRoster: OverlayLineupPlayer[]
}

export interface OverlayEventRow {
  number: string
  player: string
  minute: string
  extra?: string
}

export type OverlayCardKind = 'yellow' | 'red' | 'blue'

export interface OverlayCardRow {
  number: string
  player: string
  minute: string
  kind: OverlayCardKind
}

export interface OverlayStatRow {
  key: string
  label: string
  local: string
  visit: string
}

export interface OverlayBreakModel {
  sport: SportId
  sportLabel: string
  heading: string
  local: OverlayTeamSide
  visit: OverlayTeamSide
  stats: OverlayStatRow[]
  scorers: { local: OverlayEventRow[]; visit: OverlayEventRow[] }
  cards?: { local: OverlayCardRow[]; visit: OverlayCardRow[] }
  fouls?: { local: OverlayEventRow[]; visit: OverlayEventRow[] }
}
