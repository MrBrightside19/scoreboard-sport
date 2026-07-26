/** Catálogo de estilos de marcador TV y overlay. Ampliar aquí al añadir variantes. */

export type TvScoreboardStyle = 'classic' | 'arena'
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
    description: 'Marcador a pantalla completa para TV o proyección en cancha.',
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
