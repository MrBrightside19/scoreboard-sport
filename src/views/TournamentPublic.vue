<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { message } from 'ant-design-vue'
import {
  fetchTournament,
  fetchTournamentMatches,
} from '@/services/tournamentService'
import { fetchMatchState } from '@/services/matchSync'
import { calculateStandings } from '@/utils/standings'
import type { Tournament, TournamentMatch } from '@/types/tournament'
import MatchReportDrawer from '@/components/MatchReportDrawer.vue'
import TournamentStatsPanel from '@/components/TournamentStatsPanel.vue'
import {
  buildMatchReport,
  buildMatchReportFromFinishedScores,
  matchReportMetaFromTournamentMatch,
  type MatchReport,
} from '@/utils/matchReport'

const route = useRoute()
const tournament = ref<Tournament | null>(null)
const matches = ref<TournamentMatch[]>([])
const loading = ref(true)
const standings = ref(calculateStandings([]))
const reportOpen = ref(false)
const reportLoading = ref(false)
const activeReport = ref<MatchReport | null>(null)

const tournamentStatusLabels: Record<Tournament['status'], string> = {
  draft: 'Borrador',
  active: 'Activo',
  finished: 'Finalizado',
}

function matchStatusLabel(status: TournamentMatch['status']): string {
  const labels: Record<TournamentMatch['status'], string> = {
    scheduled: 'Programado',
    live: 'En vivo',
    finished: 'Finalizado',
  }
  return labels[status]
}

function matchStatusColor(status: TournamentMatch['status']): string {
  if (status === 'live') return 'green'
  if (status === 'finished') return 'default'
  return 'blue'
}

async function openMatchReport(tm: TournamentMatch): Promise<void> {
  reportOpen.value = true
  reportLoading.value = true
  activeReport.value = null
  try {
    const meta = matchReportMetaFromTournamentMatch(tm)
    if (!tm.match_id) {
      activeReport.value = buildMatchReportFromFinishedScores(
        meta,
        tm.goal_local ?? 0,
        tm.goal_visit ?? 0,
      )
      return
    }
    const record = await fetchMatchState(tm.match_id)
    if (!record?.state) {
      activeReport.value = buildMatchReportFromFinishedScores(
        meta,
        tm.goal_local ?? record?.goal_local ?? 0,
        tm.goal_visit ?? record?.goal_visit ?? 0,
      )
      return
    }
    activeReport.value = buildMatchReport(meta, {
      ...record.state,
      goalLocal: record.goal_local ?? record.state.goalLocal,
      goalVisit: record.goal_visit ?? record.state.goalVisit,
    })
  } catch (err) {
    message.error(err instanceof Error ? err.message : 'No se pudo cargar el informe')
    reportOpen.value = false
  } finally {
    reportLoading.value = false
  }
}

onMounted(async () => {
  const id = route.params.id as string
  try {
    tournament.value = await fetchTournament(id)
    matches.value = await fetchTournamentMatches(id)
    standings.value = calculateStandings(
      matches.value
        .filter((m) => m.status === 'finished')
        .map((m) => ({
          local: m.local_team,
          visit: m.visit_team,
          goalLocal: m.goal_local ?? 0,
          goalVisit: m.goal_visit ?? 0,
        })),
    )
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="tournament-public">
    <a-spin :spinning="loading">
      <header v-if="tournament" class="tournament-public__header">
        <router-link to="/torneos-publicos">← Torneos públicos</router-link>
        <h1>{{ tournament.name }}</h1>
        <p v-if="tournament.description">{{ tournament.description }}</p>
        <a-tag :color="tournament.status === 'active' ? 'green' : 'default'">
          {{ tournamentStatusLabels[tournament.status] }}
        </a-tag>
      </header>

      <section class="tournament-public__section">
        <TournamentStatsPanel :standings="standings" :matches="matches" />
      </section>

      <section class="tournament-public__section">
        <h2>Calendario</h2>
        <div class="tournament-public__table-wrap">
          <a-table
            :data-source="matches.map((m) => ({ ...m, key: m.id }))"
            :pagination="false"
            size="small"
            :scroll="{ x: 800 }"
            table-layout="fixed"
          >
            <a-table-column title="Local" data-index="local_team" :ellipsis="true" :width="140" />
            <a-table-column title="Visita" data-index="visit_team" :ellipsis="true" :width="140" />
            <a-table-column title="Categoría" :width="100" :ellipsis="true">
              <template #default="{ record }">
                {{ record.category || '—' }}
              </template>
            </a-table-column>
            <a-table-column title="Cancha" data-index="court" :width="80" :ellipsis="true" />
            <a-table-column title="Estado" :width="110">
              <template #default="{ record }">
                <a-tag :color="matchStatusColor(record.status)">
                  {{ matchStatusLabel(record.status) }}
                </a-tag>
              </template>
            </a-table-column>
            <a-table-column title="Resultado" :width="100">
              <template #default="{ record }">
                <span v-if="record.status === 'finished'">
                  {{ record.goal_local }} - {{ record.goal_visit }}
                </span>
                <span v-else>—</span>
              </template>
            </a-table-column>
            <a-table-column title="" :width="56" fixed="right">
              <template #default="{ record }">
                <a-button
                  v-if="
                    record.match_id
                      && (record.status === 'finished' || record.status === 'live')
                  "
                  size="small"
                  class="tournament-public__info-btn"
                  aria-label="Ver informe"
                  title="Ver informe"
                  @click="openMatchReport(record)"
                >
                  <span class="tournament-public__btn-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <circle cx="12" cy="12" r="9" />
                      <path d="M12 11v6" />
                      <path d="M12 8h.01" />
                    </svg>
                  </span>
                </a-button>
              </template>
            </a-table-column>
          </a-table>
        </div>
      </section>
    </a-spin>

    <MatchReportDrawer
      v-model:open="reportOpen"
      :report="activeReport"
      :loading="reportLoading"
      :can-download="false"
    />
  </div>
</template>

<style scoped lang="scss">
.tournament-public {
  max-width: min(900px, 100%);
  width: 100%;
  margin: 0 auto;
  padding: 2rem 1.5rem;
  box-sizing: border-box;
  overflow-x: clip;
}

.tournament-public__table-wrap {
  width: 100%;
  max-width: 100%;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

.tournament-public__table-wrap :deep(.ant-table-cell) {
  white-space: nowrap;
}

.tournament-public__header h1 {
  margin: 0.5rem 0;
  font-family: 'Bebas Neue', sans-serif;
  font-size: 2.5rem;
  letter-spacing: 0.04em;
}

.tournament-public__section {
  margin-top: 2rem;

  h2 {
    margin: 0 0 1rem;
    font-size: 1.1rem;
  }
}

.tournament-public__btn-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  line-height: 0;
}

.tournament-public__info-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 28px;
  padding-inline: 0.4rem;
}
</style>
