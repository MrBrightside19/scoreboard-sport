import { computed, onMounted, onUnmounted, ref } from 'vue'
import {
  addSavedTeamLogo,
  getUserPreferences,
  removeSavedTeamLogo,
  setSelectedSavedLogoId,
  type SavedTeamLogo,
} from '@/utils/userPreferences'

export function useSavedTeamLogos() {
  const tick = ref(0)

  function refresh(): void {
    tick.value += 1
  }

  const logos = computed((): SavedTeamLogo[] => {
    tick.value
    return getUserPreferences().savedTeamLogos
  })

  const selectedId = computed(() => {
    tick.value
    return getUserPreferences().selectedSavedLogoId
  })

  const selected = computed(
    () => logos.value.find((logo) => logo.id === selectedId.value) ?? null,
  )

  function selectLogo(id: string | null): void {
    setSelectedSavedLogoId(id)
  }

  function addLogo(name: string, url: string): SavedTeamLogo {
    return addSavedTeamLogo(name, url)
  }

  function removeLogo(id: string): void {
    removeSavedTeamLogo(id)
  }

  onMounted(() => {
    window.addEventListener('scoreboard:prefs-change', refresh)
  })
  onUnmounted(() => {
    window.removeEventListener('scoreboard:prefs-change', refresh)
  })

  return {
    logos,
    selected,
    selectedId,
    selectLogo,
    addLogo,
    removeLogo,
  }
}
