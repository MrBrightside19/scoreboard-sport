import { getSportModule } from '@/sports/registry'
import type { ScoreboardState } from '@/sports/scoreboardState'
import { parseTimeToSeconds } from '@/utils/clock'
import type { SportId } from '@/types/sport'

export function clockDirection(sportId: string): 'down' | 'up' {
  return getSportModule(sportId).clock.direction
}

export function kickoffClock(sportId: string): string {
  const sport = getSportModule(sportId)
  return sport.clock.direction === 'up' ? '00:00' : sport.clock.defaultPeriodTime
}

/** Segundos reglamentarios del periodo actual (45′ / 15′ en fútbol, etc.). */
export function regulationClockSeconds(
  state: Pick<ScoreboardState, 'sport' | 'gamePeriod'>,
): number {
  const sport = getSportModule(state.sport)
  const raw =
    sport.clock.overtimePeriodTime && state.gamePeriod > sport.clock.periods
      ? sport.clock.overtimePeriodTime
      : sport.clock.defaultPeriodTime
  return parseTimeToSeconds(raw)
}

export function isCountUpSport(sportId: SportId | string): boolean {
  return clockDirection(sportId) === 'up'
}

/** Segundos que restan del periodo (cuenta atrás = el reloj; cuenta arriba = cupo − transcurrido). */
export function remainingClockSeconds(
  state: Pick<ScoreboardState, 'sport' | 'gamePeriod' | 'timeGame'>,
): number {
  const elapsed = parseTimeToSeconds(state.timeGame)
  if (!isCountUpSport(state.sport)) return elapsed
  return Math.max(0, regulationClockSeconds(state) - elapsed)
}

export function isRegulationElapsed(
  state: Pick<ScoreboardState, 'sport' | 'gamePeriod' | 'timeGame'>,
): boolean {
  if (!isCountUpSport(state.sport)) {
    return parseTimeToSeconds(state.timeGame) <= 0
  }
  return parseTimeToSeconds(state.timeGame) >= regulationClockSeconds(state)
}
