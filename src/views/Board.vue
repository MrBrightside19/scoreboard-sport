<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import ScoreBoard from '@/components/ScoreBoard.vue'
import { useScoreboardStore } from '@/stores/scoreboard'
import { useLocalScoreboardSync } from '@/composables/useLocalScoreboardSync'
import { readMatchIdFromStorage } from '@/utils/localSync'
import { normalizeGameTime } from '@/utils/clock'

const route = useRoute()
const store = useScoreboardStore()
const ready = ref(false)

const matchId = computed(
  () => (route.query.matchId as string) || readMatchIdFromStorage() || '',
)

const matchFallback = computed((): Pick<
  import('@/types/hockeyScoreboard').ScoreboardState,
  'localTeam' | 'visitTeam' | 'timeGame'
> | undefined => {
  const local = route.query.local as string | undefined
  const visit = route.query.visit as string | undefined
  const time = route.query.time as string | undefined
  if (!local || !visit) return undefined
  return { localTeam: local, visitTeam: visit, timeGame: normalizeGameTime(time ?? '20:00') }
})

useLocalScoreboardSync(() => matchId.value)

watch(
  matchId,
  async (id) => {
    ready.value = false
    if (id) {
      await store.hydrateMatch(id, matchFallback.value)
      ready.value = true
    }
  },
  { immediate: true },
)
</script>

<template>
  <ScoreBoard v-if="matchId && ready" tv :state="store.state" />
  <div v-else-if="matchId" class="board-empty">Cargando marcador…</div>
  <div v-else class="board-empty">
    <p>No hay partido activo. Abre la mesa de control y crea un partido.</p>
  </div>
</template>

<style scoped>
.board-empty {
  min-height: 100vh;
  display: grid;
  place-items: center;
  color: rgba(255, 255, 255, 0.5);
}
</style>
