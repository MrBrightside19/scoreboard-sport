<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import HockeyArenaBoard from '@/sports/hockey/HockeyArenaBoard.vue'
import HockeyScoreBoard from '@/sports/hockey/HockeyScoreBoard.vue'
import { useScoreboardDisplayPrefs } from '@/composables/useScoreboardDisplayPrefs'
import {
  isArenaTvStyle,
  isClassicLightTvStyle,
  type TvScoreboardStyle,
} from '@/config/scoreboardStyles'
import type { ScoreboardState, TeamPenalty } from '@/sports/scoreboardState'

defineOptions({ inheritAttrs: false })

const props = defineProps<{
  state: ScoreboardState
  displayTime?: string
  displayIntermissionTime?: string
  displayPenaltiesLocal?: TeamPenalty[]
  displayPenaltiesVisit?: TeamPenalty[]
  preview?: boolean
  tvStyle?: TvScoreboardStyle
}>()

const attrs = useAttrs()
const { tvStyle: prefStyle } = useScoreboardDisplayPrefs(() => 'hockey')
const style = computed(() => props.tvStyle ?? prefStyle.value)
</script>

<template>
  <HockeyArenaBoard
    v-if="isArenaTvStyle(style)"
    v-bind="attrs"
    :state="state"
    :preview="preview"
    :display-time="displayTime"
    :display-intermission-time="displayIntermissionTime"
    :display-penalties-local="displayPenaltiesLocal"
    :display-penalties-visit="displayPenaltiesVisit"
  />
  <HockeyScoreBoard
    v-else
    v-bind="attrs"
    tv
    :tv-light="isClassicLightTvStyle(style)"
    :state="state"
    :display-time="displayTime"
    :display-intermission-time="displayIntermissionTime"
    :display-penalties-local="displayPenaltiesLocal"
    :display-penalties-visit="displayPenaltiesVisit"
  />
</template>
