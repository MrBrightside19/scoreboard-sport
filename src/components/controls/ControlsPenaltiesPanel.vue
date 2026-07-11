<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useScoreboardStore } from '@/stores/scoreboard'
import {
  COMMON_INFRACTIONS,
  PENALTY_CATALOG,
  penaltyTypeLabel,
  secondsToClock,
} from '@/data/penaltyCatalog'
import { playerLabel } from '@/utils/roster'
import { MAX_PENALTIES_PER_TEAM } from '@/types/hockeyScoreboard'

const store = useScoreboardStore()

const penaltyModalOpen = ref(false)
const penaltyTeam = ref<'local' | 'visit'>('local')

const penaltyForm = reactive({
  playerId: '',
  penaltyTypeId: 'minor',
  infraction: '',
})

const teams = computed(() => [
  {
    key: 'local' as const,
    label: 'Local',
    name: store.state.localTeam,
    roster: store.state.rosterLocal,
    penalties: store.state.penaltiesLocal,
  },
  {
    key: 'visit' as const,
    label: 'Visita',
    name: store.state.visitTeam,
    roster: store.state.rosterVisit,
    penalties: store.state.penaltiesVisit,
  },
])

function openPenaltyModal(team: 'local' | 'visit'): void {
  penaltyTeam.value = team
  penaltyForm.playerId = ''
  penaltyForm.penaltyTypeId = 'minor'
  penaltyForm.infraction = ''
  penaltyModalOpen.value = true
}

function submitPenalty(): void {
  if (!penaltyForm.playerId) return
  store.addPenalty(
    penaltyTeam.value,
    penaltyForm.playerId,
    penaltyForm.penaltyTypeId,
    penaltyForm.infraction,
  )
  penaltyModalOpen.value = false
}

function playerName(team: 'local' | 'visit', playerId: string, fallback: string): string {
  const roster = team === 'local' ? store.state.rosterLocal : store.state.rosterVisit
  const player = roster.find((item) => item.id === playerId)
  return player ? playerLabel(player) : fallback ? `#${fallback}` : '—'
}
</script>

