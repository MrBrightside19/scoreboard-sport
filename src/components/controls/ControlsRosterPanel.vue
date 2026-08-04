<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { useScoreboardStore } from '@/stores/scoreboard'
import { syncBothMatchRostersToTournament } from '@/services/tournamentService'
import { playerLabel, roleLabel } from '@/utils/roster'
import type { PlayerRole } from '@/types/hockeyScoreboard'

const props = withDefaults(
  defineProps<{
    tournamentId?: string | null
    /** Evita pisar la plantilla del torneo al hidratar el partido. */
    syncEnabled?: boolean
  }>(),
  {
    tournamentId: null,
    syncEnabled: false,
  },
)

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

const syncStatus = ref<'idle' | 'pending' | 'saving' | 'saved' | 'error'>('idle')
const syncError = ref('')
let debounceTimer: number | null = null
let skipInitialWatch = true
let syncSeq = 0

const canSyncToTournament = computed(
  () => Boolean(props.tournamentId) && props.syncEnabled,
)

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

function clearDebounce(): void {
  if (debounceTimer != null) {
    window.clearTimeout(debounceTimer)
    debounceTimer = null
  }
}

async function runTournamentRosterSync(): Promise<void> {
  const tournamentId = props.tournamentId?.trim()
  if (!tournamentId) return

  const seq = ++syncSeq
  syncStatus.value = 'saving'
  syncError.value = ''
  try {
    await syncBothMatchRostersToTournament(
      tournamentId,
      store.state.matchCategory,
      store.state.localTeam,
      store.state.visitTeam,
      store.state.rosterLocal,
      store.state.rosterVisit,
    )
    if (seq !== syncSeq) return
    syncStatus.value = 'saved'
  } catch (err) {
    if (seq !== syncSeq) return
    syncStatus.value = 'error'
    syncError.value =
      err instanceof Error ? err.message : 'No se pudo guardar la nómina del torneo.'
  }
}

function scheduleTournamentRosterSync(): void {
  if (!canSyncToTournament.value) return
  syncStatus.value = 'pending'
  clearDebounce()
  debounceTimer = window.setTimeout(() => {
    debounceTimer = null
    void runTournamentRosterSync()
  }, 800)
}

/** Fuerza guardar la plantilla del torneo (p. ej. antes de pasar de partido). */
async function flushTournamentRosterSync(): Promise<void> {
  clearDebounce()
  if (!props.tournamentId?.trim()) return
  await runTournamentRosterSync()
}

watch(
  () => [props.syncEnabled, props.tournamentId] as const,
  () => {
    skipInitialWatch = true
    syncStatus.value = 'idle'
    syncError.value = ''
    clearDebounce()
  },
)

watch(
  () =>
    canSyncToTournament.value
      ? {
          local: store.state.rosterLocal,
          visit: store.state.rosterVisit,
          localTeam: store.state.localTeam,
          visitTeam: store.state.visitTeam,
          category: store.state.matchCategory,
        }
      : null,
  () => {
    if (!canSyncToTournament.value) return
    if (skipInitialWatch) {
      skipInitialWatch = false
      return
    }
    scheduleTournamentRosterSync()
  },
  { deep: true },
)

onUnmounted(() => {
  clearDebounce()
})

defineExpose({ flushTournamentRosterSync })
</script>

<template>
  <div class="roster-panel">
    <p class="roster-panel__hint">
      Jugadores del partido (número y nombre completo). El tipo de jugador se elige en el selector
      (jugador, arquero, capitán o Asistente Capitán). Si el torneo importó la nómina, ya aparecen
      filtradas por equipo y categoría; puedes agregar o editar desde aquí.
      <template v-if="canSyncToTournament">
        Los cambios se guardan en la nómina del torneo para los próximos partidos
        (el dorsal es obligatorio para que el jugador se conserve).
      </template>
    </p>
    <p
      v-if="canSyncToTournament && syncStatus !== 'idle'"
      class="roster-panel__sync"
      :class="`roster-panel__sync--${syncStatus}`"
    >
      <template v-if="syncStatus === 'pending' || syncStatus === 'saving'">
        Guardando nómina del torneo…
      </template>
      <template v-else-if="syncStatus === 'saved'">Nómina del torneo actualizada</template>
      <template v-else>No se pudo sincronizar: {{ syncError }}</template>
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
              size="large"
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
              size="large"
              :value="player.name"
              placeholder="Nombre y apellido"
              class="roster-panel__name"
              @update:value="(v: string) => store.updateRosterPlayer(team.key, player.id, { name: v })"
            />
            <a-select
              size="large"
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
            <a-popconfirm
              title="¿Eliminar este jugador?"
              ok-text="Eliminar"
              cancel-text="Cancelar"
              ok-type="danger"
              @confirm="store.removeRosterPlayer(team.key, player.id)"
            >
              <a-button
                type="text"
                danger
                class="roster-panel__remove"
                aria-label="Eliminar jugador"
              >
                ×
              </a-button>
            </a-popconfirm>
          </div>
        </div>

        <a-empty
          v-else
          :image-style="{ height: '40px' }"
          description="Sin jugadores"
        />

        <a-button block size="large" @click="store.addRosterPlayer(team.key)">
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

.roster-panel__sync {
  margin: -0.5rem 0 1rem;
  font-size: 0.78rem;
}

.roster-panel__sync--pending,
.roster-panel__sync--saving {
  opacity: 0.65;
}

.roster-panel__sync--saved {
  color: #389e0d;
}

.roster-panel__sync--error {
  color: #cf1322;
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
  background: var(--app-surface);
  border: 1px solid var(--app-border);

  h3 {
    margin: 0;
    font-size: 0.95rem;
  }
}

.roster-panel__list {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}

.roster-panel__row {
  display: grid;
  grid-template-columns: 3.25rem minmax(0, 1fr) 7.25rem 1.75rem;
  gap: 0.35rem;
  align-items: center;
}

.roster-panel__number {
  text-align: center;
  font-family: 'Bebas Neue', sans-serif;
  letter-spacing: 0.04em;
  font-size: 1.15rem;
}

.roster-panel__name {
  min-width: 0;
}

.roster-panel__role {
  min-width: 0;
  width: 100%;
}

.roster-panel__remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  padding: 0;
  font-size: 1.35rem;
  line-height: 1;
  opacity: 0.7;

  &:hover {
    opacity: 1;
  }
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
    grid-template-columns: 3.25rem minmax(0, 1fr) 1.75rem;
    grid-template-areas:
      "num name remove"
      "role role role";
  }

  .roster-panel__row > :nth-child(1) { grid-area: num; }
  .roster-panel__row > :nth-child(2) { grid-area: name; }
  .roster-panel__row > :nth-child(3) { grid-area: role; }
  .roster-panel__row > :nth-child(4) { grid-area: remove; }
}
</style>
