<script setup lang="ts">
import { computed } from 'vue'
import type { MatchReport } from '@/utils/matchReport'

const open = defineModel<boolean>('open', { default: false })

const props = defineProps<{
  report: MatchReport | null
  loading?: boolean
  canDownload?: boolean
  downloading?: boolean
}>()

const emit = defineEmits<{
  download: []
}>()

function statusLabel(status: string): string {
  if (status === 'live') return 'En vivo'
  if (status === 'finished') return 'Finalizado'
  if (status === 'scheduled') return 'Programado'
  return status
}

const awardCards = computed(() => {
  const awards = props.report?.awards
  if (!awards) return []
  return [
    { key: 'scorer', title: 'Goleador', unit: 'goles', winner: awards.topScorer },
    { key: 'assists', title: 'Mejor jugador', unit: 'asistencias', winner: awards.topAssists },
    { key: 'keeper', title: 'Mejor portero', unit: 'atajadas', winner: awards.topGoalkeeper },
  ]
})

const teamCards = computed(() => {
  const report = props.report
  if (!report) return []
  return [
    {
      key: 'local' as const,
      name: report.meta.localTeam,
      goals: report.goalLocal,
      shotsMiss: report.shotsMissLocal,
      saves: report.savesLocal,
      goalRows: report.goals.filter((g) => g.team === 'local'),
      shotRows: report.shots.filter((s) => s.team === 'local'),
      penaltyRows: report.penalties.filter((p) => p.team === 'local'),
      players: report.playerStats.filter((p) => p.team === report.meta.localTeam),
    },
    {
      key: 'visit' as const,
      name: report.meta.visitTeam,
      goals: report.goalVisit,
      shotsMiss: report.shotsMissVisit,
      saves: report.savesVisit,
      goalRows: report.goals.filter((g) => g.team === 'visit'),
      shotRows: report.shots.filter((s) => s.team === 'visit'),
      penaltyRows: report.penalties.filter((p) => p.team === 'visit'),
      players: report.playerStats.filter((p) => p.team === report.meta.visitTeam),
    },
  ]
})
</script>

<template>
  <a-drawer
    v-model:open="open"
    title="Informe del partido"
    placement="right"
    :width="560"
    :destroy-on-close="true"
  >
    <a-spin :spinning="loading">
      <template v-if="report">
        <header class="report__header">
          <h3 class="report__title">
            {{ report.meta.localTeam }}
            <span class="report__vs">vs</span>
            {{ report.meta.visitTeam }}
          </h3>
          <p class="report__meta">
            <span v-if="report.meta.category">{{ report.meta.category }} · </span>
            Cancha {{ report.meta.court || '—' }}
            · {{ statusLabel(String(report.meta.status)) }}
          </p>
          <p class="report__score">
            {{ report.goalLocal }} — {{ report.goalVisit }}
          </p>
        </header>

        <section class="report__awards" aria-label="Destacados del partido">
          <article
            v-for="award in awardCards"
            :key="award.key"
            class="report__award"
          >
            <span class="report__award-title">{{ award.title }}</span>
            <template v-if="award.winner">
              <strong class="report__award-name">{{ award.winner.label }}</strong>
              <span class="report__award-meta">
                {{ award.winner.value }} {{ award.unit }} · {{ award.winner.team }}
              </span>
            </template>
            <span v-else class="report__award-empty">Sin datos</span>
          </article>
        </section>

        <div class="report__teams">
          <article
            v-for="team in teamCards"
            :key="team.key"
            class="report__team-card"
            :class="`report__team-card--${team.key}`"
          >
            <header class="report__team-head">
              <h4>{{ team.name }}</h4>
              <span class="report__team-score">{{ team.goals }}</span>
            </header>

            <ul class="report__stats">
              <li><span>Goles</span><strong>{{ team.goals }}</strong></li>
              <li><span>Tiros</span><strong>{{ team.shotsMiss }}</strong></li>
              <li><span>Atajadas</span><strong>{{ team.saves }}</strong></li>
            </ul>

            <section class="report__block">
              <h5>Goles</h5>
              <ul v-if="team.goalRows.length" class="report__list">
                <li v-for="(goal, i) in team.goalRows" :key="`g-${team.key}-${i}`">
                  <span class="report__badge">P{{ goal.period }} {{ goal.gameMinute }}</span>
                  {{ goal.scorer }}
                  <template v-if="goal.assist !== '—'"> (A: {{ goal.assist }})</template>
                </li>
              </ul>
              <p v-else class="report__empty">Sin goles</p>
            </section>

            <section class="report__block">
              <h5>Tiros y atajadas</h5>
              <ul v-if="team.shotRows.length" class="report__list">
                <li v-for="(shot, i) in team.shotRows" :key="`s-${team.key}-${i}`">
                  <span class="report__badge">P{{ shot.period }} {{ shot.gameMinute }}</span>
                  {{ shot.resultLabel }}
                </li>
              </ul>
              <p v-else class="report__empty">Sin registros</p>
            </section>

            <section class="report__block">
              <h5>Jugadores</h5>
              <ul v-if="team.players.length" class="report__players">
                <li v-for="player in team.players" :key="player.key">
                  <span class="report__player-name">{{ player.label }}</span>
                  <span class="report__player-stats">
                    {{ player.goals }}G · {{ player.assists }}A · {{ player.saves }}At
                  </span>
                </li>
              </ul>
              <p v-else class="report__empty">Sin estadísticas individuales</p>
            </section>

            <section class="report__block">
              <h5>Penalidades</h5>
              <ul v-if="team.penaltyRows.length" class="report__list">
                <li v-for="(penalty, i) in team.penaltyRows" :key="`p-${team.key}-${i}`">
                  <span class="report__badge">{{ penalty.time }}</span>
                  {{ penalty.player }} · {{ penalty.type }}
                  <template v-if="penalty.infraction !== '—'">
                    · {{ penalty.infraction }}
                  </template>
                </li>
              </ul>
              <p v-else class="report__empty">Sin penalidades</p>
            </section>
          </article>
        </div>

        <div v-if="canDownload" class="report__actions">
          <a-button
            type="primary"
            block
            :loading="downloading"
            @click="emit('download')"
          >
            Descargar Excel
          </a-button>
        </div>
      </template>
      <a-empty v-else-if="!loading" description="No hay datos del partido" />
    </a-spin>
  </a-drawer>
