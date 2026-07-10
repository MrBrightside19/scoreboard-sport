<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import {
  fetchTournament,
  fetchTournamentMatches,
  importTournamentCsv,
  startTournamentMatch,
  updateTournamentStatus,
} from '@/services/tournamentService'
import { parseCsv, buildCsvTemplate } from '@/utils/csv'
import { calculateStandings } from '@/utils/standings'
import { writeMatchIdToStorage } from '@/utils/localSync'
import type { Tournament, TournamentMatch } from '@/types/tournament'
import TournamentStandings from '@/components/TournamentStandings.vue'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const tournament = ref<Tournament | null>(null)
const matches = ref<TournamentMatch[]>([])
const loading = ref(true)
const importing = ref(false)

const standings = computed(() =>
  calculateStandings(
    matches.value
      .filter((m) => m.status === 'finished')
      .map((m) => ({
        local: m.local_team,
        visit: m.visit_team,
        goalLocal: m.goal_local ?? 0,
        goalVisit: m.goal_visit ?? 0,
      })),
  ),
)

async function load(): Promise<void> {
  const id = route.params.id as string
  loading.value = true
  try {
    tournament.value = await fetchTournament(id)
    matches.value = await fetchTournamentMatches(id)
  } finally {
    loading.value = false
  }
}

function openControls(tm: TournamentMatch): void {
  if (!tm.match_id) return
  writeMatchIdToStorage(tm.match_id)
  window.open(
    router.resolve({
      name: 'controls',
      query: {
        matchId: tm.match_id,
        local: tm.local_team,
        visit: tm.visit_team,
        time: tm.game_time,
        tournamentId: tm.tournament_id,
      },
    }).href,
    '_blank',
    'noopener',
  )
}

function downloadTemplate(): void {
  const blob = new Blob([buildCsvTemplate()], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'calendario-plantilla.csv'
  a.click()
  URL.revokeObjectURL(url)
}

async function onCsvUpload(file: File): Promise<void> {
  if (!tournament.value) return
  importing.value = true
  try {
    const text = await file.text()
    const rows = parseCsv(text)
    await importTournamentCsv(tournament.value.id, rows)
    await load()
  } catch (err) {
    alert(err instanceof Error ? err.message : 'Error al importar CSV')
  } finally {
    importing.value = false
  }
}

async function startMatch(tm: TournamentMatch): Promise<void> {
  if (!auth.profile) return
  const matchId = await startTournamentMatch(tm, auth.profile.id)
  openControls({ ...tm, match_id: matchId })
  await load()
}

async function finishTournament(): Promise<void> {
  if (!tournament.value) return
  await updateTournamentStatus(tournament.value.id, 'finished')
  await load()
}

onMounted(() => void load())
</script>

<template>
  <div class="detail">
    <a-spin :spinning="loading">
      <header v-if="tournament" class="detail__header">
        <div>
          <router-link to="/tournaments">← Torneos</router-link>
          <h1>{{ tournament.name }}</h1>
        </div>
        <div class="detail__actions">
          <a-button @click="downloadTemplate">Descargar plantilla CSV</a-button>
          <a-upload
            :show-upload-list="false"
            accept=".csv"
            :before-upload="(f: File) => { onCsvUpload(f); return false }"
          >
            <a-button :loading="importing">Importar calendario</a-button>
          </a-upload>
          <a-button
            v-if="tournament.status !== 'finished'"
            danger
            @click="finishTournament"
          >
            Finalizar torneo
          </a-button>
        </div>
      </header>

      <section class="detail__section">
        <h2>Tabla de posiciones</h2>
        <TournamentStandings :standings="standings" />
      </section>

      <section class="detail__section">
        <h2>Calendario</h2>
        <a-table
          :data-source="matches.map((m) => ({ ...m, key: m.id }))"
          :pagination="false"
          size="small"
        >
          <a-table-column title="Local" data-index="local_team" />
          <a-table-column title="Visita" data-index="visit_team" />
          <a-table-column title="Cancha" data-index="court" width="80" />
          <a-table-column title="Tiempo" data-index="game_time" width="80" />
          <a-table-column title="Estado" data-index="status" width="100" />
          <a-table-column title="Acciones" width="140">
            <template #default="{ record }">
              <div class="detail__match-actions">
                <a-button
                  v-if="record.status === 'scheduled'"
                  type="primary"
                  size="small"
                  @click="startMatch(record)"
                >
                  Iniciar
                </a-button>
                <a-button
                  v-if="record.status === 'live' && record.match_id"
                  type="primary"
                  size="small"
                  @click="openControls(record)"
                >
                  Controles
                </a-button>
              </div>
            </template>
          </a-table-column>
        </a-table>
      </section>
    </a-spin>
  </div>
</template>

<style scoped lang="scss">
.detail {
  max-width: 1000px;
  margin: 0 auto;
  padding: 1.5rem;
}

.detail__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  margin-bottom: 2rem;
  flex-wrap: wrap;

  h1 {
    margin: 0.5rem 0 0;
    font-family: 'Bebas Neue', sans-serif;
    font-size: 2.2rem;
  }
}

.detail__actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.detail__section {
  margin-bottom: 2rem;

  h2 {
    margin: 0 0 1rem;
    font-size: 1.1rem;
  }
}

.detail__match-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  align-items: center;
}
</style>
