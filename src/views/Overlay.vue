<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import ScoreBoard from '@/components/ScoreBoard.vue'
import { useRemoteHockeyBoardCore } from '@/composables/useRemoteHockeyBoardCore'
import { createDefaultScoreboardState } from '@/types/hockeyScoreboard'
import { useScoreboardDisplayPrefs } from '@/composables/useScoreboardDisplayPrefs'

const route = useRoute()
const matchId = computed(() => route.params.matchId as string)
const { overlayStyle } = useScoreboardDisplayPrefs()

const { remoteState, displayTime, displayIntermissionTime, displayPenaltiesLocal, displayPenaltiesVisit } =
  useRemoteHockeyBoardCore(() => matchId.value)

const displayState = computed(
  () => remoteState.value ?? createDefaultScoreboardState(),
)
</script>

<template>
  <div class="overlay-root">
    <ScoreBoard
      overlay
      :overlay-style="overlayStyle"
      :state="displayState"
      :display-time="displayTime"
      :display-intermission-time="displayIntermissionTime"
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
