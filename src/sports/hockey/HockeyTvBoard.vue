<script setup lang="ts">
import { computed } from 'vue'
import HockeyArenaBoard from '@/sports/hockey/HockeyArenaBoard.vue'
import HockeyScoreBoard from '@/sports/hockey/HockeyScoreBoard.vue'
import { useScoreboardDisplayPrefs } from '@/composables/useScoreboardDisplayPrefs'
import {
  isArenaTvStyle,
  isClassicLightTvStyle,
  type TvScoreboardStyle,
} from '@/config/scoreboardStyles'
import type { ScoreboardState, TeamPenalty } from '@/sports/scoreboardState'

const props = defineProps<{
  state: ScoreboardState
  displayTime?: string
  displayIntermissionTime?: string
  displayPenaltiesLocal?: TeamPenalty[]
  displayPenaltiesVisit?: TeamPenalty[]
  preview?: boolean
  tvStyle?: TvScoreboardStyle
}>()

const { tvStyle: prefStyle } = useScoreboardDisplayPrefs(() => 'hockey')
const style = computed(() => props.tvStyle ?? prefStyle.value)
</script>

<template>
  <HockeyArenaBoard
    v-if="isArenaTvStyle(style)"
    :state="state"
    :preview="preview"
    :display-time="displayTime"
    :display-intermission-time="displayIntermissionTime"
    :display-penalties-local="displayPenaltiesLocal"
    :display-penalties-visit="displayPenaltiesVisit"
  />
  <HockeyScoreBoard
    v-else
    tv
    :tv-light="isClassicLightTvStyle(style)"
    :state="state"
    :display-time="displayTime"
    :display-intermission-time="displayIntermissionTime"
    :display-penalties-local="displayPenaltiesLocal"
    :display-penalties-visit="displayPenaltiesVisit"
  />
</template>
