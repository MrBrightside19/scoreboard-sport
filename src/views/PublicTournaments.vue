<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { fetchPublicTournaments } from '@/services/tournamentService'
import type { Tournament } from '@/types/tournament'

const tournaments = ref<Tournament[]>([])
const loading = ref(true)

const statusLabels: Record<Tournament['status'], string> = {
  draft: 'Borrador',
  active: 'Activo',
  finished: 'Finalizado',
}

function statusColor(status: Tournament['status']): string {
  if (status === 'active') return 'green'
  if (status === 'finished') return 'default'
  return 'blue'
}

onMounted(async () => {
  try {
    tournaments.value = await fetchPublicTournaments()
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="page">
    <h1>Torneos públicos</h1>
    <a-spin :spinning="loading">
      <div v-if="tournaments.length" class="page__list">
        <router-link
          v-for="t in tournaments"
          :key="t.id"
          :to="`/torneo/${t.id}`"
          class="page__card"
        >
          <h3>{{ t.name }}</h3>
          <p v-if="t.start_date">{{ t.start_date }} — {{ t.end_date }}</p>
          <a-tag :color="statusColor(t.status)">
            {{ statusLabels[t.status] }}
          </a-tag>
        </router-link>
      </div>
      <a-empty v-else description="No hay torneos públicos" />
    </a-spin>
  </div>
</template>

<style scoped lang="scss">
.page {
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem 1.5rem;

  h1 {
    margin: 0 0 1.5rem;
    font-family: 'Bebas Neue', sans-serif;
    font-size: 2.5rem;
  }
}

.page__list {
  display: grid;
  gap: 0.75rem;
}

.page__card {
  display: block;
  padding: 1.25rem;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: inherit;
  text-decoration: none;
  transition: border-color 0.2s;

  &:hover {
    border-color: rgba(0, 212, 255, 0.4);
  }

  h3 { margin: 0 0 0.5rem; }
  p { margin: 0 0 0.5rem; font-size: 0.85rem; opacity: 0.7; }
}
</style>
