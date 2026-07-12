<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import {
  fetchTournament,
  fetchTournamentMatches,
} from '@/services/tournamentService'
import { calculateStandings } from '@/utils/standings'
import type { Tournament, TournamentMatch } from '@/types/tournament'
import TournamentStandings from '@/components/TournamentStandings.vue'

const route = useRoute()
const tournament = ref<Tournament | null>(null)
const matches = ref<TournamentMatch[]>([])
const loading = ref(true)
const standings = ref(calculateStandings([]))

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
          {{ tournament.status }}
        </a-tag>
      </header>

      <section class="tournament-public__section">
        <h2>Tabla de posiciones</h2>
        <TournamentStandings :standings="standings" />
      </section>

      <section class="tournament-public__section">
        <h2>Calendario</h2>
        <a-table
          :data-source="matches.map((m) => ({ ...m, key: m.id }))"
          :pagination="false"
          size="small"
        >
          <a-table-column title="Local" data-index="local_team" />
          <a-table-column title="Visita" data-index="visit_team" />
          <a-table-column title="Categoría" width="100">
            <template #default="{ record }">
              {{ record.category || '—' }}
            </template>
          </a-table-column>
          <a-table-column title="Cancha" data-index="court" width="80" />
          <a-table-column title="Estado" data-index="status" width="100" />
          <a-table-column title="Resultado" width="100">
            <template #default="{ record }">
              <span v-if="record.status === 'finished'">
                {{ record.goal_local }} - {{ record.goal_visit }}
              </span>
              <span v-else>—</span>
            </template>
          </a-table-column>
        </a-table>
      </section>
    </a-spin>
  </div>
</template>

<style scoped lang="scss">
.tournament-public {
  max-width: 900px;
  margin: 0 auto;
  padding: 2rem 1.5rem;
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
</style>
