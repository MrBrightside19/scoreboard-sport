<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import ScoreBoard from '@/components/ScoreBoard.vue'
import { useRemoteHockeyBoardCore } from '@/composables/useRemoteHockeyBoardCore'
import { fetchCourtStream } from '@/services/tournamentCourtStream'
import { getLiveClockUpdateMs } from '@/config/poll'
import { createDefaultScoreboardState } from '@/types/hockeyScoreboard'
import { loadLiveEventMeta } from '@/utils/liveEventMeta'

const route = useRoute()
const tournamentId = computed(() => route.params.tournamentId as string)
const court = computed(() => route.params.court as string)
const isOverlay = computed(() => route.name === 'tournament-overlay')
const activeMatchId = ref<string | null>(null)

const { remoteState, displayTime, displayIntermissionTime, displayPenaltiesLocal, displayPenaltiesVisit, refresh } =
  useRemoteHockeyBoardCore(() => activeMatchId.value)

const displayState = computed(
  () => remoteState.value ?? createDefaultScoreboardState(),
)

const eventTitle = ref<string | null>(null)
const eventDate = ref<string | null>(null)

let streamTimer: number | null = null

async function refreshEventMeta(): Promise<void> {
  const meta = await loadLiveEventMeta(activeMatchId.value, tournamentId.value)
  eventTitle.value = meta.title
  eventDate.value = meta.date
}

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
  void refreshEventMeta()
})

onMounted(() => {
  void refreshStream()
  void refreshEventMeta()
  streamTimer = window.setInterval(() => void refreshStream(), getLiveClockUpdateMs())
})

onUnmounted(() => {
  if (streamTimer) clearInterval(streamTimer)
})
</script>

<template>
  <div :class="{ 'overlay-root': isOverlay }">
    <ScoreBoard
      v-if="activeMatchId"
      :overlay="isOverlay"
      :state="displayState"
      :display-time="displayTime"
      :display-intermission-time="displayIntermissionTime"
      :display-penalties-local="displayPenaltiesLocal"
      :display-penalties-visit="displayPenaltiesVisit"
      :event-title="isOverlay ? null : eventTitle"
      :event-date="isOverlay ? null : eventDate"
    />
  </div>
</template>

<style scoped>
.overlay-root {
  min-height: 100vh;
  background: transparent;
}
</style>
