import { onMounted, onUnmounted, ref } from 'vue'
import { useScoreboardStore } from '@/stores/scoreboard'
import { parseTimeToSeconds } from '@/utils/clock'
import { remainingClockSeconds, remainingUntilPeriodEndSeconds } from '@/sports/clockRules'
import { playCountdownBeep, unlockBeepAudio } from '@/utils/countdownBeep'
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
  let playAlertTimer: number | null = null

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

  /** El store no materializa cada segundo: hay que usar el reloj interpolado. */
  function liveGameClock(): string {
    if (store.state.intermissionActive) return store.state.timeGame
    return store.currentDisplayClock()
  }

  function beepIfInWindow(seconds: number, last: number | null): number | null {
    const threshold = getCountdownBeepSeconds()
    if (seconds < 0 || seconds > threshold) return null
    if (last === seconds) return last
    void playCountdownBeep(seconds === 0)
    return seconds
  }

  function scanPlayCountdownBeep(): void {
    if (store.state.intermissionActive) {
      lastCountdownBeepSecond = null
      const seconds = parseTimeToSeconds(store.currentDisplayClock())
      if (store.state.isPaused && seconds > 0) {
        lastIntermissionBeepSecond = null
        return
      }
      lastIntermissionBeepSecond = beepIfInWindow(seconds, lastIntermissionBeepSecond)
      return
    }

    lastIntermissionBeepSecond = null
    const seconds = remainingUntilPeriodEndSeconds({
      ...store.state,
      timeGame: liveGameClock(),
    })
    if (store.state.isPaused && seconds > 0) {
      lastCountdownBeepSecond = null
      return
    }
    lastCountdownBeepSecond = beepIfInWindow(seconds, lastCountdownBeepSecond)
  }

  function scanLateGameWarning(): void {
    const seconds = remainingClockSeconds({
      ...store.state,
      timeGame: liveGameClock(),
    })
    const period = store.state.gamePeriod
    const paused = store.state.isPaused
    const intermission = store.state.intermissionActive
    const enabled = isLateGameWarningEnabled()
    const minutes = getLateGameWarningMinutes()
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
  }

  function scanAlerts(): void {
    scanPlayCountdownBeep()
    scanLateGameWarning()
  }

  onMounted(() => {
    window.addEventListener('scoreboard:prefs-change', onPrefsChange)
    window.addEventListener('pointerdown', unlockBeepAudio, { once: true })
    window.addEventListener('keydown', unlockBeepAudio, { once: true })
    playAlertTimer = window.setInterval(scanAlerts, 200)
  })
  onUnmounted(() => {
    window.removeEventListener('scoreboard:prefs-change', onPrefsChange)
    window.removeEventListener('pointerdown', unlockBeepAudio)
    window.removeEventListener('keydown', unlockBeepAudio)
    if (playAlertTimer != null) {
      clearInterval(playAlertTimer)
      playAlertTimer = null
    }
  })

  return {
    countdownBeepSeconds,
    lateGameWarningMinutes,
    lateGameWarningEnabled,
  }
}
