export function normalizeGameTime(time: string): string {
  const trimmed = time.trim()
  if (!trimmed) return '20:00'

  if (trimmed.includes(':')) {
    const [minsPart, secsPart = '0'] = trimmed.split(':')
    const mins = Number.parseInt(minsPart, 10)
    const secs = Number.parseInt(secsPart, 10)
    if (Number.isNaN(mins)) return '20:00'
    const total = mins * 60 + (Number.isNaN(secs) ? 0 : secs)
    return formatSecondsToTime(total)
  }

  const minutes = Number.parseInt(trimmed, 10)
  if (Number.isNaN(minutes)) return '20:00'
  return formatSecondsToTime(minutes * 60)
}

export function parseTimeToSeconds(time: string): number {
  const normalized = normalizeGameTime(time)
  const [mins, secs] = normalized.split(':').map((part) => Number.parseInt(part, 10))
  if (Number.isNaN(mins) || Number.isNaN(secs)) return 0
  return mins * 60 + secs
}

export function formatSecondsToTime(totalSeconds: number): string {
  const clamped = Math.max(0, totalSeconds)
  const mins = Math.floor(clamped / 60)
  const secs = clamped % 60
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

export function tickDown(time: string, seconds = 1): string {
  const current = parseTimeToSeconds(time)
  return formatSecondsToTime(current - seconds)
}

export function tickUp(time: string, seconds = 1): string {
  const current = parseTimeToSeconds(time)
  return formatSecondsToTime(current + seconds)
}

export function isOlderTimestamp(incoming: string, previous: string): boolean {
  const next = Date.parse(incoming)
  const prev = Date.parse(previous)
  if (!Number.isFinite(next) || !Number.isFinite(prev)) return false
  return next < prev
}

/**
 * Salto atrás del reloj en juego (mesa desfasada al despertar), no un ajuste en pausa.
 * Cuenta arriba: el valor mostrado no debe bajar. Cuenta atrás: no debe subir.
 */
export function isImplausibleRunningClockRewind(
  direction: 'down' | 'up',
  displayedSeconds: number,
  incomingSeconds: number,
  toleranceSeconds = 2,
): boolean {
  if (direction === 'up') {
    return incomingSeconds + toleranceSeconds < displayedSeconds
  }
  return incomingSeconds > displayedSeconds + toleranceSeconds
}

export function interpolateClock(
  timeGame: string,
  isPaused: boolean,
  updatedAt: string,
  now = Date.now(),
  direction: 'down' | 'up' = 'down',
  maxSeconds?: number,
): string {
  if (isPaused) {
    if (direction === 'up' && maxSeconds != null) {
      return formatSecondsToTime(Math.min(parseTimeToSeconds(timeGame), maxSeconds))
    }
    return timeGame
  }
  const elapsedSeconds = Math.floor((now - new Date(updatedAt).getTime()) / 1000)
  if (elapsedSeconds <= 0) {
    if (direction === 'up' && maxSeconds != null) {
      return formatSecondsToTime(Math.min(parseTimeToSeconds(timeGame), maxSeconds))
    }
    return timeGame
  }
  if (direction === 'up') {
    const next = tickUp(timeGame, elapsedSeconds)
    if (maxSeconds == null) return next
    return formatSecondsToTime(Math.min(parseTimeToSeconds(next), maxSeconds))
  }
  return tickDown(timeGame, elapsedSeconds)
}

/** Reloj de periodo agotado: las faltas no deben seguir corriendo. */
export function isPeriodClockExpired(timeGame: string): boolean {
  return parseTimeToSeconds(timeGame) <= 0
}

/** Congela faltas en pausa o al terminar el periodo (00:00). */
export function arePenaltiesFrozen(isPaused: boolean, timeGame: string): boolean {
  return isPaused || isPeriodClockExpired(timeGame)
}

/**
 * Interpola el reloj de una falta solo por el tiempo de juego efectivamente corrido
 * (no sigue bajando tras el 00:00 del periodo).
 */
export function interpolatePenaltyTime(
  penaltyTime: string,
  isPaused: boolean,
  updatedAt: string,
  timeGame: string,
  now = Date.now(),
): string {
  if (arePenaltiesFrozen(isPaused, timeGame)) return penaltyTime
  const clockSeconds = parseTimeToSeconds(timeGame)
  const elapsedSeconds = Math.floor((now - new Date(updatedAt).getTime()) / 1000)
  if (elapsedSeconds <= 0) return penaltyTime
  const playable = Math.min(elapsedSeconds, clockSeconds)
  return tickDown(penaltyTime, playable)
}
