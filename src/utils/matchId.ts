export function generateMatchId(): string {
  const suffix = Math.random().toString(36).slice(2, 9)
  return `partido-${suffix}`
}

export function buildMatchTitle(localTeam: string, visitTeam: string): string {
  return `${localTeam} vs ${visitTeam}`
}
