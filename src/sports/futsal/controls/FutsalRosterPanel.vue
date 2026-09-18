<script setup lang="ts">
import { computed } from 'vue'
import { useScoreboardStore } from '@/stores/scoreboard'
import type { PlayerRole } from '@/sports/scoreboardState'

const store = useScoreboardStore()

const roleOptions: { value: PlayerRole; label: string }[] = [
  { value: 'player', label: 'Jugador' },
  { value: 'goalkeeper', label: 'Portero' },
  { value: 'captain', label: 'Capitán' },
]

const teams = computed(() => [
  { key: 'local' as const, label: 'Local', name: store.state.localTeam },
  { key: 'visit' as const, label: 'Visita', name: store.state.visitTeam },
])

function rosterFor(team: 'local' | 'visit') {
  return team === 'local' ? store.state.rosterLocal : store.state.rosterVisit
}

function digitsOnly(value: string, max = 3): string {
  return value.replace(/\D/g, '').slice(0, max)
}
</script>

<template>
  <div class="futsal-roster">
    <p class="futsal-roster__hint">
      Nómina de futsal: número, nombre y rol (jugador, portero o capitán).
    </p>
    <div class="futsal-roster__grid">
      <section v-for="team in teams" :key="team.key" class="futsal-roster__team">
        <h3>{{ team.label }} — {{ team.name }}</h3>
        <div v-if="rosterFor(team.key).length" class="futsal-roster__list">
          <div
            v-for="player in rosterFor(team.key)"
            :key="player.id"
            class="futsal-roster__row"
          >
            <a-input
              :value="player.number"
              placeholder="#"
              maxlength="3"
              inputmode="numeric"
              @update:value="(v: string) => store.updateRosterPlayer(team.key, player.id, { number: digitsOnly(v) })"
            />
            <a-input
              :value="player.name"
              placeholder="Nombre"
              @update:value="(v: string) => store.updateRosterPlayer(team.key, player.id, { name: v })"
            />
            <a-select
              :value="player.role === 'assistant_captain' ? 'player' : player.role"
              @update:value="(v: PlayerRole) => store.updateRosterPlayer(team.key, player.id, { role: v })"
            >
              <a-select-option
                v-for="option in roleOptions"
                :key="option.value"
                :value="option.value"
              >
                {{ option.label }}
              </a-select-option>
            </a-select>
            <a-button
              type="text"
              danger
              @click="store.removeRosterPlayer(team.key, player.id)"
            >
              ×
            </a-button>
          </div>
        </div>
        <a-empty v-else description="Sin jugadores" :image-style="{ height: '36px' }" />
        <a-button block @click="store.addRosterPlayer(team.key)">+ Agregar</a-button>
      </section>
    </div>
  </div>
</template>

<style scoped lang="scss">
.futsal-roster__hint {
  margin: 0 0 1rem;
  font-size: 0.82rem;
  color: var(--app-text-muted);
}

.futsal-roster__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1rem;
}

.futsal-roster__team {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  padding: 1rem;
  border-radius: 12px;
  border: 1px solid var(--app-border);
  background: var(--app-surface);

  h3 {
    margin: 0;
    font-size: 0.95rem;
  }
}

.futsal-roster__list {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.futsal-roster__row {
  display: grid;
  grid-template-columns: 3.2rem minmax(0, 1fr) 7rem 1.75rem;
  gap: 0.35rem;
  align-items: center;
}
</style>
