<script setup lang="ts">
import { computed } from 'vue'
import { useScoreboardStore } from '@/stores/scoreboard'
import { playerLabel, roleLabel } from '@/utils/roster'
import type { PlayerRole } from '@/types/hockeyScoreboard'

const store = useScoreboardStore()

const roleOptions: { value: PlayerRole; label: string }[] = [
  { value: 'player', label: 'Jugador' },
  { value: 'goalkeeper', label: 'Arquero' },
  { value: 'captain', label: 'Capitán' },
  { value: 'assistant_captain', label: 'Asistente Capitán' },
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

function setPlayerNumber(
  team: 'local' | 'visit',
  playerId: string,
  value: string,
): void {
  store.updateRosterPlayer(team, playerId, { number: digitsOnly(value) })
}

function onNumberKeydown(event: KeyboardEvent): void {
  if (event.ctrlKey || event.metaKey || event.altKey) return
  const allowed = [
    'Backspace',
    'Delete',
    'Tab',
    'Escape',
    'Enter',
    'ArrowLeft',
    'ArrowRight',
    'ArrowUp',
    'ArrowDown',
    'Home',
    'End',
  ]
  if (allowed.includes(event.key)) return
  if (!/^\d$/.test(event.key)) {
    event.preventDefault()
  }
}

function onNumberPaste(
  event: ClipboardEvent,
  team: 'local' | 'visit',
  playerId: string,
): void {
  event.preventDefault()
  event.stopPropagation()
  const text = event.clipboardData?.getData('text') ?? ''
  setPlayerNumber(team, playerId, text)
}
</script>

<template>
  <div class="roster-panel">
    <p class="roster-panel__hint">
      Jugadores del partido (número, nombre y apellido). El tipo de jugador se elige en el selector
      (jugador, arquero, capitán o Asistente Capitán). Si el torneo importó plantillas, ya aparecen
      filtradas por equipo y categoría; puedes agregar o editar desde aquí.
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
              inputmode="numeric"
              maxlength="3"
              @keydown="onNumberKeydown"
              @paste="onNumberPaste($event, team.key, player.id)"
              @update:value="(v: string) => setPlayerNumber(team.key, player.id, v)"
            />
            <a-input
              :value="player.name"
              placeholder="Nombre"
              @update:value="(v: string) => store.updateRosterPlayer(team.key, player.id, { name: v })"
            />
            <a-input
              :value="player.lastName"
              placeholder="Apellido"
              @update:value="(v: string) => store.updateRosterPlayer(team.key, player.id, { lastName: v })"
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
            {{ roleLabel('captain') }}:
            {{
              (() => {
                const captain = rosterFor(team.key).find((p) => p.role === 'captain')
                return captain ? playerLabel(captain) : '—'
              })()
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
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
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
  grid-template-columns: 52px minmax(0, 1fr) minmax(0, 1fr) 130px;
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

@media (max-width: 720px) {
  .roster-panel__row {
    grid-template-columns: 52px 1fr;
    grid-template-areas:
      "num name"
      "num last"
      "role role";
  }

  .roster-panel__row > :nth-child(1) { grid-area: num; }
  .roster-panel__row > :nth-child(2) { grid-area: name; }
  .roster-panel__row > :nth-child(3) { grid-area: last; }
  .roster-panel__row > :nth-child(4) { grid-area: role; }
}
</style>
