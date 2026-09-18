/** Catálogo de estilos de marcador TV y overlay. Ampliar aquí al añadir variantes. */

import { parseSportId, type SportId } from '@/types/sport'

export type TvScoreboardStyle = 'classic' | 'classic-light' | 'arena'
export type OverlayScoreboardStyle = 'bug'

export interface ScoreboardStyleOption<T extends string> {
  id: T
  label: string
  description: string
}

export const DEFAULT_TV_SCOREBOARD_STYLE: TvScoreboardStyle = 'classic'
export const DEFAULT_OVERLAY_SCOREBOARD_STYLE: OverlayScoreboardStyle = 'bug'

export const TV_SCOREBOARD_STYLES: ScoreboardStyleOption<TvScoreboardStyle>[] = [
  {
    id: 'classic',
    label: 'Clásico',
    description: 'Marcador a pantalla completa para TV o proyección en cancha (tema oscuro).',
  },
  {
    id: 'classic-light',
    label: 'Clásico claro',
    description: 'Misma disposición del clásico, con fondo claro para pantallas o salas iluminadas.',
  },
  {
    id: 'arena',
    label: 'Arena LED',
    description:
      'Diseño exclusivo de hockey en línea: dígitos LED con marcador, periodo, faltas y tiros.',
  },
]

export const OVERLAY_SCOREBOARD_STYLES: ScoreboardStyleOption<OverlayScoreboardStyle>[] = [
  {
    id: 'bug',
    label: 'Bug de transmisión',
    description: 'Barra compacta tipo broadcast para OBS (fondo transparente).',
  },
]

export function isTvScoreboardStyle(value: unknown): value is TvScoreboardStyle {
  return TV_SCOREBOARD_STYLES.some((option) => option.id === value)
}

export function isOverlayScoreboardStyle(value: unknown): value is OverlayScoreboardStyle {
  return OVERLAY_SCOREBOARD_STYLES.some((option) => option.id === value)
}

export function normalizeTvScoreboardStyle(value: unknown): TvScoreboardStyle {
  return isTvScoreboardStyle(value) ? value : DEFAULT_TV_SCOREBOARD_STYLE
}

export function normalizeOverlayScoreboardStyle(value: unknown): OverlayScoreboardStyle {
  return isOverlayScoreboardStyle(value) ? value : DEFAULT_OVERLAY_SCOREBOARD_STYLE
}

export function isArenaTvStyle(style: TvScoreboardStyle): boolean {
  return style === 'arena'
}

export function isClassicLightTvStyle(style: TvScoreboardStyle): boolean {
  return style === 'classic-light'
}

/** Tema de color compartido (todos los deportes). */
export const SHARED_TV_STYLES: Array<'classic' | 'classic-light'> = [
  'classic',
  'classic-light',
]

/** Estilos TV que cada deporte sabe renderizar. Arena LED es solo hockey. */
export const TV_STYLES_BY_SPORT: Record<SportId, TvScoreboardStyle[]> = {
  hockey: ['classic', 'classic-light', 'arena'],
  futsal: ['classic', 'classic-light'],
  basketball: ['classic', 'classic-light'],
  football: ['classic', 'classic-light'],
}

export function isSharedTvStyle(
  style: unknown,
): style is 'classic' | 'classic-light' {
  return style === 'classic' || style === 'classic-light'
}

export function normalizeSharedTvScoreboardStyle(
  value: unknown,
): 'classic' | 'classic-light' {
  return value === 'classic-light' ? 'classic-light' : 'classic'
}

export function tvStylesForSport(sport?: string | null): TvScoreboardStyle[] {
  return TV_STYLES_BY_SPORT[parseSportId(sport)]
}

/** Diseños exclusivos del deporte (p. ej. Arena LED en hockey). */
export function sportSpecificTvStyles(sport?: string | null): TvScoreboardStyle[] {
  return tvStylesForSport(sport).filter((style) => !isSharedTvStyle(style))
}

export function sportsWithSpecificTvDesigns(): SportId[] {
  return (Object.keys(TV_STYLES_BY_SPORT) as SportId[]).filter(
    (id) => sportSpecificTvStyles(id).length > 0,
  )
}

export function resolveTvStyleForSport(
  style: unknown,
  sport?: string | null,
): TvScoreboardStyle {
  const allowed = tvStylesForSport(sport)
  if (isTvScoreboardStyle(style) && allowed.includes(style)) return style
  return allowed[0] ?? DEFAULT_TV_SCOREBOARD_STYLE
}

export function tvStyleOptionsForSport(
  sport?: string | null,
  filter: 'all' | 'shared' | 'sport-specific' = 'all',
): ScoreboardStyleOption<TvScoreboardStyle>[] {
  const allowed = new Set(tvStylesForSport(sport))
  return TV_SCOREBOARD_STYLES.filter((option) => {
    if (!allowed.has(option.id)) return false
    if (filter === 'shared') return isSharedTvStyle(option.id)
    if (filter === 'sport-specific') return !isSharedTvStyle(option.id)
    return true
  })
}
