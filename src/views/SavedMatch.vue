<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { message, Modal } from 'ant-design-vue'
import { useAuthStore } from '@/stores/auth'
import { deleteSavedMatch, fetchSavedMatch } from '@/services/savedMatchesService'
import { createDefaultScoreboardState } from '@/sports/scoreboardState'
import { getSportUi } from '@/sports/ui'
import { formatSavedAt } from '@/utils/datetime'
import type { SavedMatchRecord } from '@/types/match'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const record = ref<SavedMatchRecord | null>(null)
const loading = ref(true)
const removing = ref(false)
const error = ref<string | null>(null)

const matchId = computed(() => route.params.id as string)
const displayState = computed(
  () => record.value?.state ?? createDefaultScoreboardState(),
)
const sportUi = computed(() => getSportUi(displayState.value.sport))
const eventTitle = computed(
  () => record.value?.title || `${displayState.value.localTeam} vs ${displayState.value.visitTeam}`,
)
const eventDate = computed(() => formatSavedAt(record.value?.saved_at))

async function load(): Promise<void> {
  const organizerId = auth.profile?.id
  if (!organizerId) {
    error.value = 'Inicia sesión para ver este partido.'
    loading.value = false
    return
  }
  loading.value = true
  error.value = null
  try {
    record.value = await fetchSavedMatch(organizerId, matchId.value)
    if (!record.value) error.value = 'No encontramos ese partido guardado.'
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'No se pudo abrir el partido.'
  } finally {
    loading.value = false
  }
}

async function removeCurrent(): Promise<void> {
  const organizerId = auth.profile?.id
  if (!organizerId || !record.value || removing.value) return
  removing.value = true
  try {
    await deleteSavedMatch(organizerId, record.value.id)
    message.success('Partido eliminado del registro.')
    await router.replace({ name: 'saved-matches' })
  } catch (err) {
    message.error(
      err instanceof Error ? err.message : 'No se pudo eliminar el partido.',
    )
    removing.value = false
  }
}

function confirmDelete(): void {
  if (!record.value || removing.value) return
  const label =
    record.value.title?.trim() ||
    `${record.value.local_team} vs ${record.value.visit_team}`
  Modal.confirm({
    title: '¿Eliminar este partido guardado?',
    content: `Se eliminará «${label}» del registro. Esta acción no se puede deshacer.`,
    okText: 'Eliminar',
    okType: 'danger',
    cancelText: 'Cancelar',
    centered: true,
    onOk: () => removeCurrent(),
  })
}

watch(matchId, () => {
  void load()
})

onMounted(() => {
  void load()
})
</script>

<template>
  <div class="saved-match">
    <div class="saved-match__bar">
      <RouterLink :to="{ name: 'saved-matches' }">← Partidos guardados</RouterLink>
      <a-button
        v-if="record"
        type="text"
        danger
        class="saved-match__remove"
        :loading="removing"
        :disabled="removing"
        aria-label="Eliminar partido guardado"
        title="Eliminar"
        @click="confirmDelete"
      >
        ×
      </a-button>
    </div>
    <a-spin :spinning="loading" size="large">
      <a-alert
        v-if="error"
        type="error"
        :message="error"
        show-icon
        style="margin: 1rem"
      />
      <component
        v-else-if="record"
        :is="sportUi.Live"
        :state="displayState"
        :display-time="displayState.timeGame"
        :display-intermission-time="displayState.intermissionTime"
        :event-title="eventTitle"
        :event-date="eventDate"
      />
    </a-spin>
  </div>
</template>

<style scoped>
.saved-match__bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  padding: 0.65rem 1rem 0;
}

.saved-match__bar a {
  color: var(--app-link);
  text-decoration: none;
  font-size: 0.88rem;
  font-weight: 600;
}

.saved-match__bar a:hover {
  text-decoration: underline;
}

.saved-match__remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  padding: 0;
  font-size: 1.7rem;
  line-height: 1;
  color: #cf1322;
}
</style>
