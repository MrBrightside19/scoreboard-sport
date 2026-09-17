import { onMounted, onUnmounted, ref, toValue, watch, type MaybeRefOrGetter } from 'vue'
import {
  getOverlayScoreboardStyle,
  getTvScoreboardStyle,
} from '@/utils/userPreferences'
import type {
  OverlayScoreboardStyle,
  TvScoreboardStyle,
} from '@/config/scoreboardStyles'

/** Preferencias de estilo TV/overlay, filtradas por deporte. */
export function useScoreboardDisplayPrefs(
  sport?: MaybeRefOrGetter<string | null | undefined>,
) {
  const tvStyle = ref<TvScoreboardStyle>(getTvScoreboardStyle(toValue(sport)))
  const overlayStyle = ref<OverlayScoreboardStyle>(getOverlayScoreboardStyle())

  function sync(): void {
    tvStyle.value = getTvScoreboardStyle(toValue(sport))
    overlayStyle.value = getOverlayScoreboardStyle()
  }

  watch(() => toValue(sport), sync)

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
