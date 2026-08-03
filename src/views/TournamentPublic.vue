<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import {
  fetchTournament,
  fetchTournamentMatches,
} from '@/services/tournamentService'
import { fetchMatchState } from '@/services/matchSync'
import { calculateStandings } from '@/utils/standings'
import { tournamentLivePath } from '@/utils/appUrl'
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
const router = useRouter()
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

const liveMatches = computed(() =>
  matches.value.filter((m) => m.status === 'live' && m.court),
)

/** Una entrada por cancha con partido en vivo (para el CTA del header). */
const liveCourts = computed(() => {
  const byCourt = new Map<string, TournamentMatch>()
  for (const match of liveMatches.value) {
    if (!byCourt.has(match.court)) byCourt.set(match.court, match)
  }
  return [...byCourt.entries()].map(([court, match]) => ({ court, match }))
})

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

function livePathForCourt(court: string): string {
  const id = tournament.value?.id ?? (route.params.id as string)
  return tournamentLivePath(id, court)
}

function openLiveBoard(tm: TournamentMatch): void {
  if (!tm.court) {
    message.warning('Este partido no tiene cancha asignada.')
    return
  }
  void router.push(livePathForCourt(tm.court))
}

function openPrimaryLiveBoard(): void {
  const first = liveCourts.value[0]
  if (!first) return
  void router.push(livePathForCourt(first.court))
}

async function openMatchReport(tm: TournamentMatch): Promise<void> {
  if (tm.status !== 'finished') return

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
        <div class="tournament-public__header-meta">
          <a-tag :color="tournament.status === 'active' ? 'green' : 'default'">
            {{ tournamentStatusLabels[tournament.status] }}
          </a-tag>

          <template v-if="liveCourts.length === 1">
            <a-button type="primary" @click="openPrimaryLiveBoard">
              Ver marcador en vivo
            </a-button>
          </template>
          <a-dropdown v-else-if="liveCourts.length > 1" placement="bottomLeft">
            <a-button type="primary">
              Ver marcador en vivo
            </a-button>
            <template #overlay>
              <a-menu>
                <a-menu-item
                  v-for="item in liveCourts"
                  :key="item.court"
                  @click="openLiveBoard(item.match)"
                >
                  Cancha {{ item.court }}
                  · {{ item.match.local_team }} vs {{ item.match.visit_team }}
                </a-menu-item>
              </a-menu>
            </template>
          </a-dropdown>
        </div>
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
                  v-if="record.status === 'live' && record.court"
                  size="small"
                  type="primary"
                  ghost
                  class="tournament-public__info-btn"
                  aria-label="Ver marcador en vivo"
                  title="Ver marcador en vivo"
                  @click="openLiveBoard(record)"
                >
                  <span class="tournament-public__btn-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor">
                      <path d="M8 5.14v13.72L19 12 8 5.14z" />
                    </svg>
                  </span>
                </a-button>
                <a-button
                  v-else-if="record.status === 'finished' && record.match_id"
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

.tournament-public__header-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
  margin-top: 0.35rem;
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
