import { PLAYGROUND_BREAKS, PLAYGROUND_LINEUPS } from '@/overlay/graphics/mockData'
import { getSportModule } from '@/sports/registry'
import type { RosterPlayer, ScoreboardState } from '@/sports/scoreboardState'
import type { OverlayLineupPlayer } from '@/overlay/graphics/types'
import type { SportId } from '@/types/sport'

function toRoster(rows: OverlayLineupPlayer[]): RosterPlayer[] {
  return rows.map((player) => ({
    id: `pg-${player.number}-${player.name}`,
    number: player.number,
    name: player.name,
    role: player.role ?? 'player',
  }))
}

const LIVE_CLOCK: Record<SportId, { period: number; time: string }> = {
  hockey: { period: 2, time: '14:22' },
  football: { period: 1, time: '23:41' },
  futsal: { period: 1, time: '12:08' },
  basketball: { period: 2, time: '06:40' },
}

export function playgroundLiveState(sport: SportId): ScoreboardState {
  const lineup = PLAYGROUND_LINEUPS[sport]
  const half = PLAYGROUND_BREAKS[sport]
  const clock = LIVE_CLOCK[sport]
  const state = getSportModule(sport).createDefaultState(
    lineup.local.name,
    lineup.visit.name,
  )

  state.localLogo = lineup.local.logo
  state.visitLogo = lineup.visit.logo
  state.localColor = lineup.local.color
  state.visitColor = lineup.visit.color
  state.matchCategory = lineup.category
  state.goalLocal = half.local.score
  state.goalVisit = half.visit.score
  state.gamePeriod = clock.period
  state.timeGame = clock.time
  state.isPaused = false
  state.intermissionActive = false
  state.showBranding = false
  state.rosterLocal = toRoster(lineup.localRoster)
  state.rosterVisit = toRoster(lineup.visitRoster)

  if (sport === 'football' && half.cards) {
    state.footballCards = [
      ...half.cards.local.map((card) => ({
        id: `pg-card-l-${card.number}`,
        team: 'local' as const,
        playerId: `pg-${card.number}-${card.player}`,
        player: card.player,
        kind: card.kind === 'red' ? ('red' as const) : ('yellow' as const),
        period: 1,
        gameMinute: card.minute,
        createdAt: new Date().toISOString(),
      })),
      ...half.cards.visit.map((card) => ({
        id: `pg-card-v-${card.number}`,
        team: 'visit' as const,
        playerId: `pg-${card.number}-${card.player}`,
        player: card.player,
        kind: card.kind === 'red' ? ('red' as const) : ('yellow' as const),
        period: 1,
        gameMinute: card.minute,
        createdAt: new Date().toISOString(),
      })),
    ]
  }

  return state
}
