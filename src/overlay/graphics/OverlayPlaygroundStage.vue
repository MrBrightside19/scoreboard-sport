<script setup lang="ts">
import { computed } from 'vue'
import OverlayLineupCard from '@/overlay/graphics/OverlayLineupCard.vue'
import OverlayBreakCard from '@/overlay/graphics/OverlayBreakCard.vue'
import { PLAYGROUND_BREAKS, PLAYGROUND_FINALS, PLAYGROUND_LINEUPS } from '@/overlay/graphics/mockData'
import { playgroundLiveState } from '@/overlay/graphics/liveState'
import type { PlaygroundPhase } from '@/overlay/graphics/session'
import { getSportUi } from '@/sports/ui'
import type { SportId } from '@/types/sport'

const props = defineProps<{
  sport: SportId
  phase: PlaygroundPhase
}>()

const overlay = computed(() => getSportUi(props.sport).Overlay)
const liveState = computed(() => playgroundLiveState(props.sport))
</script>

<template>
  <div class="stage" :data-phase="phase">
    <OverlayLineupCard
      v-if="phase === 'prematch'"
      :model="PLAYGROUND_LINEUPS[sport]"
    />
    <component
      v-else-if="phase === 'live'"
      :is="overlay"
      :state="liveState"
      :display-time="liveState.timeGame"
    />
    <OverlayBreakCard
      v-else-if="phase === 'break'"
      :model="PLAYGROUND_BREAKS[sport]"
    />
    <OverlayBreakCard
      v-else
      :model="PLAYGROUND_FINALS[sport]"
    />
  </div>
</template>

<style scoped>
.stage {
  width: 100%;
  height: 100%;
  position: relative;
}
</style>
