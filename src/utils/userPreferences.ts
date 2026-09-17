import {
  normalizeOverlayScoreboardStyle,
  normalizeTvScoreboardStyle,
  resolveTvStyleForSport,
  type OverlayScoreboardStyle,
  type TvScoreboardStyle,
  DEFAULT_OVERLAY_SCOREBOARD_STYLE,
  DEFAULT_TV_SCOREBOARD_STYLE,
} from '@/config/scoreboardStyles'
import { parseSportId, type SportId } from '@/types/sport'

const PREFS_KEY = 'scoreboard:userPreferences'

export type AppTheme = 'dark' | 'light'

export interface UserPreferences {
  /** Beep de cuenta regresiva en la mesa de control. */
  countdownBeepEnabled: boolean
  /** Desde cuántos segundos restantes suena el beep (inclusive). */
  countdownBeepSeconds: number
  /** Aviso sonoro al entrar en los últimos minutos de juego. */
  lateGameWarningEnabled: boolean
  /** Minutos restantes para disparar el aviso (1–5). */
  lateGameWarningMinutes: number
  /** Tema de la interfaz (páginas de app; TV/overlay siguen oscuros). */
  theme: AppTheme
  /** Estilo TV legacy (hockey). Se conserva para no perder la preferencia guardada. */
  tvScoreboardStyle: TvScoreboardStyle
  /** Estilo TV por deporte. */
  tvScoreboardStyles: Partial<Record<SportId, TvScoreboardStyle>>
  /** Estilo del overlay OBS. */
  overlayScoreboardStyle: OverlayScoreboardStyle
}

export const DEFAULT_COUNTDOWN_BEEP_SECONDS = 10
export const MIN_COUNTDOWN_BEEP_SECONDS = 3
export const MAX_COUNTDOWN_BEEP_SECONDS = 30

export const DEFAULT_LATE_GAME_WARNING_MINUTES = 2
export const MIN_LATE_GAME_WARNING_MINUTES = 1
export const MAX_LATE_GAME_WARNING_MINUTES = 5

const DEFAULTS: UserPreferences = {
  countdownBeepEnabled: true,
  countdownBeepSeconds: DEFAULT_COUNTDOWN_BEEP_SECONDS,
  lateGameWarningEnabled: true,
  lateGameWarningMinutes: DEFAULT_LATE_GAME_WARNING_MINUTES,
  theme: 'dark',
  tvScoreboardStyle: DEFAULT_TV_SCOREBOARD_STYLE,
  tvScoreboardStyles: {},
  overlayScoreboardStyle: DEFAULT_OVERLAY_SCOREBOARD_STYLE,
}

function clampCountdownSeconds(value: unknown): number {
  const n = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10)
  if (Number.isNaN(n)) return DEFAULT_COUNTDOWN_BEEP_SECONDS
  return Math.min(
    MAX_COUNTDOWN_BEEP_SECONDS,
    Math.max(MIN_COUNTDOWN_BEEP_SECONDS, Math.round(n)),
  )
}

function clampLateGameMinutes(value: unknown): number {
  const n = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10)
  if (Number.isNaN(n)) return DEFAULT_LATE_GAME_WARNING_MINUTES
  return Math.min(
    MAX_LATE_GAME_WARNING_MINUTES,
    Math.max(MIN_LATE_GAME_WARNING_MINUTES, Math.round(n)),
  )
}

function normalizeTheme(value: unknown): AppTheme {
  return value === 'light' ? 'light' : 'dark'
}

function readRaw(): Partial<UserPreferences> {
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    if (!raw) return {}
    return JSON.parse(raw) as Partial<UserPreferences>
  } catch {
    return {}
  }
}

export function getUserPreferences(): UserPreferences {
  const stored = readRaw()
  return {
    countdownBeepEnabled:
      typeof stored.countdownBeepEnabled === 'boolean'
        ? stored.countdownBeepEnabled
        : DEFAULTS.countdownBeepEnabled,
    countdownBeepSeconds: clampCountdownSeconds(
      stored.countdownBeepSeconds ?? DEFAULTS.countdownBeepSeconds,
    ),
    lateGameWarningEnabled:
      typeof stored.lateGameWarningEnabled === 'boolean'
        ? stored.lateGameWarningEnabled
        : DEFAULTS.lateGameWarningEnabled,
    lateGameWarningMinutes: clampLateGameMinutes(
      stored.lateGameWarningMinutes ?? DEFAULTS.lateGameWarningMinutes,
    ),
    theme: normalizeTheme(stored.theme ?? DEFAULTS.theme),
    tvScoreboardStyle: normalizeTvScoreboardStyle(
      stored.tvScoreboardStyle ?? DEFAULTS.tvScoreboardStyle,
    ),
    tvScoreboardStyles: normalizeTvStylesBySport(stored.tvScoreboardStyles),
    overlayScoreboardStyle: normalizeOverlayScoreboardStyle(
      stored.overlayScoreboardStyle ?? DEFAULTS.overlayScoreboardStyle,
    ),
  }
}

