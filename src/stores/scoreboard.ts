import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { ScoreboardState } from '@/types/hockeyScoreboard'
import { createDefaultScoreboardState } from '@/types/hockeyScoreboard'
import { fetchMatchState } from '@/services/matchSync'
import { isSupabaseConfigured } from '@/services/supabaseClient'
import {
  dispatchScoreboardSync,
  getStorageKey,
  writeMatchIdToStorage,
} from '@/utils/localSync'
import { tickDown } from '@/utils/clock'

export const useScoreboardStore = defineStore('scoreboard', () => {
  const matchId = ref<string | null>(null)
  const state = ref<ScoreboardState>(createDefaultScoreboardState())
  const isWriter = ref(false)
  const tickInterval = ref<number | null>(null)

  function setMatch(id: string, initial?: ScoreboardState): void {
    matchId.value = id
    writeMatchIdToStorage(id)
    if (initial) {
      state.value = { ...initial }
    } else {
      const stored = localStorage.getItem(getStorageKey(id))
      if (stored) {
        state.value = JSON.parse(stored) as ScoreboardState
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

    const applyFallback = (state: ScoreboardState): ScoreboardState => {
      if (!fallback?.localTeam || !fallback?.visitTeam) return state
      const isDefault =
        state.localTeam === 'Local' && state.visitTeam === 'Visita'
      if (!isDefault) return state
      return {
        ...state,
        localTeam: fallback.localTeam,
        visitTeam: fallback.visitTeam,
        timeGame: fallback.timeGame ?? state.timeGame,
      }
    }

    if (isSupabaseConfigured) {
      try {
        const record = await fetchMatchState(id)
        if (record?.state) {
          state.value = applyFallback({ ...record.state })
          persistLocal()
          return
        }
      } catch {
        // Continuar con localStorage o valores por defecto
      }
    }

    const stored = localStorage.getItem(getStorageKey(id))
    if (stored) {
      state.value = applyFallback(JSON.parse(stored) as ScoreboardState)
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

  function persistLocal(): void {
    if (!matchId.value) return
    localStorage.setItem(getStorageKey(matchId.value), JSON.stringify(state.value))
    dispatchScoreboardSync(matchId.value)
  }

  function loadFromLocal(id: string): void {
    const stored = localStorage.getItem(getStorageKey(id))
    if (stored) {
      state.value = JSON.parse(stored) as ScoreboardState
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
    patch({ timeGame: time })
  }

  function togglePenalty(team: 'local' | 'visit'): void {
    if (team === 'local') {
      patch({ penalizedLocal: !state.value.penalizedLocal })
    } else {
      patch({ penalizedVisit: !state.value.penalizedVisit })
    }
  }

  function resetPenalty(): void {
    patch({ penaltyGame: '02:00' })
  }

  function startWriterTick(): void {
    if (tickInterval.value) return
    isWriter.value = true
    tickInterval.value = window.setInterval(() => {
      if (state.value.isPaused) return

      let next: Partial<ScoreboardState> = {
        timeGame: tickDown(state.value.timeGame),
        updatedAt: new Date().toISOString(),
      }

      if (state.value.penalizedLocal || state.value.penalizedVisit) {
        const penalty = tickDown(state.value.penaltyGame)
        next = { ...next, penaltyGame: penalty }
        if (penalty === '00:00') {
          next.penalizedLocal = false
          next.penalizedVisit = false
          next.penaltyGame = '02:00'
        }
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
    state.value = { ...next }
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
    togglePenalty,
    resetPenalty,
    startWriterTick,
    stopWriterTick,
    replaceState,
    persistLocal,
  }
})
