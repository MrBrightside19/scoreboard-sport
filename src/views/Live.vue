<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import ScoreBoard from '@/components/ScoreBoard.vue'
import { useRemoteHockeyBoardCore } from '@/composables/useRemoteHockeyBoardCore'
import { createDefaultScoreboardState } from '@/types/hockeyScoreboard'
import { loadLiveEventMeta } from '@/utils/liveEventMeta'

const route = useRoute()
const matchId = computed(() => route.params.matchId as string)

const { remoteState, loading, error, displayTime, displayPenaltiesLocal, displayPenaltiesVisit } =
  useRemoteHockeyBoardCore(() => matchId.value)

const displayState = computed(
  () => remoteState.value ?? createDefaultScoreboardState(),
)

const eventTitle = ref<string | null>(null)
const eventDate = ref<string | null>(null)

async function refreshEventMeta(): Promise<void> {
  const meta = await loadLiveEventMeta(matchId.value)
  eventTitle.value = meta.title
  eventDate.value = meta.date
}

watch(matchId, () => {
  void refreshEventMeta()
})

onMounted(() => {
  void refreshEventMeta()
})
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
      :event-title="eventTitle"
      :event-date="eventDate"
    />
  </a-spin>
</template>
