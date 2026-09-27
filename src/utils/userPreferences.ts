import {
  isSharedTvStyle,
  normalizeOverlayScoreboardStyle,
  normalizeSharedTvScoreboardStyle,
  resolveTvStyleForSport,
  tvStylesForSport,
  type OverlayScoreboardStyle,
  type TvScoreboardStyle,
  DEFAULT_OVERLAY_SCOREBOARD_STYLE,
  DEFAULT_TV_SCOREBOARD_STYLE,
} from '@/config/scoreboardStyles'
import { parseSportId, type SportId } from '@/types/sport'
import { generateId } from '@/utils/id'

const ALL_SPORTS: SportId[] = ['hockey', 'futsal', 'basketball', 'football']

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
  /** Logos de equipos guardados para reutilizar en los marcadores. */
  savedTeamLogos: SavedTeamLogo[]
  /** Logo de la biblioteca que se muestra en Perfil. */
  selectedSavedLogoId: string | null
}

export interface SavedTeamLogo {
  id: string
  name: string
  url: string
}

export const DEFAULT_COUNTDOWN_BEEP_SECONDS = 10
export const MIN_COUNTDOWN_BEEP_SECONDS = 3
export const MAX_COUNTDOWN_BEEP_SECONDS = 30

export const DEFAULT_LATE_GAME_WARNING_MINUTES = 2
export const MIN_LATE_GAME_WARNING_MINUTES = 1
export const MAX_LATE_GAME_WARNING_MINUTES = 5

export const MAX_SAVED_TEAM_LOGOS = 24
export const MAX_SAVED_TEAM_LOGO_NAME = 40

const DEFAULTS: UserPreferences = {
  countdownBeepEnabled: true,
  countdownBeepSeconds: DEFAULT_COUNTDOWN_BEEP_SECONDS,
  lateGameWarningEnabled: true,
  lateGameWarningMinutes: DEFAULT_LATE_GAME_WARNING_MINUTES,
  theme: 'dark',
  tvScoreboardStyle: DEFAULT_TV_SCOREBOARD_STYLE,
  tvScoreboardStyles: {},
  overlayScoreboardStyle: DEFAULT_OVERLAY_SCOREBOARD_STYLE,
  savedTeamLogos: [],
  selectedSavedLogoId: null,
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

export function isHttpLogoUrl(value: string): boolean {
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

function normalizeSavedTeamLogos(raw: unknown): SavedTeamLogo[] {
  if (!Array.isArray(raw)) return []
  const logos: SavedTeamLogo[] = []
  const seenUrls = new Set<string>()
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    const name = String(row.name ?? '')
      .trim()
      .slice(0, MAX_SAVED_TEAM_LOGO_NAME)
    const url = String(row.url ?? '').trim()
    const id = String(row.id ?? '').trim() || generateId()
    if (!name || !isHttpLogoUrl(url) || seenUrls.has(url)) continue
    seenUrls.add(url)
    logos.push({ id, name, url })
    if (logos.length >= MAX_SAVED_TEAM_LOGOS) break
  }
  return logos
}

function normalizeSelectedSavedLogoId(
  raw: unknown,
  logos: SavedTeamLogo[],
): string | null {
  if (!logos.length) return null
  const id = typeof raw === 'string' ? raw : ''
  if (id && logos.some((logo) => logo.id === id)) return id
  return logos[0]?.id ?? null
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
  const savedTeamLogos = normalizeSavedTeamLogos(stored.savedTeamLogos)
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
    tvScoreboardStyle: normalizeSharedTvScoreboardStyle(
      stored.tvScoreboardStyle ?? DEFAULTS.tvScoreboardStyle,
    ),
    tvScoreboardStyles: normalizeTvStylesBySport(
      migrateLegacyArenaOverride(stored),
    ),
    overlayScoreboardStyle: normalizeOverlayScoreboardStyle(
      stored.overlayScoreboardStyle ?? DEFAULTS.overlayScoreboardStyle,
    ),
    savedTeamLogos,
    selectedSavedLogoId: normalizeSelectedSavedLogoId(
      stored.selectedSavedLogoId,
      savedTeamLogos,
    ),
  }
}

/** Si el legacy guardó Arena como estilo global, muévelo a hockey. */
function migrateLegacyArenaOverride(
  stored: Partial<UserPreferences>,
): unknown {
  const bySport = stored.tvScoreboardStyles
  if (stored.tvScoreboardStyle !== 'arena') return bySport
  if (bySport && typeof bySport === 'object' && 'hockey' in bySport) return bySport
  return { ...(typeof bySport === 'object' && bySport ? bySport : {}), hockey: 'arena' }
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
    tvScoreboardStyle: normalizeSharedTvScoreboardStyle(
      partial.tvScoreboardStyle ?? current.tvScoreboardStyle,
    ),
    tvScoreboardStyles: {
      ...current.tvScoreboardStyles,
      ...normalizeTvStylesBySport(partial.tvScoreboardStyles),
    },
    overlayScoreboardStyle: normalizeOverlayScoreboardStyle(
      partial.overlayScoreboardStyle ?? current.overlayScoreboardStyle,
    ),
    savedTeamLogos: normalizeSavedTeamLogos(
      partial.savedTeamLogos ?? current.savedTeamLogos,
    ),
    selectedSavedLogoId: null,
  }
  next.selectedSavedLogoId = normalizeSelectedSavedLogoId(
    partial.selectedSavedLogoId !== undefined
      ? partial.selectedSavedLogoId
      : current.selectedSavedLogoId,
    next.savedTeamLogos,
  )
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

