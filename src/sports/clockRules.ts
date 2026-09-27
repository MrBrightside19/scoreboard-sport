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
  Partial<
    Pick<
      ScoreboardState,
      'footballPeriodLength' | 'footballExtraTimeLength' | 'footballStoppageMinutes'
    >
  >

/** Segundos reglamentarios del periodo actual (45′ / 15′ en fútbol, etc.). */
export function regulationClockSeconds(state: RegulationState): number {
  const sport = getSportModule(state.sport)
  if (sport.clock.overtimePeriodTime && state.gamePeriod > sport.clock.periods) {
    if (state.sport === 'football' && state.footballExtraTimeLength) {
      const extra = parseTimeToSeconds(state.footballExtraTimeLength)
      if (extra >= 60) return extra
    }
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

/** Duración + descuento anunciado. En fútbol no recorta el reloj: sirve para avisos y descanso. */
export function periodEndClockSeconds(state: RegulationState): number {
  return regulationClockSeconds(state) + stoppageClockSeconds(state)
}

/** Fútbol FIFA: el reloj no se topea ni se pausa solo al cumplir el tiempo o el +N. */
export function countUpPausesAtPeriodEnd(sportId: string): boolean {
  return clockDirection(sportId) === 'up' && sportId !== 'football'
}

export function countUpClockMaxSeconds(state: RegulationState): number | undefined {
  if (!countUpPausesAtPeriodEnd(state.sport)) return undefined
  return periodEndClockSeconds(state)
}

export function clampCountUpTime(time: string, state: RegulationState): string {
  const maxSeconds = countUpClockMaxSeconds(state)
  if (maxSeconds == null) return time
  return formatSecondsToTime(Math.min(parseTimeToSeconds(time), maxSeconds))
}

export function isCountUpSport(sportId: SportId | string): boolean {
  return clockDirection(sportId) === 'up'
}

/** Segundos que restan del periodo (cuenta atrás = el reloj; cuenta arriba = cupo − transcurrido). */
export function remainingClockSeconds(
  state: Pick<ScoreboardState, 'sport' | 'gamePeriod' | 'timeGame'> &
    Partial<Pick<ScoreboardState, 'footballPeriodLength' | 'footballExtraTimeLength'>>,
): number {
  const elapsed = parseTimeToSeconds(state.timeGame)
  if (!isCountUpSport(state.sport)) return elapsed
  return Math.max(0, regulationClockSeconds(state) - elapsed)
}

/** Segundos que restan hasta el tope (duración + descuento en fútbol). */
export function remainingUntilPeriodEndSeconds(
  state: Pick<ScoreboardState, 'sport' | 'gamePeriod' | 'timeGame'> &
    Partial<
      Pick<
        ScoreboardState,
        'footballPeriodLength' | 'footballExtraTimeLength' | 'footballStoppageMinutes'
      >
    >,
): number {
  const elapsed = parseTimeToSeconds(state.timeGame)
  if (!isCountUpSport(state.sport)) return elapsed
  return Math.max(0, periodEndClockSeconds(state) - elapsed)
}

export function isRegulationElapsed(
  state: Pick<ScoreboardState, 'sport' | 'gamePeriod' | 'timeGame'> &
    Partial<Pick<ScoreboardState, 'footballPeriodLength' | 'footballExtraTimeLength'>>,
): boolean {
  if (!isCountUpSport(state.sport)) {
    return parseTimeToSeconds(state.timeGame) <= 0
  }
  return parseTimeToSeconds(state.timeGame) >= regulationClockSeconds(state)
}

/** El tiempo (y su descuento) ya se cumplió: ahí corresponde el descanso. */
export function isPeriodPlayFinished(
  state: Pick<ScoreboardState, 'sport' | 'gamePeriod' | 'timeGame'> &
    Partial<
      Pick<
        ScoreboardState,
        'footballPeriodLength' | 'footballExtraTimeLength' | 'footballStoppageMinutes'
      >
    >,
): boolean {
  if (!isCountUpSport(state.sport)) {
    return parseTimeToSeconds(state.timeGame) <= 0
  }
  return parseTimeToSeconds(state.timeGame) >= periodEndClockSeconds(state)
}

/** Descuento en curso: ya pasó el reglamentario y hay +N, aunque el reloj siga más allá del +N. */
export function isStoppagePlay(
  state: Pick<ScoreboardState, 'sport' | 'gamePeriod' | 'timeGame'> &
    Partial<
      Pick<
        ScoreboardState,
        'footballPeriodLength' | 'footballExtraTimeLength' | 'footballStoppageMinutes' | 'intermissionActive'
      >
    >,
): boolean {
  if (state.sport !== 'football' || state.intermissionActive) return false
  if (stoppageClockSeconds(state) <= 0) return false
  return parseTimeToSeconds(state.timeGame) >= regulationClockSeconds(state)
}
