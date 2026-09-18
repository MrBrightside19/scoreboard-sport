<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useRemoteScoreboard } from '@/composables/useRemoteScoreboard'
import { createDefaultScoreboardState } from '@/sports/scoreboardState'
import { getSportUi } from '@/sports/ui'
import ScoreboardBrandMark from '@/components/ScoreboardBrandMark.vue'

const route = useRoute()
const matchId = computed(() => route.params.matchId as string)
const {
  remoteState,
  displayTime,
  displayIntermissionTime,
  displayPenaltiesLocal,
  displayPenaltiesVisit,
} = useRemoteScoreboard(() => matchId.value)

const displayState = computed(
  () => remoteState.value ?? createDefaultScoreboardState(),
)
const sportUi = computed(() => getSportUi(displayState.value.sport))
</script>

<template>
  <div class="overlay-root">
    <component
      :is="sportUi.Overlay"
      :state="displayState"
      :display-time="displayTime"
      :display-intermission-time="displayIntermissionTime"
      :display-penalties-local="displayPenaltiesLocal"
      :display-penalties-visit="displayPenaltiesVisit"
    />
    <ScoreboardBrandMark v-if="displayState.showBranding" compact />
  </div>
</template>

<style scoped>
.overlay-root {
  position: relative;
  min-height: 100vh;
  background: transparent;
}
</style>
