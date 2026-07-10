<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import ScoreBoard from '@/components/ScoreBoard.vue'
import { useRemoteHockeyBoardCore } from '@/composables/useRemoteHockeyBoardCore'
import { createDefaultScoreboardState } from '@/types/hockeyScoreboard'

const route = useRoute()
const matchId = computed(() => route.params.matchId as string)

const { remoteState, displayTime, displayPenalty } =
  useRemoteHockeyBoardCore(() => matchId.value)

const displayState = computed(
  () => remoteState.value ?? createDefaultScoreboardState(),
)
</script>

<template>
  <ScoreBoard
    overlay
    :state="displayState"
    :display-time="displayTime"
    :display-penalty="displayPenalty"
  />
</template>
