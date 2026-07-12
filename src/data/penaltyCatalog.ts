/** Catálogo basado en Worldskate Inline Hockey 2026 — Sección 6 Penalties */

export interface PenaltyType {
  id: string
  category: string
  label: string
  durationSeconds: number
  ejectsPlayer: boolean
  description: string
}

export const PENALTY_CATALOG: PenaltyType[] = [
  {
    id: 'minor',
    category: 'Menor',
    label: 'Penalidad menor',
    durationSeconds: 90,
    ejectsPlayer: false,
    description: 'Jugador al banco 90 s sin sustituto en pista.',
  },
  {
    id: 'bench_minor',
    category: 'Menor de banca',
    label: 'Menor de banca',
    durationSeconds: 90,
    ejectsPlayer: false,
    description: 'Un jugador del equipo penalizado al banco 90 s.',
  },
  {
    id: 'double_minor',
    category: 'Doble menor',
    label: 'Doble penalidad menor',
    durationSeconds: 180,
    ejectsPlayer: false,
    description: 'Dos menores consecutivas (90 s + 90 s).',
  },
  {
    id: 'major',
    category: 'Mayor',
    label: 'Penalidad mayor',
    durationSeconds: 240,
    ejectsPlayer: false,
    description: 'Jugador al banco 4 minutos.',
  },
  {
    id: 'major_game_misconduct',
    category: 'Mayor + expulsión',
    label: 'Mayor + falta de conducta de juego',
    durationSeconds: 240,
    ejectsPlayer: true,
    description: 'Expulsión del partido; 4 min servidos por sustituto.',
  },
  {
    id: 'misconduct',
    category: 'Conducta',
    label: 'Falta de conducta',
    durationSeconds: 600,
    ejectsPlayer: false,
    description: '10 minutos; sustituto entra de inmediato.',
  },
  {
    id: 'game_misconduct',
    category: 'Expulsión',
    label: 'Falta de conducta de juego',
    durationSeconds: 600,
    ejectsPlayer: true,
    description: 'Expulsión del partido; 10 min en acta.',
  },
  {
    id: 'match',
    category: 'Partido',
    label: 'Falta de partido',
    durationSeconds: 240,
    ejectsPlayer: true,
    description: 'Expulsión; 4 min servidos por sustituto.',
  },
]

export const COMMON_INFRACTIONS = [
  'Tripping',
  'Hooking',
  'Slashing',
  'High sticking',
  'Cross checking',
  'Charging',
  'Boarding',
  'Interference',
  'Holding',
  'Roughing',
  'Elbowing',
  'Kneeing',
  'Spearing',
  'Butt-ending',
  'Checking from behind',
  'Delay of game',
  'Too many players',
  'Illegal equipment',
  'Fighting',
  'Abuse of officials',
] as const

export function getPenaltyType(id: string): PenaltyType | undefined {
  return PENALTY_CATALOG.find((type) => type.id === id)
}

export function secondsToClock(seconds: number): string {
  const clamped = Math.max(0, seconds)
  const mins = Math.floor(clamped / 60)
  const secs = clamped % 60
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

export function penaltyTypeLabel(id: string): string {
  return getPenaltyType(id)?.category ?? 'Penalidad'
}
