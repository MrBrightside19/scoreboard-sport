<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import ScoreBoard from '@/components/ScoreBoard.vue'
import { useRemoteHockeyBoardCore } from '@/composables/useRemoteHockeyBoardCore'
import { createDefaultScoreboardState } from '@/types/hockeyScoreboard'

const route = useRoute()
const matchId = computed(() => route.params.matchId as string)

const { remoteState, loading, error, displayTime, displayPenaltiesLocal, displayPenaltiesVisit } =
  useRemoteHockeyBoardCore(() => matchId.value)

const displayState = computed(
  () => remoteState.value ?? createDefaultScoreboardState(),
)
</script>

<template>
  <a-spin :spinning="loading" size="large">
    <a-alert
      v-if="error"
      type="error"
      :message="error"
      show-icon
      style="margin: 1rem"
    />
    <ScoreBoard
      :state="displayState"
      :display-time="displayTime"
      :display-penalties-local="displayPenaltiesLocal"
      :display-penalties-visit="displayPenaltiesVisit"
    />
  </a-spin>
</template>
