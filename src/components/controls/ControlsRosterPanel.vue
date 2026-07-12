<script setup lang="ts">
import { computed } from 'vue'
import { useScoreboardStore } from '@/stores/scoreboard'
import { roleLabel } from '@/utils/roster'
import type { PlayerRole } from '@/types/hockeyScoreboard'

const store = useScoreboardStore()

const roleOptions: { value: PlayerRole; label: string }[] = [
  { value: 'player', label: 'Jugador' },
  { value: 'goalkeeper', label: 'Arquero' },
  { value: 'captain', label: 'Capitán' },
  { value: 'assistant_captain', label: 'Asist. capitán' },
]

const teams = computed(() => [
  { key: 'local' as const, label: 'Local', name: store.state.localTeam },
  { key: 'visit' as const, label: 'Visita', name: store.state.visitTeam },
])

function rosterFor(team: 'local' | 'visit') {
  return team === 'local' ? store.state.rosterLocal : store.state.rosterVisit
}
</script>

<template>
  <div class="roster-panel">
    <p class="roster-panel__hint">
      Registra jugadores con número y nombre. Roles: arquero, capitán (1) y asistentes de capitán (hasta 2).
    </p>

    <div class="roster-panel__grid">
      <section
        v-for="team in teams"
        :key="team.key"
        class="roster-panel__team"
      >
        <h3>{{ team.label }} — {{ team.name }}</h3>

        <div v-if="rosterFor(team.key).length" class="roster-panel__list">
          <div
            v-for="player in rosterFor(team.key)"
            :key="player.id"
            class="roster-panel__row"
          >
            <a-input
              :value="player.number"
              placeholder="#"
              class="roster-panel__number"
              @update:value="(v: string) => store.updateRosterPlayer(team.key, player.id, { number: v })"
            />
            <a-input
              :value="player.name"
              placeholder="Nombre"
              @update:value="(v: string) => store.updateRosterPlayer(team.key, player.id, { name: v })"
            />
            <a-select
              :value="player.role"
              class="roster-panel__role"
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
              danger
              size="small"
              @click="store.removeRosterPlayer(team.key, player.id)"
            >
              ×
            </a-button>
          </div>
        </div>

        <a-empty
          v-else
          :image-style="{ height: '40px' }"
          description="Sin jugadores"
        />

        <a-button block @click="store.addRosterPlayer(team.key)">
          + Agregar jugador
        </a-button>

        <div class="roster-panel__summary">
          <span v-if="rosterFor(team.key).some((p) => p.role === 'captain')">
            {{ roleLabel('captain') }}: {{
              rosterFor(team.key).find((p) => p.role === 'captain')?.name
                || `#${rosterFor(team.key).find((p) => p.role === 'captain')?.number}`
            }}
          </span>
          <span>
            Asistentes: {{
              rosterFor(team.key).filter((p) => p.role === 'assistant_captain').length
            }}/2
          </span>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped lang="scss">
.roster-panel__hint {
  margin: 0 0 1rem;
  font-size: 0.82rem;
  opacity: 0.65;
}

.roster-panel__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1rem;
}

.roster-panel__team {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  padding: 1rem;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.07);

  h3 {
    margin: 0;
    font-size: 0.95rem;
  }
}

.roster-panel__list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.roster-panel__row {
  display: grid;
  grid-template-columns: 56px 1fr 130px auto;
  gap: 0.4rem;
  align-items: center;
}

.roster-panel__number {
  text-align: center;
  font-family: 'Bebas Neue', sans-serif;
  letter-spacing: 0.04em;
}

.roster-panel__summary {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  font-size: 0.78rem;
  opacity: 0.6;
}
</style>
