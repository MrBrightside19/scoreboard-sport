<script setup lang="ts">
import { computed } from 'vue'
import { useScoreboardStore } from '@/stores/scoreboard'
import type { PlayerRole } from '@/types/scoreboard'
import FootballSideSwitch from '@/sports/football/controls/FootballSideSwitch.vue'

const side = defineModel<'local' | 'visit'>('side', { default: 'local' })

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

function digitsOnly(value: string, max = 2): string {
  return value.replace(/\D/g, '').slice(0, max)
}
</script>

<template>
  <div class="football-roster" :data-side="side">
    <p class="football-roster__hint">
      Nómina de fútbol: número, nombre y rol (jugador, portero o capitán).
    </p>
    <FootballSideSwitch
      v-model="side"
      :local-name="store.state.localTeam"
      :visit-name="store.state.visitTeam"
    />
    <div class="football-roster__grid">
      <section
        v-for="team in teams"
        :key="team.key"
        class="football-roster__team"
        :class="`football-roster__team--${team.key}`"
      >
        <h3>{{ team.label }} — {{ team.name }}</h3>
        <div v-if="rosterFor(team.key).length" class="football-roster__list">
          <div
            v-for="player in rosterFor(team.key)"
            :key="player.id"
            class="football-roster__row"
          >
            <a-input
              :value="player.number"
              placeholder="#"
              maxlength="2"
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
.football-roster__hint {
  margin: 0 0 1rem;
  font-size: 0.82rem;
  color: var(--app-text-muted);
}

.football-roster__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1rem;
}

.football-roster__team {
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

.football-roster__list {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.football-roster__row {
  display: grid;
  grid-template-columns: 3.2rem minmax(0, 1fr) 7rem 1.75rem;
  gap: 0.35rem;
  align-items: center;
}
</style>
