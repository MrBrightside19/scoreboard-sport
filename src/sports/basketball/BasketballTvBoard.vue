<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import HockeyScoreBoard from '@/sports/hockey/HockeyScoreBoard.vue'
import { useScoreboardDisplayPrefs } from '@/composables/useScoreboardDisplayPrefs'
import {
  isClassicLightTvStyle,
  type TvScoreboardStyle,
} from '@/config/scoreboardStyles'
import type { ScoreboardState } from '@/sports/scoreboardState'

defineOptions({ inheritAttrs: false })

const props = defineProps<{
  state: ScoreboardState
  displayTime?: string
  displayIntermissionTime?: string
  preview?: boolean
  tvStyle?: TvScoreboardStyle
  eventTitle?: string | null
  eventDate?: string | null
}>()

const attrs = useAttrs()
const { tvStyle: prefStyle } = useScoreboardDisplayPrefs(() => 'basketball')
const style = computed(() => props.tvStyle ?? prefStyle.value)
</script>

<template>
  <HockeyScoreBoard
    v-bind="attrs"
    tv
    :tv-light="isClassicLightTvStyle(style)"
    :tv-show-penalties="false"
    :state="state"
    :display-time="displayTime"
    :display-intermission-time="displayIntermissionTime"
    :event-title="eventTitle"
    :event-date="eventDate"
  />
</template>
