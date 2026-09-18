import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useScoreboardStore } from '@/stores/scoreboard'
import { parseTimeToSeconds } from '@/utils/clock'
import { playCountdownBeep } from '@/utils/countdownBeep'
import { playLateGameWarning } from '@/utils/lateGameWarningBeep'
import {
  getCountdownBeepSeconds,
  getLateGameWarningMinutes,
  isLateGameWarningEnabled,
} from '@/utils/userPreferences'

/** Beeps de cuenta regresiva y aviso de últimos minutos (preferencias de Perfil). */
export function useMatchClockAlerts() {
  const store = useScoreboardStore()
  const prefsTick = ref(0)
  let lastCountdownBeepSecond: number | null = null
  let lastIntermissionBeepSecond: number | null = null
  let lateGameWarningKey: string | null = null
  let prevLateGameSeconds: number | null = null

  const countdownBeepSeconds = () => {
    prefsTick.value
    return getCountdownBeepSeconds()
  }
  const lateGameWarningMinutes = () => {
    prefsTick.value
    return getLateGameWarningMinutes()
  }
  const lateGameWarningEnabled = () => {
    prefsTick.value
    return isLateGameWarningEnabled()
  }

  function onPrefsChange(): void {
    prefsTick.value += 1
  }

  watch(
    () => ({
      seconds: parseTimeToSeconds(store.state.timeGame),
      paused: store.state.isPaused,
      intermission: store.state.intermissionActive,
      tick: prefsTick.value,
    }),
    ({ seconds, paused, intermission }) => {
      if (paused || intermission) {
        lastCountdownBeepSecond = null
        return
      }
      const threshold = getCountdownBeepSeconds()
      if (seconds < 0 || seconds > threshold) {
        lastCountdownBeepSecond = null
        return
      }
      if (lastCountdownBeepSecond === seconds) return
      lastCountdownBeepSecond = seconds
      void playCountdownBeep(seconds === 0)
    },
  )

  watch(
    () => ({
      seconds: parseTimeToSeconds(store.state.timeGame),
      period: store.state.gamePeriod,
      paused: store.state.isPaused,
      intermission: store.state.intermissionActive,
      enabled: isLateGameWarningEnabled(),
      minutes: getLateGameWarningMinutes(),
      tick: prefsTick.value,
    }),
    ({ seconds, period, paused, intermission, enabled, minutes }) => {
      const threshold = minutes * 60
      const prev = prevLateGameSeconds
      prevLateGameSeconds = seconds
      if (!enabled || paused || intermission || seconds < 0) return
      const crossed = prev != null && prev > threshold && seconds <= threshold
      if (!crossed) return
      const key = `${period}:${threshold}`
      if (lateGameWarningKey === key) return
      lateGameWarningKey = key
      void playLateGameWarning()
    },
  )

  watch(
    () => ({
      seconds: parseTimeToSeconds(store.state.intermissionTime),
      active: store.state.intermissionActive,
      paused: store.state.isPaused,
      tick: prefsTick.value,
    }),
    ({ seconds, active, paused }) => {
      if (!active || paused) {
        lastIntermissionBeepSecond = null
        return
      }
      const threshold = getCountdownBeepSeconds()
      if (seconds < 0 || seconds > threshold) {
        lastIntermissionBeepSecond = null
        return
      }
      if (lastIntermissionBeepSecond === seconds) return
      lastIntermissionBeepSecond = seconds
      void playCountdownBeep(seconds === 0)
    },
  )

  onMounted(() => {
    window.addEventListener('scoreboard:prefs-change', onPrefsChange)
  })
  onUnmounted(() => {
    window.removeEventListener('scoreboard:prefs-change', onPrefsChange)
  })

  return {
    countdownBeepSeconds,
    lateGameWarningMinutes,
    lateGameWarningEnabled,
  }
}
