import { type Ref, onMounted, onUnmounted, unref, watch } from 'vue'
import { useScoreboardStore } from '@/stores/scoreboard'
import { onScoreboardSync } from '@/utils/localSync'

export function useLocalScoreboardSync(matchId: Ref<string> | (() => string)) {
  const store = useScoreboardStore()
  let unsubscribe: (() => void) | null = null

  const getId = (): string =>
    typeof matchId === 'function' ? matchId() : unref(matchId)

  onMounted(() => {
    unsubscribe = onScoreboardSync((syncId) => {
      const current = getId()
      if (syncId === current && current) store.loadFromLocal(current)
    })

    watch(
      () => getId(),
      (id) => {
        if (id) store.loadFromLocal(id)
      },
      { immediate: true },
    )
  })

  onUnmounted(() => {
    unsubscribe?.()
  })
}
