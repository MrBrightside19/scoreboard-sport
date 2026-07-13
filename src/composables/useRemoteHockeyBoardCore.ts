import { ref, onMounted, onUnmounted } from 'vue'
import type { ScoreboardState, TeamPenalty } from '@/types/hockeyScoreboard'
import { getLiveClockUpdateMs } from '@/config/poll'
import { interpolateClock, interpolatePenaltyTime, parseTimeToSeconds } from '@/utils/clock'
import { fetchMatchState } from '@/services/matchSync'
import { normalizeScoreboardState } from '@/types/hockeyScoreboard'

export function useRemoteHockeyBoardCore(matchId: () => string | null) {
  const remoteState = ref<ScoreboardState | null>(null)
  const loading = ref(true)
  const error = ref<string | null>(null)
  const displayTime = ref('20:00')
  const displayIntermissionTime = ref('05:00')
  const displayPenaltiesLocal = ref<TeamPenalty[]>([])
  const displayPenaltiesVisit = ref<TeamPenalty[]>([])

  let pollTimer: number | null = null
  let clockTimer: number | null = null

  function interpolatePenalties(
    penalties: TeamPenalty[],
    isPaused: boolean,
    updatedAt: string,
    timeGame: string,
  ): TeamPenalty[] {
    return penalties
      .map((penalty) => ({
        ...penalty,
        time: interpolatePenaltyTime(penalty.time, isPaused, updatedAt, timeGame),
      }))
      .filter((penalty) => parseTimeToSeconds(penalty.time) > 0)
  }

  function updateDisplayClock(): void {
    if (!remoteState.value) return
    const {
      timeGame,
      isPaused,
      updatedAt,
      penaltiesLocal,
      penaltiesVisit,
      intermissionActive,
      intermissionTime,
    } = remoteState.value

    if (intermissionActive) {
      displayIntermissionTime.value = interpolateClock(
        intermissionTime,
        isPaused,
        updatedAt,
      )
      displayTime.value = timeGame
    } else {
      displayTime.value = interpolateClock(timeGame, isPaused, updatedAt)
      displayIntermissionTime.value = intermissionTime
    }

    displayPenaltiesLocal.value = interpolatePenalties(
      penaltiesLocal,
      isPaused || intermissionActive,
      updatedAt,
      timeGame,
    )
    displayPenaltiesVisit.value = interpolatePenalties(
      penaltiesVisit,
      isPaused || intermissionActive,
      updatedAt,
      timeGame,
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
    pollTimer = window.setInterval(() => void poll(), getLiveClockUpdateMs())
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
    displayIntermissionTime,
    displayPenaltiesLocal,
    displayPenaltiesVisit,
    refresh: poll,
  }
}
