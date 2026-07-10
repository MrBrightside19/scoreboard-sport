export function parseTimeToSeconds(time: string): number {
  const [mins, secs] = time.split(':').map((part) => Number.parseInt(part, 10))
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

export function interpolateClock(
  timeGame: string,
  isPaused: boolean,
  updatedAt: string,
  now = Date.now(),
): string {
  if (isPaused) return timeGame
  const elapsedSeconds = Math.floor((now - new Date(updatedAt).getTime()) / 1000)
  if (elapsedSeconds <= 0) return timeGame
  return tickDown(timeGame, elapsedSeconds)
}
