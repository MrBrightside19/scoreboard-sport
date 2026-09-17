export type SportId = 'hockey' | 'futsal' | 'basketball' | 'football'

export interface SportDefinition {
  id: SportId
  label: string
  available: boolean
  comingSoon?: boolean
}

export const SPORTS: SportDefinition[] = [
  { id: 'hockey', label: 'Hockey en línea', available: true },
  { id: 'futsal', label: 'Futsal', available: true },
  { id: 'basketball', label: 'Básquetbol', available: true },
  { id: 'football', label: 'Fútbol', available: true },
]

export const DEFAULT_SPORT: SportId = 'hockey'

export function isSportId(value: unknown): value is SportId {
  return (
    value === 'hockey' ||
    value === 'futsal' ||
    value === 'basketball' ||
    value === 'football'
  )
}

export function parseSportId(value: unknown): SportId {
  return isSportId(value) ? value : DEFAULT_SPORT
}

export function sportLabel(id: SportId): string {
  return SPORTS.find((sport) => sport.id === id)?.label ?? id
}
