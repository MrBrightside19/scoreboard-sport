import { ref, onMounted, onUnmounted } from 'vue'
import type { ScoreboardState } from '@/types/hockeyScoreboard'
import { getPollIntervalMs } from '@/config/poll'
import { interpolateClock } from '@/utils/clock'
import { fetchMatchState } from '@/services/matchSync'

export function useRemoteHockeyBoardCore(matchId: () => string | null) {
  const remoteState = ref<ScoreboardState | null>(null)
  const loading = ref(true)
  const error = ref<string | null>(null)
  const displayTime = ref('20:00')
  const displayPenalty = ref('02:00')

  let pollTimer: number | null = null
  let clockTimer: number | null = null

  function updateDisplayClock(): void {
    if (!remoteState.value) return
    displayTime.value = interpolateClock(
      remoteState.value.timeGame,
      remoteState.value.isPaused,
      remoteState.value.updatedAt,
    )
    if (remoteState.value.penalizedLocal || remoteState.value.penalizedVisit) {
      displayPenalty.value = interpolateClock(
        remoteState.value.penaltyGame,
        remoteState.value.isPaused,
        remoteState.value.updatedAt,
      )
    } else {
      displayPenalty.value = remoteState.value.penaltyGame
    }
  }

  async function poll(): Promise<void> {
    const id = matchId()
    if (!id) return
    try {
      const record = await fetchMatchState(id)
      if (record?.state) {
        remoteState.value = record.state
        updateDisplayClock()
      }
      error.value = null
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Error al cargar marcador'
    } finally {
      loading.value = false
    }
  }

  onMounted(() => {
    void poll()
    pollTimer = window.setInterval(() => void poll(), getPollIntervalMs())
    clockTimer = window.setInterval(updateDisplayClock, 250)
  })

  onUnmounted(() => {
    if (pollTimer) clearInterval(pollTimer)
    if (clockTimer) clearInterval(clockTimer)
  })

  return {
    remoteState,
    loading,
    error,
    displayTime,
    displayPenalty,
    refresh: poll,
  }
}
