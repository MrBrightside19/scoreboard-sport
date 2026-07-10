const MIN_POLL_MS = 1000
const DEFAULT_POLL_MS = 5000

export function getPollIntervalMs(): number {
  const raw = import.meta.env.VITE_POLL_INTERVAL_MS
  const parsed = raw ? Number.parseInt(raw, 10) : DEFAULT_POLL_MS
  if (Number.isNaN(parsed) || parsed < MIN_POLL_MS) {
    return DEFAULT_POLL_MS
  }
  return parsed
}

export const LIVE_WINDOW_HOURS = 3