</template>

<style scoped lang="scss">
.report__header {
  margin-bottom: 1.1rem;
}

.report__title {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 650;
  line-height: 1.35;
}

.report__vs {
  opacity: 0.45;
  font-weight: 500;
  text-transform: uppercase;
  font-size: 0.75rem;
  letter-spacing: 0.06em;
}

.report__meta {
  margin: 0.35rem 0 0;
  font-size: 0.82rem;
  opacity: 0.65;
}

.report__score {
  margin: 0.65rem 0 0;
  font-family: 'Bebas Neue', sans-serif;
  font-size: 2rem;
  letter-spacing: 0.04em;
  line-height: 1;
}

.report__awards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.5rem;
  margin-bottom: 1rem;

  @media (max-width: 520px) {
    grid-template-columns: 1fr;
  }
}

.report__award {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  min-width: 0;
  padding: 0.6rem 0.65rem;
  border-radius: 8px;
  background: var(--app-surface-strong);
  border: 1px solid var(--app-border);
}

.report__award-title {
  font-size: 0.62rem;
  font-weight: 650;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  opacity: 0.55;
}

.report__award-name {
  font-size: 0.85rem;
  font-weight: 650;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.report__award-meta {
  font-size: 0.72rem;
  opacity: 0.6;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.report__award-empty {
  font-size: 0.8rem;
  opacity: 0.4;
}

.report__players {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  font-size: 0.8rem;

  li {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.4rem;
  }
}

.report__player-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.report__player-stats {
  flex-shrink: 0;
  font-size: 0.72rem;
  opacity: 0.6;
  font-variant-numeric: tabular-nums;
}

.report__teams {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
  align-items: start;

  @media (max-width: 520px) {
    grid-template-columns: 1fr;
  }
}

.report__team-card {
  padding: 0.85rem 0.9rem;
  border-radius: 10px;
  background: var(--app-surface);
  border: 1px solid var(--app-border);
  min-width: 0;

  &--local {
    border-top: 2px solid rgba(0, 212, 255, 0.55);
  }

  &--visit {
    border-top: 2px solid rgba(255, 107, 53, 0.55);
  }
}

.report__team-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.65rem;

  h4 {
    margin: 0;
    font-size: 0.92rem;
    font-weight: 650;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.report__team-score {
  font-family: 'Bebas Neue', sans-serif;
  font-size: 1.55rem;
  line-height: 1;
  letter-spacing: 0.03em;
  flex-shrink: 0;
}

.report__stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.35rem;
  margin: 0 0 0.85rem;
  padding: 0;
  list-style: none;

  li {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    padding: 0.4rem 0.35rem;
    border-radius: 6px;
    background: var(--app-surface-inset);
    text-align: center;

    span {
      font-size: 0.62rem;
      font-weight: 650;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      opacity: 0.55;
    }

    strong {
      font-size: 0.95rem;
      font-variant-numeric: tabular-nums;
    }
  }
}

.report__block {
  & + & {
    margin-top: 0.75rem;
    padding-top: 0.7rem;
    border-top: 1px solid var(--app-border);
  }

  h5 {
    margin: 0 0 0.4rem;
    font-size: 0.7rem;
    font-weight: 650;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    opacity: 0.6;
  }
}

.report__list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-size: 0.8rem;
  line-height: 1.35;
}

.report__badge {
  display: inline-block;
  margin-right: 0.3rem;
  font-size: 0.68rem;
  font-weight: 600;
  letter-spacing: 0.03em;
  opacity: 0.55;
  font-variant-numeric: tabular-nums;
}

.report__empty {
  margin: 0;
  font-size: 0.8rem;
  opacity: 0.45;
}

.report__actions {
  position: sticky;
  bottom: 0;
  padding-top: 0.85rem;
  margin-top: 1rem;
  background: linear-gradient(
    to top,
    color-mix(in srgb, var(--app-bg-elevated) 97%, transparent) 55%,
    transparent
  );

  :deep(.ant-btn-primary) {
    color: #fff;
    background: var(--app-primary);
    border-color: var(--app-primary);

    &:not(:disabled):hover {
      color: #fff;
      background: var(--app-link);
      border-color: var(--app-link);
    }
  }
}
</style>
