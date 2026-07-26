/** Catálogo de estilos de marcador TV y overlay. Ampliar aquí al añadir variantes. */

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
    description: 'Marcador de estadio con dígitos LED: marcador, periodo, faltas y tiros.',
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
