<script setup lang="ts">
import { computed } from 'vue'
import HockeyScoreBoard from '@/sports/hockey/HockeyScoreBoard.vue'
import { useScoreboardDisplayPrefs } from '@/composables/useScoreboardDisplayPrefs'
import type { OverlayScoreboardStyle } from '@/config/scoreboardStyles'
import type { ScoreboardState, TeamPenalty } from '@/sports/scoreboardState'

const props = defineProps<{
  state: ScoreboardState
  displayTime?: string
  displayIntermissionTime?: string
  displayPenaltiesLocal?: TeamPenalty[]
  displayPenaltiesVisit?: TeamPenalty[]
  overlayStyle?: OverlayScoreboardStyle
}>()

const { overlayStyle: prefStyle } = useScoreboardDisplayPrefs(() => props.state.sport)
const style = computed(() => props.overlayStyle ?? prefStyle.value)
</script>

<template>
  <HockeyScoreBoard
    overlay
    :overlay-style="style"
    :state="state"
    :display-time="displayTime"
    :display-intermission-time="displayIntermissionTime"
    :display-penalties-local="displayPenaltiesLocal"
    :display-penalties-visit="displayPenaltiesVisit"
  />
</template>
