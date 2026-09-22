import { getSportModule } from '@/sports/registry'
import type { ScoreboardState } from '@/sports/scoreboardState'
import { formatSecondsToTime, parseTimeToSeconds } from '@/utils/clock'
import type { SportId } from '@/types/sport'

export function clockDirection(sportId: string): 'down' | 'up' {
  return getSportModule(sportId).clock.direction
}

export function kickoffClock(sportId: string): string {
  const sport = getSportModule(sportId)
  return sport.clock.direction === 'up' ? '00:00' : sport.clock.defaultPeriodTime
}

type RegulationState = Pick<ScoreboardState, 'sport' | 'gamePeriod'> &
  Partial<Pick<ScoreboardState, 'footballPeriodLength' | 'footballStoppageMinutes'>>

/** Segundos reglamentarios del periodo actual (45′ / 15′ en fútbol, etc.). */
export function regulationClockSeconds(state: RegulationState): number {
  const sport = getSportModule(state.sport)
  if (sport.clock.overtimePeriodTime && state.gamePeriod > sport.clock.periods) {
    return parseTimeToSeconds(sport.clock.overtimePeriodTime)
  }
  if (state.sport === 'football' && state.footballPeriodLength) {
    const configured = parseTimeToSeconds(state.footballPeriodLength)
    if (configured >= 60) return configured
  }
  return parseTimeToSeconds(sport.clock.defaultPeriodTime)
}

function stoppageClockSeconds(state: RegulationState): number {
  if (state.sport !== 'football') return 0
  const minutes = state.footballStoppageMinutes
  if (typeof minutes !== 'number' || !Number.isFinite(minutes) || minutes <= 0) {
    return 0
  }
  return Math.floor(minutes) * 60
}

/** Tope del reloj: duración del tiempo + descuento. */
export function periodEndClockSeconds(state: RegulationState): number {
  return regulationClockSeconds(state) + stoppageClockSeconds(state)
}

export function clampCountUpTime(time: string, state: RegulationState): string {
  return formatSecondsToTime(
    Math.min(parseTimeToSeconds(time), periodEndClockSeconds(state)),
  )
}

export function isCountUpSport(sportId: SportId | string): boolean {
  return clockDirection(sportId) === 'up'
}

/** Segundos que restan del periodo (cuenta atrás = el reloj; cuenta arriba = cupo − transcurrido). */
export function remainingClockSeconds(
  state: Pick<ScoreboardState, 'sport' | 'gamePeriod' | 'timeGame'> &
    Partial<Pick<ScoreboardState, 'footballPeriodLength'>>,
): number {
  const elapsed = parseTimeToSeconds(state.timeGame)
  if (!isCountUpSport(state.sport)) return elapsed
  return Math.max(0, regulationClockSeconds(state) - elapsed)
}

/** Segundos que restan hasta el tope (duración + descuento en fútbol). */
export function remainingUntilPeriodEndSeconds(
  state: Pick<ScoreboardState, 'sport' | 'gamePeriod' | 'timeGame'> &
    Partial<Pick<ScoreboardState, 'footballPeriodLength' | 'footballStoppageMinutes'>>,
): number {
  const elapsed = parseTimeToSeconds(state.timeGame)
  if (!isCountUpSport(state.sport)) return elapsed
  return Math.max(0, periodEndClockSeconds(state) - elapsed)
}

export function isRegulationElapsed(
  state: Pick<ScoreboardState, 'sport' | 'gamePeriod' | 'timeGame'> &
    Partial<Pick<ScoreboardState, 'footballPeriodLength'>>,
): boolean {
  if (!isCountUpSport(state.sport)) {
    return parseTimeToSeconds(state.timeGame) <= 0
  }
  return parseTimeToSeconds(state.timeGame) >= regulationClockSeconds(state)
}

/** El tiempo (y su descuento) ya se cumplió: ahí corresponde el descanso. */
export function isPeriodPlayFinished(
  state: Pick<ScoreboardState, 'sport' | 'gamePeriod' | 'timeGame'> &
    Partial<Pick<ScoreboardState, 'footballPeriodLength' | 'footballStoppageMinutes'>>,
): boolean {
  if (!isCountUpSport(state.sport)) {
    return parseTimeToSeconds(state.timeGame) <= 0
  }
  return parseTimeToSeconds(state.timeGame) >= periodEndClockSeconds(state)
}

/** Descuento en curso: el cupo se cumplió y aún no se llega al tope +N. */
export function isStoppagePlay(
  state: Pick<ScoreboardState, 'sport' | 'gamePeriod' | 'timeGame'> &
    Partial<
      Pick<
        ScoreboardState,
        'footballPeriodLength' | 'footballStoppageMinutes' | 'intermissionActive'
      >
    >,
): boolean {
  if (state.sport !== 'football' || state.intermissionActive) return false
  if (stoppageClockSeconds(state) <= 0) return false
  const elapsed = parseTimeToSeconds(state.timeGame)
  return (
    elapsed >= regulationClockSeconds(state) &&
    elapsed < periodEndClockSeconds(state)
  )
}
