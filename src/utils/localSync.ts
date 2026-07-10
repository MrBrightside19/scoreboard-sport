export const SCOREBOARD_SYNC_EVENT = 'scoreboard-sync'
export const SCOREBOARD_STORAGE_PREFIX = 'scoreboard:'

export function getStorageKey(matchId: string): string {
  return `${SCOREBOARD_STORAGE_PREFIX}${matchId}`
}

export function readMatchIdFromStorage(): string | null {
  return localStorage.getItem('activeMatchId')
}

export function writeMatchIdToStorage(matchId: string): void {
  localStorage.setItem('activeMatchId', matchId)
}

export function dispatchScoreboardSync(matchId: string): void {
  window.dispatchEvent(
    new CustomEvent(SCOREBOARD_SYNC_EVENT, { detail: { matchId } }),
  )
}

export function onScoreboardSync(
  handler: (matchId: string) => void,
): () => void {
  const onCustom = (event: Event) => {
    const detail = (event as CustomEvent<{ matchId: string }>).detail
    if (detail?.matchId) handler(detail.matchId)
  }

  const onStorage = (event: StorageEvent) => {
    if (!event.key?.startsWith(SCOREBOARD_STORAGE_PREFIX)) return
    const matchId = event.key.replace(SCOREBOARD_STORAGE_PREFIX, '')
    handler(matchId)
  }

  window.addEventListener(SCOREBOARD_SYNC_EVENT, onCustom)
  window.addEventListener('storage', onStorage)

  return () => {
    window.removeEventListener(SCOREBOARD_SYNC_EVENT, onCustom)
    window.removeEventListener('storage', onStorage)
  }
}
