import { ref, onMounted, onUnmounted } from 'vue'
import type { ScoreboardState, TeamPenalty } from '@/sports/scoreboardState'
import { getLiveClockUpdateMs } from '@/config/poll'
import {
  interpolateClock,
  interpolatePenaltyTime,
  isImplausibleRunningClockRewind,
  isOlderTimestamp,
  parseTimeToSeconds,
} from '@/utils/clock'
import { clockDirection, periodEndClockSeconds } from '@/sports/clockRules'
import { fetchMatchState } from '@/services/matchSync'
import { normalizeScoreboardState } from '@/sports/scoreboardState'

export function useRemoteScoreboard(matchId: () => string | null) {
  const remoteState = ref<ScoreboardState | null>(null)
  const loading = ref(true)
  const error = ref<string | null>(null)
  const displayTime = ref('20:00')
  const displayIntermissionTime = ref('05:00')
  const displayPenaltiesLocal = ref<TeamPenalty[]>([])
  const displayPenaltiesVisit = ref<TeamPenalty[]>([])

  let pollTimer: number | null = null
  let clockTimer: number | null = null
  let pollSeq = 0

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

  function interpolatedPlayTime(snapshot: ScoreboardState, now = Date.now()): string {
    const direction = clockDirection(snapshot.sport)
    return interpolateClock(
      snapshot.timeGame,
      snapshot.isPaused,
      snapshot.updatedAt,
      now,
      direction,
      direction === 'up' ? periodEndClockSeconds(snapshot) : undefined,
    )
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
      displayTime.value = interpolatedPlayTime(remoteState.value)
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

  function applyRemoteSnapshot(raw: unknown): void {
    const incoming = normalizeScoreboardState(raw)
    const previous = remoteState.value
    if (previous && isOlderTimestamp(incoming.updatedAt, previous.updatedAt)) {
      return
    }

    let next = incoming
    if (
      previous &&
      !incoming.isPaused &&
      !incoming.intermissionActive &&
      !previous.isPaused &&
      !previous.intermissionActive &&
      incoming.gamePeriod === previous.gamePeriod &&
      incoming.sport === previous.sport
    ) {
      const direction = clockDirection(incoming.sport)
      const incomingSeconds = parseTimeToSeconds(interpolatedPlayTime(incoming))
      const displayedSeconds = parseTimeToSeconds(displayTime.value)
      if (
        isImplausibleRunningClockRewind(direction, displayedSeconds, incomingSeconds)
      ) {
        next = {
          ...incoming,
          timeGame: previous.timeGame,
          updatedAt: previous.updatedAt,
        }
      }
    }

    remoteState.value = next
    updateDisplayClock()
  }

  async function poll(): Promise<void> {
    const id = matchId()
    if (!id) return
    const seq = ++pollSeq
    try {
      const record = await fetchMatchState(id)
      if (seq !== pollSeq) return
      if (record?.state) {
        applyRemoteSnapshot(record.state)
      }
      error.value = null
    } catch (err) {
      if (seq !== pollSeq) return
      error.value = err instanceof Error ? err.message : 'Error al cargar marcador'
    } finally {
      if (seq === pollSeq) loading.value = false
    }
  }

  onMounted(() => {
    void poll()
    pollTimer = window.setInterval(() => void poll(), getLiveClockUpdateMs())
    clockTimer = window.setInterval(updateDisplayClock, 250)
  })

  onUnmounted(() => {
    pollSeq += 1
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
