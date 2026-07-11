const MIN_POLL_MS = 1000
const DEFAULT_POLL_MS = 5000

function parseEnvMs(
  raw: string | undefined,
  fallback: number,
  min: number,
): number {
  const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN
  if (Number.isNaN(parsed) || parsed < min) return fallback
  return parsed
}

/** Intervalo de sincronización del reloj en vivo (mesa → Supabase → overlay/OBS/live). */
export function getLiveClockUpdateMs(): number {
  const dedicated = import.meta.env.VITE_LIVE_CLOCK_UPDATE_MS
  if (dedicated) {
    return parseEnvMs(dedicated, DEFAULT_POLL_MS, MIN_POLL_MS)
  }
  return parseEnvMs(import.meta.env.VITE_POLL_INTERVAL_MS, DEFAULT_POLL_MS, MIN_POLL_MS)
}

/** @deprecated Usar getLiveClockUpdateMs. Se mantiene por compatibilidad. */
export function getPollIntervalMs(): number {
  return getLiveClockUpdateMs()
}

export const LIVE_WINDOW_HOURS = 3

const DEFAULT_TOURNAMENT_TABLE_REFRESH_MS = 60_000
const MIN_TOURNAMENT_TABLE_REFRESH_MS = 5_000

export function getTournamentTableRefreshMs(): number {
  const raw = import.meta.env.VITE_TOURNAMENT_TABLE_REFRESH_MS
  const parsed = raw ? Number.parseInt(raw, 10) : DEFAULT_TOURNAMENT_TABLE_REFRESH_MS
  if (Number.isNaN(parsed) || parsed < MIN_TOURNAMENT_TABLE_REFRESH_MS) {
    return DEFAULT_TOURNAMENT_TABLE_REFRESH_MS
  }
  return parsed
}
