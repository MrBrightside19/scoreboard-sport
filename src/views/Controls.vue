<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useScoreboardStore } from '@/stores/scoreboard'
import { getSportUi } from '@/sports/ui'
import { readMatchIdFromStorage } from '@/utils/localSync'
import { normalizeGameTime } from '@/utils/clock'

const route = useRoute()
const store = useScoreboardStore()
const ready = ref(false)

const matchId = computed(
  () => (route.query.matchId as string) || readMatchIdFromStorage() || '',
)

const sportUi = computed(() => getSportUi(store.state.sport))

watch(
  matchId,
  async (id) => {
    ready.value = false
    if (!id) return
    const local = route.query.local as string | undefined
    const visit = route.query.visit as string | undefined
    const time = route.query.time as string | undefined
    await store.hydrateMatch(
      id,
      local && visit
        ? {
            localTeam: local,
            visitTeam: visit,
            timeGame: normalizeGameTime(time ?? '20:00'),
          }
        : undefined,
    )
    ready.value = true
  },
  { immediate: true },
)
</script>

<template>
  <component :is="sportUi.Controls" v-if="ready || !matchId" />
  <div v-else class="controls-shell">Cargando mesa…</div>
</template>

<style scoped>
.controls-shell {
  min-height: 40vh;
  display: grid;
  place-items: center;
  color: var(--app-text-muted);
}
</style>
