import { onMounted, onUnmounted, ref } from 'vue'
import {
  getOverlayScoreboardStyle,
  getTvScoreboardStyle,
} from '@/utils/userPreferences'
import type {
  OverlayScoreboardStyle,
  TvScoreboardStyle,
} from '@/config/scoreboardStyles'

/** Preferencias de estilo de marcador TV/overlay, reactivas a cambios locales. */
export function useScoreboardDisplayPrefs() {
  const tvStyle = ref<TvScoreboardStyle>(getTvScoreboardStyle())
  const overlayStyle = ref<OverlayScoreboardStyle>(getOverlayScoreboardStyle())

  function sync(): void {
    tvStyle.value = getTvScoreboardStyle()
    overlayStyle.value = getOverlayScoreboardStyle()
  }

  onMounted(() => {
    sync()
    window.addEventListener('scoreboard:prefs-change', sync)
    window.addEventListener('storage', sync)
  })

  onUnmounted(() => {
    window.removeEventListener('scoreboard:prefs-change', sync)
    window.removeEventListener('storage', sync)
  })

  return { tvStyle, overlayStyle, sync }
}
