<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { StandingRow, TournamentMatch } from '@/types/tournament'
import TournamentStandings from '@/components/TournamentStandings.vue'
import { fetchMatchState } from '@/services/matchSync'
import {
  buildMatchReport,
  buildMatchReportFromFinishedScores,
  matchReportMetaFromTournamentMatch,
} from '@/utils/matchReport'
import {
  awardsByCategory,
  type CategoryAwards,
  type PlayerStatLine,
} from '@/utils/playerStats'

const props = defineProps<{
  standings: StandingRow[]
  matches: TournamentMatch[]
}>()

const loadingStats = ref(false)
const categoryAwards = ref<CategoryAwards[]>([])
const finishedWithData = computed(
  () => props.matches.filter((m) => m.status === 'finished' && m.match_id).length,
)

const rankingBlocks = [
  { key: 'scorers' as const, title: 'Goleadores', unit: 'goles', field: 'topScorers' as const, metric: 'goals' as const },
  { key: 'assists' as const, title: 'Asistencias', unit: 'asistencias', field: 'topAssists' as const, metric: 'assists' as const },
  { key: 'keepers' as const, title: 'Porteros', unit: 'atajadas', field: 'topGoalkeepers' as const, metric: 'saves' as const },
]

async function loadPlayerRankings(): Promise<void> {
  const targets = props.matches.filter(
    (m) => (m.status === 'finished' || m.status === 'live') && m.match_id,
  )

  if (targets.length === 0) {
    categoryAwards.value = []
    return
  }

  loadingStats.value = true
  try {
    const entries: Array<{ category: string; lines: PlayerStatLine[] }> = []
    for (const tm of targets) {
      const meta = matchReportMetaFromTournamentMatch(tm)
      let report
      try {
        const record = await fetchMatchState(tm.match_id!)
        report = record?.state
          ? buildMatchReport(meta, {
              ...record.state,
              goalLocal: record.goal_local ?? record.state.goalLocal,
              goalVisit: record.goal_visit ?? record.state.goalVisit,
            })
          : buildMatchReportFromFinishedScores(
              meta,
              tm.goal_local ?? record?.goal_local ?? 0,
              tm.goal_visit ?? record?.goal_visit ?? 0,
            )
      } catch {
        report = buildMatchReportFromFinishedScores(
          meta,
          tm.goal_local ?? 0,
          tm.goal_visit ?? 0,
        )
      }
      entries.push({
        category: report.meta.category,
        lines: report.playerStats,
      })
    }
    categoryAwards.value = awardsByCategory(entries, 3)
  } finally {
    loadingStats.value = false
  }
}

watch(
  () =>
    props.matches
      .filter((m) => (m.status === 'finished' || m.status === 'live') && m.match_id)
      .map((m) => `${m.id}:${m.status}:${m.goal_local}-${m.goal_visit}`)
      .join('|'),
  () => {
    void loadPlayerRankings()
  },
  { immediate: true },
)

function rankValue(player: PlayerStatLine, metric: 'goals' | 'assists' | 'saves'): number {
  return player[metric]
}
</script>

<template>
  <div class="stats-panel">
    <section class="stats-panel__section">
      <header class="stats-panel__head">
        <h2>Tabla de posiciones</h2>
        <p>Clasificación de equipos según partidos finalizados.</p>
      </header>
      <TournamentStandings :standings="standings" />
    </section>

    <section class="stats-panel__section">
      <header class="stats-panel__head">
        <h2>Rankings individuales</h2>
        <p>
          Avance del torneo: top 3 por categoría.
          {{
            finishedWithData > 0
              ? `Basado en ${finishedWithData} partido${finishedWithData === 1 ? '' : 's'} finalizado${finishedWithData === 1 ? '' : 's'}.`
              : 'Aparece cuando haya partidos finalizados con estadísticas.'
          }}
        </p>
      </header>

      <a-spin :spinning="loadingStats">
        <div v-if="categoryAwards.length" class="stats-panel__categories">
          <article
            v-for="entry in categoryAwards"
            :key="entry.category"
            class="stats-panel__category"
          >
            <h3>{{ entry.category }}</h3>
            <div class="stats-panel__rankings">
              <div
                v-for="block in rankingBlocks"
                :key="block.key"
                class="stats-panel__rank-card"
              >
                <h4>{{ block.title }}</h4>
                <ol v-if="entry[block.field].length">
                  <li
                    v-for="(player, index) in entry[block.field]"
                    :key="player.key"
                  >
                    <span class="stats-panel__rank">{{ index + 1 }}</span>
                    <div class="stats-panel__player">
                      <strong>{{ player.label }}</strong>
                      <span>{{ player.team }}</span>
                    </div>
                    <span class="stats-panel__value">
                      {{ rankValue(player, block.metric) }}
                      <small>{{ block.unit }}</small>
                    </span>
                  </li>
                </ol>
                <p v-else class="stats-panel__empty">Sin datos aún</p>
              </div>
            </div>
          </article>
        </div>
        <a-empty
          v-else-if="!loadingStats"
          description="Aún no hay rankings individuales. Completa goles y atajadas en los partidos."
        />
      </a-spin>
    </section>
  </div>
</template>

<style scoped lang="scss">
.stats-panel {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.stats-panel__head {
  margin-bottom: 0.85rem;

  h2 {
    margin: 0;
    font-size: 1.1rem;
  }

  p {
    margin: 0.35rem 0 0;
    font-size: 0.85rem;
    opacity: 0.55;
  }
}

.stats-panel__categories {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.stats-panel__category {
  h3 {
    margin: 0 0 0.65rem;
    font-size: 0.78rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    opacity: 0.65;
  }
}

.stats-panel__rankings {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.75rem;

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
  }
}

.stats-panel__rank-card {
  padding: 0.85rem 0.9rem;
  border-radius: 10px;
  background: var(--app-surface);
  border: 1px solid var(--app-border);
  min-width: 0;

  h4 {
    margin: 0 0 0.65rem;
    font-size: 0.82rem;
    font-weight: 650;
  }

  ol {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 0.45rem;
  }

  li {
    display: grid;
    grid-template-columns: 1.4rem minmax(0, 1fr) auto;
    gap: 0.45rem;
    align-items: center;
  }
}

.stats-panel__rank {
  font-family: 'Bebas Neue', sans-serif;
  font-size: 1.1rem;
  opacity: 0.55;
  text-align: center;
}

.stats-panel__player {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.05rem;

  strong {
    font-size: 0.86rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  span {
    font-size: 0.72rem;
    opacity: 0.5;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.stats-panel__value {
  font-variant-numeric: tabular-nums;
  font-weight: 650;
  font-size: 0.9rem;
  text-align: right;

  small {
    display: block;
    font-size: 0.62rem;
    font-weight: 500;
    opacity: 0.5;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
}

.stats-panel__empty {
  margin: 0;
  font-size: 0.82rem;
  opacity: 0.45;
}
</style>
