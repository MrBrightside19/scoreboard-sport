export function buildAppUrl(path: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '')
  return `${window.location.origin}${base}${path}`
}

export function tournamentOverlayPath(tournamentId: string, court: string): string {
  return `/overlay/torneo/${tournamentId}/${court}`
}

export function tournamentLivePath(tournamentId: string, court: string): string {
  return `/live/torneo/${tournamentId}/${court}`
}

export function tournamentBoardPath(tournamentId: string, court: string): string {
  return `/board/torneo/${tournamentId}/${court}`
}