/** Tema de color TV compartido (Clásico / Clásico claro). */
export function getSharedTvScoreboardStyle(): 'classic' | 'classic-light' {
  return normalizeSharedTvScoreboardStyle(getUserPreferences().tvScoreboardStyle)
}

/**
 * Aplica Clásico / Clásico claro a todos los deportes que no usan un diseño exclusivo
 * (p. ej. hockey en Arena LED se mantiene).
 */
export function setSharedTvScoreboardStyle(
  style: 'classic' | 'classic-light',
): UserPreferences {
  const current = getUserPreferences()
  const bySport: Partial<Record<SportId, TvScoreboardStyle>> = {}
  for (const id of ALL_SPORTS) {
    const existing = current.tvScoreboardStyles[id]
    if (
      existing &&
      !isSharedTvStyle(existing) &&
      tvStylesForSport(id).includes(existing)
    ) {
      bySport[id] = existing
    } else {
      bySport[id] = resolveTvStyleForSport(style, id)
    }
  }
  return setUserPreferences({
    tvScoreboardStyle: style,
    tvScoreboardStyles: bySport,
  })
}

export function isUsingSportSpecificTvStyle(sport?: string | null): boolean {
  const prefs = getUserPreferences()
  const id = parseSportId(sport)
  const stored = prefs.tvScoreboardStyles[id]
  return Boolean(
    stored &&
      !isSharedTvStyle(stored) &&
      tvStylesForSport(id).includes(stored),
  )
}

export function getTvScoreboardStyle(sport?: string | null): TvScoreboardStyle {
  const prefs = getUserPreferences()
  const id = parseSportId(sport)
  const stored = prefs.tvScoreboardStyles[id]
  if (
    stored &&
    !isSharedTvStyle(stored) &&
    tvStylesForSport(id).includes(stored)
  ) {
    return stored
  }
  return resolveTvStyleForSport(getSharedTvScoreboardStyle(), id)
}

/**
 * Diseño TV de un deporte.
 * Estilos compartidos → vuelve al tema global.
 * Estilos exclusivos (Arena) → solo ese deporte.
 */
export function setTvScoreboardStyle(
  sport: SportId,
  style: TvScoreboardStyle,
): UserPreferences {
  if (isSharedTvStyle(style)) {
    const shared = getSharedTvScoreboardStyle()
    return setUserPreferences({
      tvScoreboardStyles: { [sport]: shared },
    })
  }

  const resolved = resolveTvStyleForSport(style, sport)
  return setUserPreferences({
    tvScoreboardStyles: { [sport]: resolved },
  })
}

/** Quita el diseño exclusivo y vuelve al tema compartido. */
export function clearSportTvStyleOverride(sport: SportId): UserPreferences {
  return setTvScoreboardStyle(sport, getSharedTvScoreboardStyle())
}

export function getOverlayScoreboardStyle(): OverlayScoreboardStyle {
  return getUserPreferences().overlayScoreboardStyle
}

export function getSavedTeamLogos(): SavedTeamLogo[] {
  return getUserPreferences().savedTeamLogos
}

export function addSavedTeamLogo(name: string, url: string): SavedTeamLogo {
  const current = getUserPreferences()
  const trimmedName = name.trim().slice(0, MAX_SAVED_TEAM_LOGO_NAME)
  const trimmedUrl = url.trim()
  if (!trimmedName) throw new Error('Escribe el nombre del equipo.')
  if (!isHttpLogoUrl(trimmedUrl)) {
    throw new Error('La URL del logo debe empezar por http:// o https://.')
  }
  if (current.savedTeamLogos.some((logo) => logo.url === trimmedUrl)) {
    throw new Error('Esa URL ya está en tu lista.')
  }
  if (current.savedTeamLogos.length >= MAX_SAVED_TEAM_LOGOS) {
    throw new Error(`Puedes guardar hasta ${MAX_SAVED_TEAM_LOGOS} logos.`)
  }
  const logo: SavedTeamLogo = {
    id: generateId(),
    name: trimmedName,
    url: trimmedUrl,
  }
  setUserPreferences({
    savedTeamLogos: [...current.savedTeamLogos, logo],
    selectedSavedLogoId: logo.id,
  })
  return logo
}

export function removeSavedTeamLogo(id: string): UserPreferences {
  const current = getUserPreferences()
  const savedTeamLogos = current.savedTeamLogos.filter((logo) => logo.id !== id)
  const selectedSavedLogoId =
    current.selectedSavedLogoId === id ? null : current.selectedSavedLogoId
  return setUserPreferences({ savedTeamLogos, selectedSavedLogoId })
}

export function setSelectedSavedLogoId(id: string | null): UserPreferences {
  return setUserPreferences({ selectedSavedLogoId: id })
}

export function applyAppTheme(theme: AppTheme = getAppTheme()): void {
  if (typeof document === 'undefined') return
  document.documentElement.dataset.theme = theme
}
