import { ref, onMounted, onUnmounted } from 'vue'
import type { ScoreboardState, TeamPenalty } from '@/types/hockeyScoreboard'
import { getPollIntervalMs } from '@/config/poll'
import { interpolateClock, parseTimeToSeconds } from '@/utils/clock'
import { fetchMatchState } from '@/services/matchSync'
import { normalizeScoreboardState } from '@/types/hockeyScoreboard'

export function useRemoteHockeyBoardCore(matchId: () => string | null) {
  const remoteState = ref<ScoreboardState | null>(null)
  const loading = ref(true)
  const error = ref<string | null>(null)
  const displayTime = ref('20:00')
  const displayPenaltiesLocal = ref<TeamPenalty[]>([])
  const displayPenaltiesVisit = ref<TeamPenalty[]>([])

  let pollTimer: number | null = null
  let clockTimer: number | null = null

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

  function updateDisplayClock(): void {
    if (!remoteState.value) return
    displayTime.value = interpolateClock(
      remoteState.value.timeGame,
      remoteState.value.isPaused,
      remoteState.value.updatedAt,
    )
    displayPenaltiesLocal.value = interpolatePenalties(
      remoteState.value.penaltiesLocal,
      remoteState.value.isPaused,
      remoteState.value.updatedAt,
    )
    displayPenaltiesVisit.value = interpolatePenalties(
      remoteState.value.penaltiesVisit,
      remoteState.value.isPaused,
      remoteState.value.updatedAt,
    )
  }

  async function poll(): Promise<void> {
    const id = matchId()
    if (!id) return
    try {
      const record = await fetchMatchState(id)
      if (record?.state) {
        remoteState.value = normalizeScoreboardState(record.state)
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
    displayPenaltiesLocal,
    displayPenaltiesVisit,
    refresh: poll,
  }
}
