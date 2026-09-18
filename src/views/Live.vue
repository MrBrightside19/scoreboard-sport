<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useRemoteScoreboard } from '@/composables/useRemoteScoreboard'
import { createDefaultScoreboardState } from '@/sports/scoreboardState'
import { loadLiveEventMeta } from '@/utils/liveEventMeta'
import { getSportUi } from '@/sports/ui'
import ScoreboardBrandMark from '@/components/ScoreboardBrandMark.vue'

const route = useRoute()
const matchId = computed(() => route.params.matchId as string)

const {
  remoteState,
  loading,
  error,
  displayTime,
  displayIntermissionTime,
  displayPenaltiesLocal,
  displayPenaltiesVisit,
} = useRemoteScoreboard(() => matchId.value)

const displayState = computed(
  () => remoteState.value ?? createDefaultScoreboardState(),
)
const sportUi = computed(() => getSportUi(displayState.value.sport))

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
    <component
      :is="sportUi.Live"
      :state="displayState"
      :display-time="displayTime"
      :display-intermission-time="displayIntermissionTime"
      :display-penalties-local="displayPenaltiesLocal"
      :display-penalties-visit="displayPenaltiesVisit"
      :event-title="eventTitle"
      :event-date="eventDate"
    />
    <ScoreboardBrandMark v-if="displayState.showBranding" />
  </a-spin>
</template>
