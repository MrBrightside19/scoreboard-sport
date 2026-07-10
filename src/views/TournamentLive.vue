<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import ScoreBoard from '@/components/ScoreBoard.vue'
import { useRemoteHockeyBoardCore } from '@/composables/useRemoteHockeyBoardCore'
import { fetchCourtStream } from '@/services/tournamentCourtStream'
import { getPollIntervalMs } from '@/config/poll'
import { createDefaultScoreboardState } from '@/types/hockeyScoreboard'

const route = useRoute()
const tournamentId = computed(() => route.params.tournamentId as string)
const court = computed(() => route.params.court as string)
const activeMatchId = ref<string | null>(null)

const { remoteState, displayTime, displayPenalty } = useRemoteHockeyBoardCore(
  () => activeMatchId.value,
)

const displayState = computed(
  () => remoteState.value ?? createDefaultScoreboardState(),
)

let streamTimer: number | null = null

async function refreshStream(): Promise<void> {
  const stream = await fetchCourtStream(tournamentId.value, court.value)
  activeMatchId.value = stream?.match_id ?? null
}

onMounted(() => {
  void refreshStream()
  streamTimer = window.setInterval(() => void refreshStream(), getPollIntervalMs())
})

onUnmounted(() => {
  if (streamTimer) clearInterval(streamTimer)
})
</script>

<template>
  <ScoreBoard
    overlay
    :state="displayState"
    :display-time="displayTime"
    :display-penalty="displayPenalty"
  />
</template>
