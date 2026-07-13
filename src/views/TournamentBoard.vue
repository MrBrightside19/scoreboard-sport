<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import ScoreBoard from '@/components/ScoreBoard.vue'
import { useScoreboardStore } from '@/stores/scoreboard'
import { useLocalScoreboardSync } from '@/composables/useLocalScoreboardSync'
import { fetchCourtStream } from '@/services/tournamentCourtStream'
import { getLiveClockUpdateMs } from '@/config/poll'
import {
  getStorageKey,
  onCourtMatchSync,
  readCourtActiveMatch,
  readMatchIdFromStorage,
} from '@/utils/localSync'

const route = useRoute()
const store = useScoreboardStore()

const tournamentId = computed(() => route.params.tournamentId as string)
const court = computed(() => route.params.court as string)

const activeMatchId = ref('')
const ready = ref(false)
/** True si el partido activo viene de controles (localStorage / query), no del stream remoto. */
const boundFromLocal = ref(false)

useLocalScoreboardSync(() => activeMatchId.value)

let unsubscribeCourt: (() => void) | null = null
let streamTimer: number | null = null
let localPollTimer: number | null = null

function preferredLocalMatchId(): string | null {
  return (
    readCourtActiveMatch(tournamentId.value, court.value) ||
    (typeof route.query.matchId === 'string' ? route.query.matchId : null) ||
    readMatchIdFromStorage()
  )
}

async function bindMatch(id: string, fromLocal: boolean): Promise<void> {
  if (!id) return

  if (id === activeMatchId.value) {
    boundFromLocal.value = boundFromLocal.value || fromLocal
    if (!ready.value) ready.value = true
    return
  }

  ready.value = false
  activeMatchId.value = id
  boundFromLocal.value = fromLocal

  if (localStorage.getItem(getStorageKey(id))) {
    store.loadFromLocal(id)
  } else {
    await store.hydrateMatch(id)
  }

  ready.value = true
}

async function resolveActiveMatch(): Promise<void> {
  const localId = preferredLocalMatchId()
  if (localId) {
    await bindMatch(localId, true)
    return
  }

  const stream = await fetchCourtStream(tournamentId.value, court.value)
  if (stream?.match_id) {
    await bindMatch(stream.match_id, false)
  }
}

/** Respaldo remoto: solo si no hay partido indicado por controles. */
async function refreshStreamMatch(): Promise<void> {
  const localId = preferredLocalMatchId()
  if (localId) {
    await bindMatch(localId, true)
    return
  }

  if (boundFromLocal.value) return

  const stream = await fetchCourtStream(tournamentId.value, court.value)
  if (stream?.match_id) {
    await bindMatch(stream.match_id, false)
  }
}

function syncFromLocalChannel(): void {
  const localId = preferredLocalMatchId()
  if (localId) void bindMatch(localId, true)
}

watch([tournamentId, court], () => {
  activeMatchId.value = ''
  ready.value = false
  boundFromLocal.value = false
  void resolveActiveMatch()
})

onMounted(() => {
  void resolveActiveMatch()

  unsubscribeCourt = onCourtMatchSync(
    () => tournamentId.value,
    () => court.value,
    (matchId) => {
      void bindMatch(matchId, true)
    },
  )

  // Por si el evento storage se pierde entre pestañas.
  localPollTimer = window.setInterval(syncFromLocalChannel, 1000)

  streamTimer = window.setInterval(
    () => void refreshStreamMatch(),
    getLiveClockUpdateMs(),
  )
})

onUnmounted(() => {
  unsubscribeCourt?.()
  if (streamTimer) clearInterval(streamTimer)
  if (localPollTimer) clearInterval(localPollTimer)
})
</script>

<template>
  <div class="board-root">
    <ScoreBoard v-if="activeMatchId && ready" tv :state="store.state" />
    <div v-else-if="activeMatchId" class="board-empty">Cargando marcador…</div>
    <div v-else class="board-empty">
      Esperando partido en cancha {{ court }}…
    </div>
  </div>
</template>

<style scoped>
.board-root {
  min-height: 100vh;
  background: #0a0e17;
}

.board-empty {
  min-height: 100vh;
  display: grid;
  place-items: center;
  color: rgba(255, 255, 255, 0.5);
  padding: 1.5rem;
  text-align: center;
}
</style>
