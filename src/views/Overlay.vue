<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import ScoreBoard from '@/components/ScoreBoard.vue'
import { useRemoteHockeyBoardCore } from '@/composables/useRemoteHockeyBoardCore'
import { createDefaultScoreboardState } from '@/types/hockeyScoreboard'

const route = useRoute()
const matchId = computed(() => route.params.matchId as string)

const { remoteState, displayTime, displayPenaltiesLocal, displayPenaltiesVisit } =
  useRemoteHockeyBoardCore(() => matchId.value)

const displayState = computed(
  () => remoteState.value ?? createDefaultScoreboardState(),
)
</script>

<template>
  <div class="overlay-root">
    <ScoreBoard
      overlay
      :state="displayState"
      :display-time="displayTime"
      :display-penalties-local="displayPenaltiesLocal"
      :display-penalties-visit="displayPenaltiesVisit"
    />
  </div>
</template>

<style scoped>
.overlay-root {
  min-height: 100vh;
  background: transparent;
}
</style>
