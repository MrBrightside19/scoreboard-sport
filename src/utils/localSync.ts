export const SCOREBOARD_SYNC_EVENT = 'scoreboard-sync'
export const SCOREBOARD_STORAGE_PREFIX = 'scoreboard:'
export const COURT_MATCH_SYNC_EVENT = 'court-match-sync'
export const COURT_MATCH_STORAGE_PREFIX = 'courtMatch:'

export function getStorageKey(matchId: string): string {
  return `${SCOREBOARD_STORAGE_PREFIX}${matchId}`
}

export function getCourtMatchKey(tournamentId: string, court: string): string {
  return `${COURT_MATCH_STORAGE_PREFIX}${tournamentId}:${court}`
}

export function readMatchIdFromStorage(): string | null {
  return localStorage.getItem('activeMatchId')
}

export function writeMatchIdToStorage(matchId: string): void {
  localStorage.setItem('activeMatchId', matchId)
}

export function clearMatchIdFromStorage(): void {
  localStorage.removeItem('activeMatchId')
}

export function readCourtActiveMatch(
  tournamentId: string,
  court: string,
): string | null {
  return localStorage.getItem(getCourtMatchKey(tournamentId, court))
}

/** Partido activo de una cancha (para TV fija en el mismo navegador). */
export function writeCourtActiveMatch(
  tournamentId: string,
  court: string,
  matchId: string,
): void {
  const key = getCourtMatchKey(tournamentId, court)
  localStorage.setItem(key, matchId)
  window.dispatchEvent(
    new CustomEvent(COURT_MATCH_SYNC_EVENT, {
      detail: { tournamentId, court, matchId },
    }),
  )
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

export function onCourtMatchSync(
  tournamentId: () => string,
  court: () => string,
  handler: (matchId: string) => void,
): () => void {
  const matches = (tid: string, c: string): boolean =>
    tid === tournamentId() && c === court()

  const onCustom = (event: Event) => {
    const detail = (
      event as CustomEvent<{ tournamentId: string; court: string; matchId: string }>
    ).detail
    if (!detail?.matchId) return
    if (!matches(detail.tournamentId, detail.court)) return
    handler(detail.matchId)
  }

  const onStorage = (event: StorageEvent) => {
    if (!event.key?.startsWith(COURT_MATCH_STORAGE_PREFIX) || !event.newValue) return
    const expected = getCourtMatchKey(tournamentId(), court())
    if (event.key !== expected) return
    handler(event.newValue)
  }

  window.addEventListener(COURT_MATCH_SYNC_EVENT, onCustom)
  window.addEventListener('storage', onStorage)

  return () => {
    window.removeEventListener(COURT_MATCH_SYNC_EVENT, onCustom)
    window.removeEventListener('storage', onStorage)
  }
}
