import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { ScoreboardState, TeamPenalty } from '@/types/hockeyScoreboard'
import {
  createDefaultScoreboardState,
  DEFAULT_PENALTY_TIME,
  MAX_PENALTIES_PER_TEAM,
  normalizeScoreboardState,
} from '@/types/hockeyScoreboard'
import { fetchMatchState } from '@/services/matchSync'
import { isSupabaseConfigured } from '@/services/supabaseClient'
import {
  dispatchScoreboardSync,
  getStorageKey,
  writeMatchIdToStorage,
} from '@/utils/localSync'
import { normalizeGameTime, parseTimeToSeconds, tickDown, interpolateClock } from '@/utils/clock'

export const useScoreboardStore = defineStore('scoreboard', () => {
  const matchId = ref<string | null>(null)
  const state = ref<ScoreboardState>(createDefaultScoreboardState())
  const isWriter = ref(false)
  const tickInterval = ref<number | null>(null)

  function applyState(raw: unknown): ScoreboardState {
    return normalizeScoreboardState(raw)
  }

  function setMatch(id: string, initial?: ScoreboardState): void {
    matchId.value = id
    writeMatchIdToStorage(id)
    if (initial) {
      state.value = applyState(initial)
    } else {
      const stored = localStorage.getItem(getStorageKey(id))
      if (stored) {
        state.value = applyState(JSON.parse(stored) as ScoreboardState)
      } else {
        state.value = createDefaultScoreboardState()
      }
    }
    persistLocal()
  }

  async function hydrateMatch(
    id: string,
    fallback?: Pick<ScoreboardState, 'localTeam' | 'visitTeam' | 'timeGame'>,
  ): Promise<void> {
    matchId.value = id
    writeMatchIdToStorage(id)

    const applyFallback = (next: ScoreboardState): ScoreboardState => {
      if (!fallback?.localTeam || !fallback?.visitTeam) return next
      const isDefault =
        next.localTeam === 'Local' && next.visitTeam === 'Visita'
      if (!isDefault) return next
      return {
        ...next,
        localTeam: fallback.localTeam,
        visitTeam: fallback.visitTeam,
        timeGame: fallback.timeGame ?? next.timeGame,
      }
    }

    if (isSupabaseConfigured) {
      try {
        const record = await fetchMatchState(id)
        if (record?.state) {
          state.value = applyFallback(applyState(record.state))
          persistLocal()
          return
        }
      } catch {
        // Continuar con localStorage o valores por defecto
      }
    }

    const stored = localStorage.getItem(getStorageKey(id))
    if (stored) {
      state.value = applyFallback(applyState(JSON.parse(stored) as ScoreboardState))
      persistLocal()
      return
    }

    if (fallback?.localTeam && fallback?.visitTeam) {
      state.value = createDefaultScoreboardState(
        fallback.localTeam,
        fallback.visitTeam,
        fallback.timeGame,
      )
      persistLocal()
      return
    }

    state.value = createDefaultScoreboardState()
    persistLocal()
  }

  function syncElapsedAndPause(): void {
    if (state.value.isPaused) {
      patch({ updatedAt: new Date().toISOString() })
      return
    }

    const syncedTime = interpolateClock(
      state.value.timeGame,
      state.value.isPaused,
      state.value.updatedAt,
    )

    const syncedPenaltiesLocal = interpolatePenalties(
      state.value.penaltiesLocal,
      state.value.isPaused,
      state.value.updatedAt,
    )
    const syncedPenaltiesVisit = interpolatePenalties(
      state.value.penaltiesVisit,
      state.value.isPaused,
      state.value.updatedAt,
    )

    state.value = {
      ...state.value,
      timeGame: syncedTime,
      penaltiesLocal: syncedPenaltiesLocal,
      penaltiesVisit: syncedPenaltiesVisit,
      isPaused: true,
      updatedAt: new Date().toISOString(),
    }
    persistLocal()
  }

  function persistLocal(): void {
    if (!matchId.value) return
    localStorage.setItem(getStorageKey(matchId.value), JSON.stringify(state.value))
    dispatchScoreboardSync(matchId.value)
  }

  function loadFromLocal(id: string): void {
    const stored = localStorage.getItem(getStorageKey(id))
    if (stored) {
      state.value = applyState(JSON.parse(stored) as ScoreboardState)
      matchId.value = id
    }
  }

  function patch(partial: Partial<ScoreboardState>): void {
    state.value = {
      ...state.value,
      ...partial,
      updatedAt: new Date().toISOString(),
    }
    persistLocal()
  }

  function adjustGoal(team: 'local' | 'visit', delta: number): void {
    if (team === 'local') {
      patch({ goalLocal: Math.max(0, state.value.goalLocal + delta) })
    } else {
      patch({ goalVisit: Math.max(0, state.value.goalVisit + delta) })
    }
  }

  function togglePause(): void {
    patch({ isPaused: !state.value.isPaused })
  }

  function setPeriod(period: number): void {
    patch({ gamePeriod: Math.max(1, period) })
  }

  function setTeams(localTeam: string, visitTeam: string): void {
    patch({ localTeam, visitTeam })
  }

  function setGameTime(time: string): void {
    patch({ timeGame: normalizeGameTime(time) })
  }

  function penaltiesKey(team: 'local' | 'visit'): 'penaltiesLocal' | 'penaltiesVisit' {
    return team === 'local' ? 'penaltiesLocal' : 'penaltiesVisit'
  }

  function addPenalty(team: 'local' | 'visit'): void {
    const key = penaltiesKey(team)
    const list = [...state.value[key]]
    if (list.length >= MAX_PENALTIES_PER_TEAM) return
    list.push({ player: '', time: DEFAULT_PENALTY_TIME })
    patch({ [key]: list })
  }

  function removePenalty(team: 'local' | 'visit', index: number): void {
    const key = penaltiesKey(team)
    const list = [...state.value[key]]
    list.splice(index, 1)
    patch({ [key]: list })
  }

  function setPenaltyPlayer(team: 'local' | 'visit', index: number, player: string): void {
    const key = penaltiesKey(team)
    const list = [...state.value[key]]
    if (!list[index]) return
    list[index] = { ...list[index], player }
    patch({ [key]: list })
  }

  function setPenaltyTime(team: 'local' | 'visit', index: number, time: string): void {
    const key = penaltiesKey(team)
    const list = [...state.value[key]]
    if (!list[index]) return
    list[index] = { ...list[index], time: normalizeGameTime(time) }
    patch({ [key]: list })
  }

  function tickPenaltyList(penalties: TeamPenalty[]): TeamPenalty[] {
    return penalties
      .map((penalty) => ({ ...penalty, time: tickDown(penalty.time) }))
      .filter((penalty) => parseTimeToSeconds(penalty.time) > 0)
  }

  function interpolatePenalties(
    penalties: TeamPenalty[],
    isPaused: boolean,
    updatedAt: string,
  ): TeamPenalty[] {
    return penalties
      .map((penalty) => ({
        ...penalty,
        time: interpolateClock(penalty.time, isPaused, updatedAt),
      }))
      .filter((penalty) => parseTimeToSeconds(penalty.time) > 0)
  }

  function startWriterTick(): void {
    if (tickInterval.value) return
    isWriter.value = true
    tickInterval.value = window.setInterval(() => {
      if (state.value.isPaused) return

      const next: Partial<ScoreboardState> = {
        timeGame: tickDown(state.value.timeGame),
        penaltiesLocal: tickPenaltyList(state.value.penaltiesLocal),
        penaltiesVisit: tickPenaltyList(state.value.penaltiesVisit),
        updatedAt: new Date().toISOString(),
      }

      state.value = { ...state.value, ...next }
      persistLocal()
    }, 1000)
  }

  function stopWriterTick(): void {
    isWriter.value = false
    if (tickInterval.value) {
      clearInterval(tickInterval.value)
      tickInterval.value = null
    }
  }

  function replaceState(next: ScoreboardState): void {
    state.value = applyState(next)
    if (matchId.value) persistLocal()
  }

  return {
    matchId,
    state,
    isWriter,
    setMatch,
    hydrateMatch,
    loadFromLocal,
    patch,
    adjustGoal,
    togglePause,
    setPeriod,
    setTeams,
    setGameTime,
    addPenalty,
    removePenalty,
    setPenaltyPlayer,
    setPenaltyTime,
    startWriterTick,
    stopWriterTick,
    replaceState,
    persistLocal,
    syncElapsedAndPause,
  }
})
