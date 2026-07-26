const PREFS_KEY = 'scoreboard:userPreferences'

export interface UserPreferences {
  /** Beep de cuenta regresiva en la mesa de control. */
  countdownBeepEnabled: boolean
}

const DEFAULTS: UserPreferences = {
  countdownBeepEnabled: true,
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
    ...DEFAULTS,
    ...stored,
  }
}

export function setUserPreferences(partial: Partial<UserPreferences>): UserPreferences {
  const next = { ...getUserPreferences(), ...partial }
  localStorage.setItem(PREFS_KEY, JSON.stringify(next))
  return next
}

export function isCountdownBeepEnabled(): boolean {
  return getUserPreferences().countdownBeepEnabled
}
