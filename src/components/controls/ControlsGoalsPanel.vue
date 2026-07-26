<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useScoreboardStore } from '@/stores/scoreboard'
import { isGoalPending } from '@/types/hockeyScoreboard'
import type { GoalEvent } from '@/types/hockeyScoreboard'
import { findPlayerById, playerLabel } from '@/utils/roster'

const store = useScoreboardStore()

const goalModalOpen = ref(false)
const completingGoalId = ref<string | null>(null)

const goalForm = reactive({
  scorerPlayerId: '',
  assistPlayerId: '',
})

const pendingGoalsCount = computed(
  () => store.state.goals.filter((goal) => isGoalPending(goal)).length,
)

const teams = computed(() => [
  {
    key: 'local' as const,
    label: 'Local',
    name: store.state.localTeam,
    roster: store.state.rosterLocal,
    goals: store.state.goals.filter((goal) => goal.team === 'local'),
    shots: store.state.shots.filter((shot) => shot.team === 'local'),
  },
  {
    key: 'visit' as const,
    label: 'Visita',
    name: store.state.visitTeam,
    roster: store.state.rosterVisit,
    goals: store.state.goals.filter((goal) => goal.team === 'visit'),
    shots: store.state.shots.filter((shot) => shot.team === 'visit'),
  },
])

const completingGoal = computed(() =>
  store.state.goals.find((goal) => goal.id === completingGoalId.value) ?? null,
)

const completingTeam = computed(() => completingGoal.value?.team ?? 'local')

function openCompleteModal(goal: GoalEvent): void {
  if (!isGoalPending(goal)) return
  completingGoalId.value = goal.id
  goalForm.scorerPlayerId = ''
  goalForm.assistPlayerId = ''
  goalModalOpen.value = true
}

function submitGoal(): void {
  if (!completingGoalId.value || !goalForm.scorerPlayerId) return
  store.completeGoal(
    completingGoalId.value,
    goalForm.scorerPlayerId,
    goalForm.assistPlayerId || null,
  )
  goalModalOpen.value = false
  completingGoalId.value = null
}

function goalDescription(team: 'local' | 'visit', scorerId: string, assistId: string | null): string {
  const roster = team === 'local' ? store.state.rosterLocal : store.state.rosterVisit
  const scorer = findPlayerById(roster, scorerId)
  const assist = assistId ? findPlayerById(roster, assistId) : undefined
  const scorerText = scorer ? playerLabel(scorer) : '—'
  const assistText = assist ? playerLabel(assist) : null
  return assistText ? `${scorerText} (A: ${assistText})` : scorerText
}

function rosterFor(team: 'local' | 'visit') {
  return team === 'local' ? store.state.rosterLocal : store.state.rosterVisit
}
</script>

