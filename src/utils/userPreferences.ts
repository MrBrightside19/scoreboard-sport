import {
  normalizeOverlayScoreboardStyle,
  normalizeTvScoreboardStyle,
  type OverlayScoreboardStyle,
  type TvScoreboardStyle,
  DEFAULT_OVERLAY_SCOREBOARD_STYLE,
  DEFAULT_TV_SCOREBOARD_STYLE,
} from '@/config/scoreboardStyles'

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
  /** Estilo del marcador TV / cancha. */
  tvScoreboardStyle: TvScoreboardStyle
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
    overlayScoreboardStyle: normalizeOverlayScoreboardStyle(
      stored.overlayScoreboardStyle ?? DEFAULTS.overlayScoreboardStyle,
    ),
  }
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

export function getTvScoreboardStyle(): TvScoreboardStyle {
  return getUserPreferences().tvScoreboardStyle
}

export function getOverlayScoreboardStyle(): OverlayScoreboardStyle {
  return getUserPreferences().overlayScoreboardStyle
}

export function applyAppTheme(theme: AppTheme = getAppTheme()): void {
  if (typeof document === 'undefined') return
  document.documentElement.dataset.theme = theme
}