function normalizeTvStylesBySport(
  raw: unknown,
): Partial<Record<SportId, TvScoreboardStyle>> {
  if (!raw || typeof raw !== 'object') return {}
  const source = raw as Partial<Record<string, unknown>>
  const next: Partial<Record<SportId, TvScoreboardStyle>> = {}
  for (const key of ['hockey', 'futsal', 'basketball', 'football'] as SportId[]) {
    if (source[key] != null) next[key] = resolveTvStyleForSport(source[key], key)
  }
  return next
}

export function setUserPreferences(partial: Partial<UserPreferences>): UserPreferences {
  const current = getUserPreferences()
  const next: UserPreferences = {
    countdownBeepEnabled:
      typeof partial.countdownBeepEnabled === 'boolean'
        ? partial.countdownBeepEnabled
        : current.countdownBeepEnabled,
    countdownBeepSeconds: clampCountdownSeconds(
      partial.countdownBeepSeconds ?? current.countdownBeepSeconds,
    ),
    lateGameWarningEnabled:
      typeof partial.lateGameWarningEnabled === 'boolean'
        ? partial.lateGameWarningEnabled
        : current.lateGameWarningEnabled,
    lateGameWarningMinutes: clampLateGameMinutes(
      partial.lateGameWarningMinutes ?? current.lateGameWarningMinutes,
    ),
    theme: normalizeTheme(partial.theme ?? current.theme),
    tvScoreboardStyle: normalizeTvScoreboardStyle(
      partial.tvScoreboardStyle ?? current.tvScoreboardStyle,
    ),
    tvScoreboardStyles: {
      ...current.tvScoreboardStyles,
      ...normalizeTvStylesBySport(partial.tvScoreboardStyles),
    },
    overlayScoreboardStyle: normalizeOverlayScoreboardStyle(
      partial.overlayScoreboardStyle ?? current.overlayScoreboardStyle,
    ),
  }
  localStorage.setItem(PREFS_KEY, JSON.stringify(next))
  window.dispatchEvent(new Event('scoreboard:prefs-change'))
  if (partial.theme !== undefined) {
    applyAppTheme(next.theme)
    window.dispatchEvent(new Event('scoreboard:theme-change'))
  }
  return next
}

export function isCountdownBeepEnabled(): boolean {
  return getUserPreferences().countdownBeepEnabled
}

export function getCountdownBeepSeconds(): number {
  return getUserPreferences().countdownBeepSeconds
}

export function isLateGameWarningEnabled(): boolean {
  return getUserPreferences().lateGameWarningEnabled
}

export function getLateGameWarningMinutes(): number {
  return getUserPreferences().lateGameWarningMinutes
}

export function getAppTheme(): AppTheme {
  return getUserPreferences().theme
}

export function getTvScoreboardStyle(sport?: string | null): TvScoreboardStyle {
  const prefs = getUserPreferences()
  const id = parseSportId(sport)
  // Preferencia por deporte → estilo global legacy (antes solo leía hockey).
  const stored = prefs.tvScoreboardStyles[id] ?? prefs.tvScoreboardStyle
  return resolveTvStyleForSport(stored, id)
}

/**
 * Guarda el estilo TV.
 * Clásico / Clásico claro se aplican a todos los deportes (tema de color compartido).
 * Arena LED solo afecta a hockey.
 */
export function setTvScoreboardStyle(
  sport: SportId,
  style: TvScoreboardStyle,
): UserPreferences {
  const sports: SportId[] = ['hockey', 'futsal', 'basketball', 'football']

  if (style === 'classic' || style === 'classic-light') {
    const bySport: Partial<Record<SportId, TvScoreboardStyle>> = {}
    for (const id of sports) {
      bySport[id] = resolveTvStyleForSport(style, id)
    }
    return setUserPreferences({
      tvScoreboardStyles: bySport,
      tvScoreboardStyle: resolveTvStyleForSport(style, 'hockey'),
    })
  }

  const resolved = resolveTvStyleForSport(style, sport)
  return setUserPreferences({
    tvScoreboardStyles: { [sport]: resolved },
    ...(sport === 'hockey' ? { tvScoreboardStyle: resolved } : {}),
  })
}

export function getOverlayScoreboardStyle(): OverlayScoreboardStyle {
  return getUserPreferences().overlayScoreboardStyle
}

export function applyAppTheme(theme: AppTheme = getAppTheme()): void {
  if (typeof document === 'undefined') return
  document.documentElement.dataset.theme = theme
}