<template>
  <div class="goals-panel">
    <p class="goals-panel__hint">
      Marca el gol con <strong>+</strong> en la pestaña Partido para capturar el minuto exacto.
      Luego completa aquí quién anotó y la asistencia.
    </p>

    <a-alert
      v-if="pendingGoalsCount > 0"
      type="warning"
      show-icon
      class="goals-panel__pending-alert"
      :message="`${pendingGoalsCount} gol(es) pendiente(s) de registrar`"
      description="Selecciona cada gol pendiente para indicar autor y asistencia."
    />

    <div class="goals-panel__grid">
      <section
        v-for="team in teams"
        :key="team.key"
        class="goals-panel__team"
      >
        <div class="goals-panel__header">
          <h3>{{ team.label }}</h3>
          <span class="goals-panel__team-name">{{ team.name }}</span>
        </div>

        <div v-if="team.goals.length" class="goals-panel__list">
          <div
            v-for="(goal, index) in team.goals"
            :key="goal.id"
            class="goals-panel__item"
            :class="{ 'goals-panel__item--pending': isGoalPending(goal) }"
          >
            <span class="goals-panel__index">G{{ index + 1 }}</span>
            <div class="goals-panel__meta">
              <template v-if="isGoalPending(goal)">
                <strong>Gol pendiente</strong>
                <span>P{{ goal.period }} · {{ goal.gameMinute }}</span>
              </template>
              <template v-else>
                <strong>{{ goalDescription(team.key, goal.scorerPlayerId, goal.assistPlayerId) }}</strong>
                <span>P{{ goal.period }} · {{ goal.gameMinute }}</span>
              </template>
            </div>
            <a-button
              v-if="isGoalPending(goal)"
              type="primary"
              size="small"
              @click="openCompleteModal(goal)"
            >
              Completar
            </a-button>
          </div>
        </div>
        <a-empty v-else :image-style="{ height: '36px' }" description="Sin goles registrados" />

        <div class="goals-panel__shots">
          <div class="goals-panel__shots-head">
            <h4>Tiros y atajadas</h4>
            <span>
              {{ team.shots.filter((s) => s.result === 'miss').length }} tiros ·
              {{ team.shots.filter((s) => s.result === 'save').length }} atajadas
            </span>
          </div>
          <ul v-if="team.shots.length" class="goals-panel__shot-list">
            <li v-for="shot in team.shots" :key="shot.id">
              {{ shot.result === 'save' ? 'Atajada' : 'Tiro' }}
              · P{{ shot.period }} {{ shot.gameMinute }}
            </li>
          </ul>
          <p v-else class="goals-panel__shot-empty">Sin tiros ni atajadas</p>
        </div>

        <a-button
          v-if="team.goals.length"
          danger
          size="small"
          block
          @click="store.removeLastGoal(team.key)"
        >
          Deshacer último gol
        </a-button>
      </section>
    </div>

    <a-modal
      v-model:open="goalModalOpen"
      :title="`Completar gol — ${completingTeam === 'local' ? store.state.localTeam : store.state.visitTeam}`"
      ok-text="Guardar"
      cancel-text="Cancelar"
      :ok-button-props="{ disabled: !goalForm.scorerPlayerId }"
      @ok="submitGoal"
    >
      <a-form layout="vertical">
        <a-form-item label="Minuto del partido">
          <a-input
            :value="completingGoal ? `P${completingGoal.period} · ${completingGoal.gameMinute}` : ''"
            disabled
          />
          <span class="goals-panel__clock-note">Capturado al marcar el gol en la pestaña Partido</span>
        </a-form-item>
        <a-form-item label="Jugador que anotó" required>
          <a-select
            v-model:value="goalForm.scorerPlayerId"
            placeholder="Seleccionar jugador"
            show-search
            option-filter-prop="label"
          >
            <a-select-option
              v-for="player in rosterFor(completingTeam)"
              :key="player.id"
              :value="player.id"
              :label="playerLabel(player)"
            >
              {{ playerLabel(player) }}
            </a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="Asistencia (opcional)">
          <a-select
            v-model:value="goalForm.assistPlayerId"
            placeholder="Sin asistencia"
            allow-clear
            show-search
            option-filter-prop="label"
          >
            <a-select-option
              v-for="player in rosterFor(completingTeam)"
              :key="`assist-${player.id}`"
              :value="player.id"
              :label="playerLabel(player)"
              :disabled="player.id === goalForm.scorerPlayerId"
            >
              {{ playerLabel(player) }}
            </a-select-option>
          </a-select>
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<style scoped lang="scss">
.goals-panel__hint {
  margin: 0 0 1rem;
  font-size: 0.82rem;
  opacity: 0.65;
}

.goals-panel__pending-alert {
  margin-bottom: 1rem;
}

.goals-panel__grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;

  @media (max-width: 720px) {
    grid-template-columns: 1fr;
  }
}

.goals-panel__team {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  padding: 1rem;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.07);
  min-width: 0;

  &:first-child {
    border-top: 2px solid rgba(0, 212, 255, 0.45);
  }

  &:last-child {
    border-top: 2px solid rgba(255, 107, 53, 0.45);
  }
}

.goals-panel__header {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.15rem;

  h3 {
    margin: 0;
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    opacity: 0.55;
  }
}

.goals-panel__team-name {
  font-size: 0.95rem;
  font-weight: 650;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}

.goals-panel__list {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.goals-panel__shots {
  padding-top: 0.55rem;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.goals-panel__shots-head {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  margin-bottom: 0.4rem;

  h4 {
    margin: 0;
    font-size: 0.72rem;
    font-weight: 650;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    opacity: 0.65;
  }

  span {
    font-size: 0.72rem;
    opacity: 0.5;
  }
}

.goals-panel__shot-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.28rem;
  font-size: 0.8rem;
  opacity: 0.8;
}

.goals-panel__shot-empty {
  margin: 0;
  font-size: 0.8rem;
  opacity: 0.45;
}

.goals-panel__item {
  display: flex;
  gap: 0.6rem;
  align-items: center;
  padding: 0.55rem 0.65rem;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.04);

  &--pending {
    border: 1px solid rgba(255, 193, 7, 0.35);
    background: rgba(255, 193, 7, 0.08);
  }
}

.goals-panel__index {
  font-family: 'Bebas Neue', sans-serif;
  font-size: 1.1rem;
  color: #00d4ff;
  min-width: 2ch;
}

.goals-panel__meta {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  font-size: 0.85rem;
  flex: 1;

  span {
    opacity: 0.55;
    font-size: 0.78rem;
  }
}

.goals-panel__clock-note {
  display: block;
  margin-top: 0.25rem;
  font-size: 0.75rem;
  opacity: 0.55;
}
</style>
