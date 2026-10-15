import type { SavedMatchRecord, SavedMatchSummary } from '@/types/match'
import type { ScoreboardState } from '@/sports/scoreboardState'
import { normalizeScoreboardState } from '@/sports/scoreboardState'
import { getSportModule } from '@/sports/registry'
import { parseSportId } from '@/types/sport'
import { generateId } from '@/utils/id'
import { isSupabaseConfigured } from '@/services/supabaseClient'
import { supabaseRest } from '@/services/supabaseRest'

const LOCAL_KEY = 'scoredesk-saved-matches'
export const SAVED_MATCHES_SQL_HINT =
  'Falta crear la tabla de partidos guardados. Ejecuta supabase/saved-matches.sql en el SQL Editor de Supabase.'

function isMissingTable(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error)
  return (
    message.includes('saved_matches') ||
    message.includes('42p01') ||
    message.includes('pgrst205') ||
    message.includes('does not exist')
  )
}

function freezeState(state: ScoreboardState): ScoreboardState {
  const cloned = JSON.parse(JSON.stringify(state)) as ScoreboardState
  return normalizeScoreboardState({
    ...cloned,
    isPaused: true,
  })
}

function toSummary(row: SavedMatchRecord): SavedMatchSummary {
  const sport = parseSportId(row.sport || row.state?.sport)
  return {
    id: row.id,
    title: row.title?.trim() || `${row.local_team} vs ${row.visit_team}`,
    localTeam: row.local_team,
    visitTeam: row.visit_team,
    goalLocal: row.goal_local,
    goalVisit: row.goal_visit,
    savedAt: row.saved_at,
    sport,
    sportLabel: getSportModule(sport).label,
  }
}

function localStorageKey(organizerId: string): string {
  return `${LOCAL_KEY}:${organizerId}`
}

function readLocal(organizerId: string): SavedMatchRecord[] {
  try {
    const raw = localStorage.getItem(localStorageKey(organizerId))
    if (!raw) return []
    const parsed = JSON.parse(raw) as SavedMatchRecord[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeLocal(organizerId: string, rows: SavedMatchRecord[]): void {
  localStorage.setItem(localStorageKey(organizerId), JSON.stringify(rows))
}

function buildRecord(
  organizerId: string,
  state: ScoreboardState,
  sourceMatchId: string | null,
): SavedMatchRecord {
  const frozen = freezeState(state)
  const sport = parseSportId(frozen.sport)
  return {
    id: generateId(),
    organizer_id: organizerId,
    source_match_id: sourceMatchId,
    sport,
    title: `${frozen.localTeam} vs ${frozen.visitTeam}`,
    local_team: frozen.localTeam,
    visit_team: frozen.visitTeam,
    goal_local: frozen.goalLocal,
    goal_visit: frozen.goalVisit,
    state: frozen,
    saved_at: new Date().toISOString(),
  }
}

export async function saveMatchSnapshot(
  organizerId: string,
  state: ScoreboardState,
  sourceMatchId?: string | null,
): Promise<SavedMatchRecord> {
  const record = buildRecord(organizerId, state, sourceMatchId ?? null)

  if (!isSupabaseConfigured) {
    writeLocal(organizerId, [record, ...readLocal(organizerId)])
    return record
  }

  try {
    const rows = await supabaseRest<SavedMatchRecord[]>('saved_matches', {
      method: 'POST',
      body: record,
      prefer: 'return=representation',
    })
    const saved = rows[0] ?? record
    writeLocal(organizerId, [saved, ...readLocal(organizerId).filter((row) => row.id !== saved.id)])
    return saved
  } catch (error) {
    writeLocal(organizerId, [record, ...readLocal(organizerId).filter((row) => row.id !== record.id)])
    if (isMissingTable(error)) {
      console.warn(SAVED_MATCHES_SQL_HINT)
      return record
    }
    throw error
  }
}

export async function fetchSavedMatches(organizerId: string): Promise<SavedMatchSummary[]> {
  const local = readLocal(organizerId).map(toSummary)

  if (!isSupabaseConfigured) {
    return local.sort((a, b) => b.savedAt.localeCompare(a.savedAt))
  }

  try {
    const rows = await supabaseRest<SavedMatchRecord[]>(
      `saved_matches?organizer_id=eq.${organizerId}&select=id,organizer_id,source_match_id,sport,title,local_team,visit_team,goal_local,goal_visit,saved_at&order=saved_at.desc`,
    )
    return rows.map((row) =>
      toSummary({
        ...row,
        state: normalizeScoreboardState({}),
      }),
    )
  } catch (error) {
    if (isMissingTable(error)) return local.sort((a, b) => b.savedAt.localeCompare(a.savedAt))
    throw error
  }
}

export async function deleteSavedMatch(
  organizerId: string,
  id: string,
): Promise<void> {
  if (isSupabaseConfigured) {
    try {
      await supabaseRest(
        `saved_matches?id=eq.${encodeURIComponent(id)}&organizer_id=eq.${encodeURIComponent(organizerId)}`,
        { method: 'DELETE' },
      )
    } catch (error) {
      if (!isMissingTable(error)) throw error
    }
  }
  writeLocal(
    organizerId,
    readLocal(organizerId).filter((row) => row.id !== id),
  )
}

export async function fetchSavedMatch(
  organizerId: string,
  id: string,
): Promise<SavedMatchRecord | null> {
  const fromLocal = readLocal(organizerId).find((row) => row.id === id) ?? null

  if (!isSupabaseConfigured) {
    return fromLocal
      ? { ...fromLocal, state: freezeState(fromLocal.state) }
      : null
  }

  try {
    const rows = await supabaseRest<SavedMatchRecord[]>(
      `saved_matches?id=eq.${id}&organizer_id=eq.${organizerId}&select=*`,
    )
    const row = rows[0]
    if (!row) return fromLocal ? { ...fromLocal, state: freezeState(fromLocal.state) } : null
    return {
      ...row,
      sport: parseSportId(row.sport || row.state?.sport),
      state: freezeState(row.state),
    }
  } catch (error) {
    if (isMissingTable(error)) {
      return fromLocal ? { ...fromLocal, state: freezeState(fromLocal.state) } : null
    }
    throw error
  }
}
