export type SportId = 'hockey'

export interface SportDefinition {
  id: SportId
  label: string
  available: boolean
}

export const SPORTS: SportDefinition[] = [
  { id: 'hockey', label: 'Hockey en línea', available: true },
]

export const DEFAULT_SPORT: SportId = 'hockey'
