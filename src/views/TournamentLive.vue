<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
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

const { remoteState, displayTime, displayPenaltiesLocal, displayPenaltiesVisit, refresh } =
  useRemoteHockeyBoardCore(() => activeMatchId.value)

const displayState = computed(
  () => remoteState.value ?? createDefaultScoreboardState(),
)

let streamTimer: number | null = null

async function refreshStream(): Promise<void> {
  const stream = await fetchCourtStream(tournamentId.value, court.value)
  const nextMatchId = stream?.match_id ?? null
  if (nextMatchId !== activeMatchId.value) {
    activeMatchId.value = nextMatchId
    if (nextMatchId) await refresh()
  }
}

watch(activeMatchId, (id) => {
  if (id) void refresh()
})

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
    :display-penalties-local="displayPenaltiesLocal"
    :display-penalties-visit="displayPenaltiesVisit"
  />
</template>
