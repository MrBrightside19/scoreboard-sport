const PREFS_KEY = 'scoreboard:userPreferences'

export type AppTheme = 'dark' | 'light'

export interface UserPreferences {
  /** Beep de cuenta regresiva en la mesa de control. */
  countdownBeepEnabled: boolean
  /** Desde cuántos segundos restantes suena el beep (inclusive). */
  countdownBeepSeconds: number
  /** Tema de la interfaz (páginas de app; TV/overlay siguen oscuros). */
  theme: AppTheme
}

export const DEFAULT_COUNTDOWN_BEEP_SECONDS = 10
export const MIN_COUNTDOWN_BEEP_SECONDS = 3
export const MAX_COUNTDOWN_BEEP_SECONDS = 30

const DEFAULTS: UserPreferences = {
  countdownBeepEnabled: true,
  countdownBeepSeconds: DEFAULT_COUNTDOWN_BEEP_SECONDS,
  theme: 'dark',
}

function clampCountdownSeconds(value: unknown): number {
  const n = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10)
  if (Number.isNaN(n)) return DEFAULT_COUNTDOWN_BEEP_SECONDS
  return Math.min(
    MAX_COUNTDOWN_BEEP_SECONDS,
    Math.max(MIN_COUNTDOWN_BEEP_SECONDS, Math.round(n)),
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
    theme: normalizeTheme(stored.theme ?? DEFAULTS.theme),
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
    theme: normalizeTheme(partial.theme ?? current.theme),
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

export function getAppTheme(): AppTheme {
  return getUserPreferences().theme
}

export function applyAppTheme(theme: AppTheme = getAppTheme()): void {
  if (typeof document === 'undefined') return
  document.documentElement.dataset.theme = theme
}
