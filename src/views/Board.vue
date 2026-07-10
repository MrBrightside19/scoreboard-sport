<script setup lang="ts">
import { computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import ScoreBoard from '@/components/ScoreBoard.vue'
import { useScoreboardStore } from '@/stores/scoreboard'
import { useLocalScoreboardSync } from '@/composables/useLocalScoreboardSync'
import { readMatchIdFromStorage } from '@/utils/localSync'

const route = useRoute()
const store = useScoreboardStore()

const matchId = computed(
  () => (route.query.matchId as string) || readMatchIdFromStorage() || '',
)

useLocalScoreboardSync(() => matchId.value)

watch(
  matchId,
  (id) => {
    if (id) store.setMatch(id)
  },
  { immediate: true },
)
</script>

<template>
  <ScoreBoard v-if="matchId" :state="store.state" />
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
