import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { ScoreboardState } from '@/types/hockeyScoreboard'
import { createDefaultScoreboardState } from '@/types/hockeyScoreboard'
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
