import type { PlayerRole, RosterPlayer } from '@/types/hockeyScoreboard'

export const MAX_ASSISTANT_CAPTAINS = 2

export function playerLabel(player: RosterPlayer): string {
  const name = player.name.trim()
  if (name) return `#${player.number} ${name}`
  return `#${player.number}`
}

export function roleLabel(role: PlayerRole): string {
  if (role === 'captain') return 'Capitán'
  if (role === 'assistant_captain') return 'Asist. capitán'
  if (role === 'goalkeeper') return 'Arquero'
  return 'Jugador'
}

export function canSetRole(
  players: RosterPlayer[],
  playerId: string,
  nextRole: PlayerRole,
): boolean {
  if (nextRole === 'player' || nextRole === 'goalkeeper') return true

  const others = players.filter((player) => player.id !== playerId)
  if (nextRole === 'captain') {
    return !others.some((player) => player.role === 'captain')
  }

  if (nextRole === 'assistant_captain') {
    const assistants = others.filter((player) => player.role === 'assistant_captain')
    return assistants.length < MAX_ASSISTANT_CAPTAINS
  }

  return true
}

export function findPlayerById(
  players: RosterPlayer[],
  playerId: string,
): RosterPlayer | undefined {
  return players.find((player) => player.id === playerId)
}

export function findPlayerByNumber(
  players: RosterPlayer[],
  number: string,
): RosterPlayer | undefined {
  const normalized = number.trim()
  if (!normalized) return undefined
  return players.find((player) => player.number.trim() === normalized)
}