<template>
  <div class="penalties-panel">
    <p class="penalties-panel__hint">
      Hasta {{ MAX_PENALTIES_PER_TEAM }} penalidades simultáneas por equipo (reglamento Worldskate 2026).
      Selecciona jugador, tipo de falta e infracción.
    </p>

    <div class="penalties-panel__grid">
      <section
        v-for="team in teams"
        :key="team.key"
        class="penalties-panel__team"
      >
        <div class="penalties-panel__header">
          <h3>
            {{ team.label }} — {{ team.name }}
            <span class="penalties-panel__count">{{ team.penalties.length }}/{{ MAX_PENALTIES_PER_TEAM }}</span>
          </h3>
          <a-button
            v-if="team.penalties.length < MAX_PENALTIES_PER_TEAM"
            size="small"
            @click="openPenaltyModal(team.key)"
          >
            + Penalidad
          </a-button>
        </div>

        <div v-if="team.penalties.length" class="penalties-panel__list">
          <div
            v-for="penalty in team.penalties"
            :key="penalty.id"
            class="penalties-panel__item"
          >
            <div class="penalties-panel__item-main">
              <strong>{{ playerName(team.key, penalty.playerId, penalty.player) }}</strong>
              <span>{{ penaltyTypeLabel(penalty.penaltyTypeId) }} · {{ penalty.time }}</span>
              <span v-if="penalty.infraction" class="penalties-panel__infraction">{{ penalty.infraction }}</span>
            </div>
            <a-button
              danger
              size="small"
              @click="store.removePenalty(team.key, penalty.id)"
            >
              Quitar
            </a-button>
          </div>
        </div>
        <a-empty v-else :image-style="{ height: '36px' }" description="Sin penalidades activas" />
      </section>
    </div>

    <details class="penalties-panel__catalog">
      <summary>Catálogo de penalidades (Worldskate 2026)</summary>
      <div class="penalties-panel__catalog-table">
        <div class="penalties-panel__catalog-head">
          <span>Tipo</span>
          <span>Duración</span>
          <span>Detalle</span>
        </div>
        <div
          v-for="type in PENALTY_CATALOG"
          :key="type.id"
          class="penalties-panel__catalog-row"
        >
          <span>{{ type.category }}</span>
          <span>{{ secondsToClock(type.durationSeconds) }} ({{ type.durationSeconds }} s)</span>
          <span>{{ type.description }}</span>
        </div>
      </div>
    </details>

    <a-modal
      v-model:open="penaltyModalOpen"
      :title="`Nueva penalidad — ${penaltyTeam === 'local' ? store.state.localTeam : store.state.visitTeam}`"
      ok-text="Aplicar"
      cancel-text="Cancelar"
      :ok-button-props="{ disabled: !penaltyForm.playerId }"
      @ok="submitPenalty"
    >
      <a-form layout="vertical">
        <a-form-item label="Jugador que cometió la falta" required>
          <a-select
            v-model:value="penaltyForm.playerId"
            placeholder="Seleccionar jugador"
            show-search
            option-filter-prop="label"
          >
            <a-select-option
              v-for="player in (penaltyTeam === 'local' ? store.state.rosterLocal : store.state.rosterVisit)"
              :key="player.id"
              :value="player.id"
              :label="playerLabel(player)"
            >
              {{ playerLabel(player) }}
            </a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="Tipo de penalidad" required>
          <a-select v-model:value="penaltyForm.penaltyTypeId">
            <a-select-option
              v-for="type in PENALTY_CATALOG"
              :key="type.id"
              :value="type.id"
            >
              {{ type.category }} — {{ secondsToClock(type.durationSeconds) }}
            </a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="Infracción (opcional)">
          <a-select
            v-model:value="penaltyForm.infraction"
            placeholder="Seleccionar o escribir abajo"
            allow-clear
            show-search
          >
            <a-select-option
              v-for="infraction in COMMON_INFRACTIONS"
              :key="infraction"
              :value="infraction"
            >
              {{ infraction }}
            </a-select-option>
          </a-select>
          <a-input
            v-model:value="penaltyForm.infraction"
            placeholder="Otra infracción"
            style="margin-top: 0.5rem"
          />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<style scoped lang="scss">
.penalties-panel__hint {
  margin: 0 0 1rem;
  font-size: 0.82rem;
  opacity: 0.65;
}

.penalties-panel__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1rem;
  margin-bottom: 1rem;
}

.penalties-panel__team {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  padding: 1rem;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.07);
}

.penalties-panel__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;

  h3 {
    margin: 0;
    font-size: 0.95rem;
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }
}

.penalties-panel__count {
  font-size: 0.78rem;
  opacity: 0.55;
  font-weight: 500;
}

.penalties-panel__list {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.penalties-panel__item {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 0.55rem 0.65rem;
  border-radius: 8px;
  background: rgba(255, 71, 87, 0.08);
  border: 1px solid rgba(255, 71, 87, 0.15);
}

.penalties-panel__item-main {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  font-size: 0.85rem;

  span {
    opacity: 0.7;
    font-size: 0.78rem;
  }
}

.penalties-panel__infraction {
  color: #ff9f6b;
}

.penalties-panel__catalog {
  padding: 0.75rem 1rem;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.07);
  font-size: 0.82rem;

  summary {
    cursor: pointer;
    font-weight: 600;
    opacity: 0.8;
  }
}

.penalties-panel__catalog-table {
  margin-top: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.penalties-panel__catalog-head,
.penalties-panel__catalog-row {
  display: grid;
  grid-template-columns: 120px 110px 1fr;
  gap: 0.5rem;
}

.penalties-panel__catalog-head {
  font-weight: 600;
  opacity: 0.55;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.penalties-panel__catalog-row span:last-child {
  opacity: 0.7;
}
</style>
