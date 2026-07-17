<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import type { Rule } from 'ant-design-vue/es/form'
import {
  fetchTournamentRosters,
  syncTournamentTeams,
  updateTournamentRosterPlayer,
  updateTournamentTeam,
} from '@/services/tournamentService'
import {
  parseRoleFromText,
  roleLabel,
  roleToPositionText,
} from '@/utils/roster'
import type { PlayerRole } from '@/types/hockeyScoreboard'
import type { TournamentRosterPlayer, TournamentTeam } from '@/types/tournament'

const props = defineProps<{
  tournamentId: string
  canEdit: boolean
}>()

const roleOptions: { value: PlayerRole; label: string }[] = [
  { value: 'player', label: 'Jugador' },
  { value: 'goalkeeper', label: 'Arquero' },
  { value: 'captain', label: 'Capitán' },
  { value: 'assistant_captain', label: 'Asistente Capitán' },
]

const playerFormRules: Record<string, Rule[]> = {
  number: [{ required: true, message: 'Ingresa el dorsal' }],
  name: [{ required: true, message: 'Ingresa el nombre' }],
}

const loading = ref(true)
const teams = ref<TournamentTeam[]>([])
const rosters = ref<TournamentRosterPlayer[]>([])
const savingId = ref<string | null>(null)
const savingPlayerId = ref<string | null>(null)
const showPlayerModal = ref(false)
const editingPlayerId = ref<string | null>(null)
const playerFormError = ref<string | null>(null)
const logoPreview = ref<{ url: string; team: string } | null>(null)
const drafts = reactive<Record<string, { color: string; logo_url: string }>>({})

const playerForm = reactive({
  number: '',
  name: '',
  last_name: '',
  category: '',
  role: 'player' as PlayerRole,
})

const teamViews = computed(() =>
  teams.value.map((team) => {
    const players = rosters.value.filter(
      (player) => player.team.trim().toLowerCase() === team.team.trim().toLowerCase(),
    )
    const byCategory = new Map<string, TournamentRosterPlayer[]>()
    for (const player of players) {
      const key = player.category?.trim() || 'Sin categoría'
      const list = byCategory.get(key) ?? []
      list.push(player)
      byCategory.set(key, list)
    }
    return {
      team,
      playerCount: players.length,
      categories: [...byCategory.entries()]
        .sort(([a], [b]) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
        .map(([category, items]) => ({
          category,
          players: items.sort((a, b) =>
            a.number.localeCompare(b.number, undefined, { numeric: true }),
          ),
        })),
    }
  }),
)

function ensureDraft(team: TournamentTeam): void {
  if (!drafts[team.id]) {
    drafts[team.id] = {
      color: team.color || '#3da5ff',
      logo_url: team.logo_url || '',
    }
  }
}

function digitsOnly(value: string, max = 3): string {
  return value.replace(/\D/g, '').slice(0, max)
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

function onNumberPaste(event: ClipboardEvent): void {
  event.preventDefault()
  const text = event.clipboardData?.getData('text') ?? ''
  playerForm.number = digitsOnly(text)
}

async function loadTeams(): Promise<void> {
  loading.value = true
  try {
    const [synced, rosterRows] = await Promise.all([
      syncTournamentTeams(props.tournamentId),
      fetchTournamentRosters(props.tournamentId),
    ])
    teams.value = synced
    rosters.value = rosterRows
    for (const team of synced) {
      drafts[team.id] = {
        color: team.color || '#3da5ff',
        logo_url: team.logo_url || '',
      }
    }
  } catch (err) {
    message.error(
      err instanceof Error ? err.message : 'No se pudieron cargar los equipos.',
    )
  } finally {
    loading.value = false
  }
}

async function saveTeam(team: TournamentTeam): Promise<void> {
  ensureDraft(team)
  const draft = drafts[team.id]!
  savingId.value = team.id
  try {
    const updated = await updateTournamentTeam(team.id, {
      color: draft.color,
      logo_url: draft.logo_url,
    })
    teams.value = teams.value.map((item) =>
      item.id === team.id ? updated : item,
    )
    drafts[team.id] = {
      color: updated.color,
      logo_url: updated.logo_url,
    }
    message.success(`Equipo ${updated.team} actualizado.`)
  } catch (err) {
    message.error(
      err instanceof Error ? err.message : 'No se pudo guardar el equipo.',
    )
  } finally {
    savingId.value = null
  }
}

function playerRole(player: TournamentRosterPlayer): string {
  return roleLabel(parseRoleFromText(player.position))
}

function openLogoPreview(view: { team: TournamentTeam }): void {
  const url = drafts[view.team.id]?.logo_url || view.team.logo_url
  if (!url) return
  logoPreview.value = { url, team: view.team.team }
}

function resetPlayerForm(): void {
  editingPlayerId.value = null
  playerForm.number = ''
  playerForm.name = ''
  playerForm.last_name = ''
  playerForm.category = ''
  playerForm.role = 'player'
  playerFormError.value = null
}

function openEditPlayer(player: TournamentRosterPlayer): void {
  if (!props.canEdit) return
  editingPlayerId.value = player.id
  playerForm.number = player.number
  playerForm.name = player.name
  playerForm.last_name = player.last_name ?? ''
  playerForm.category = player.category ?? ''
  playerForm.role = parseRoleFromText(player.position)
  playerFormError.value = null
  showPlayerModal.value = true
}

async function submitPlayer(): Promise<void> {
  if (!editingPlayerId.value) return

  savingPlayerId.value = editingPlayerId.value
  playerFormError.value = null
  try {
    const updated = await updateTournamentRosterPlayer(editingPlayerId.value, {
      number: digitsOnly(playerForm.number),
      name: playerForm.name.trim(),
      last_name: playerForm.last_name.trim(),
      category: playerForm.category.trim() || null,
      position: roleToPositionText(playerForm.role),
    })
    rosters.value = rosters.value.map((item) =>
      item.id === updated.id ? updated : item,
    )
    showPlayerModal.value = false
    resetPlayerForm()
    message.success('Jugador actualizado.')
  } catch (err) {
    playerFormError.value =
      err instanceof Error ? err.message : 'No se pudo guardar el jugador.'
  } finally {
    savingPlayerId.value = null
  }
}

watch(
  () => props.tournamentId,
  () => {
    void loadTeams()
  },
)

onMounted(() => {
  void loadTeams()
})

defineExpose({ reload: loadTeams })
</script>

<template>
  <a-spin :spinning="loading">
    <div class="teams-panel">
      <header class="teams-panel__intro">
        <p>
          Revisa las plantillas por equipo y define el color y el logo que se
          usarán en el overlay al iniciar un partido.
        </p>
        <a-button size="small" :loading="loading" @click="loadTeams">
          Actualizar
        </a-button>
      </header>

      <a-empty
        v-if="!loading && !teamViews.length"
        description="Aún no hay equipos. Agrega partidos o importa la plantilla."
      />

      <div v-else class="teams-panel__list">
        <article
          v-for="view in teamViews"
          :key="view.team.id"
          class="teams-panel__card"
        >
          <div class="teams-panel__head">
            <div class="teams-panel__identity">
              <span
                class="teams-panel__swatch"
                :style="{ background: drafts[view.team.id]?.color || view.team.color }"
              />
              <div>
                <h3>{{ view.team.team }}</h3>
                <p>
                  {{ view.playerCount }}
                  {{ view.playerCount === 1 ? 'jugador' : 'jugadores' }}
                </p>
              </div>
              <button
                v-if="drafts[view.team.id]?.logo_url || view.team.logo_url"
                type="button"
                class="teams-panel__logo-btn"
                :aria-label="`Ver logo de ${view.team.team}`"
                @click="openLogoPreview(view)"
              >
                <img
                  :src="drafts[view.team.id]?.logo_url || view.team.logo_url"
                  :alt="view.team.team"
                  class="teams-panel__logo-preview"
                />
              </button>
            </div>

            <div v-if="canEdit && drafts[view.team.id]" class="teams-panel__fields">
              <label class="teams-panel__field">
                <span>Color</span>
                <input
                  v-model="drafts[view.team.id]!.color"
                  type="color"
                  class="teams-panel__color"
                />
              </label>
              <label class="teams-panel__field teams-panel__field--grow">
                <span>Logo (URL)</span>
                <a-input
                  v-model:value="drafts[view.team.id]!.logo_url"
                  placeholder="https://…"
                  allow-clear
                />
              </label>
              <a-button
                type="primary"
                :loading="savingId === view.team.id"
                @click="saveTeam(view.team)"
              >
                Guardar
              </a-button>
            </div>
            <div v-else class="teams-panel__readonly">
              <span
                class="teams-panel__swatch teams-panel__swatch--sm"
                :style="{ background: view.team.color }"
              />
              <span class="teams-panel__muted">
                {{ view.team.logo_url || 'Sin logo' }}
              </span>
            </div>
          </div>

          <div v-if="view.categories.length" class="teams-panel__categories">
            <div
              v-for="group in view.categories"
              :key="group.category"
              class="teams-panel__category"
            >
              <h4>{{ group.category }}</h4>
              <div class="teams-panel__players">
                <div
                  v-for="player in group.players"
                  :key="player.id"
                  class="teams-panel__player"
                >
                  <span class="teams-panel__number">#{{ player.number }}</span>
                  <span class="teams-panel__name">
                    {{ player.name }} {{ player.last_name }}
                  </span>
                  <span class="teams-panel__role">{{ playerRole(player) }}</span>
                  <a-button
                    v-if="canEdit"
                    type="link"
                    size="small"
                    class="teams-panel__edit"
                    @click="openEditPlayer(player)"
                  >
                    Editar
                  </a-button>
                </div>
              </div>
            </div>
          </div>
          <p v-else class="teams-panel__empty-roster">
            Sin jugadores importados para este equipo.
          </p>
        </article>
      </div>
    </div>

    <a-modal
      v-model:open="showPlayerModal"
      title="Editar jugador"
      :footer="null"
      destroy-on-close
      @cancel="resetPlayerForm"
    >
      <a-form
        layout="vertical"
        :model="playerForm"
        :rules="playerFormRules"
        @finish="submitPlayer"
      >
        <div class="player-form__grid">
          <a-form-item label="Dorsal" name="number">
            <a-input
              v-model:value="playerForm.number"
              placeholder="#"
              inputmode="numeric"
              maxlength="3"
              :disabled="!!savingPlayerId"
              @keydown="onNumberKeydown"
              @paste="onNumberPaste"
              @update:value="(v: string) => { playerForm.number = digitsOnly(v) }"
            />
          </a-form-item>
          <a-form-item label="Categoría">
            <a-input
              v-model:value="playerForm.category"
              placeholder="Opcional"
              :disabled="!!savingPlayerId"
            />
          </a-form-item>
        </div>

        <div class="player-form__grid">
          <a-form-item label="Nombre" name="name">
            <a-input
              v-model:value="playerForm.name"
              placeholder="Nombre"
              :disabled="!!savingPlayerId"
            />
          </a-form-item>
          <a-form-item label="Apellido">
            <a-input
              v-model:value="playerForm.last_name"
              placeholder="Apellido"
              :disabled="!!savingPlayerId"
            />
          </a-form-item>
        </div>

        <a-form-item label="Tipo de jugador">
          <a-select
            v-model:value="playerForm.role"
            :disabled="!!savingPlayerId"
          >
            <a-select-option
              v-for="option in roleOptions"
              :key="option.value"
              :value="option.value"
            >
              {{ option.label }}
            </a-select-option>
          </a-select>
        </a-form-item>

        <a-alert
          v-if="playerFormError"
          type="error"
          :message="playerFormError"
          show-icon
          style="margin-bottom: 1rem"
        />

        <div class="player-form__footer">
          <a-button
            :disabled="!!savingPlayerId"
            @click="showPlayerModal = false; resetPlayerForm()"
          >
            Cancelar
          </a-button>
          <a-button
            type="primary"
            html-type="submit"
            :loading="!!savingPlayerId"
          >
            Guardar cambios
          </a-button>
        </div>
      </a-form>
    </a-modal>

    <a-modal
      :open="!!logoPreview"
      :title="logoPreview?.team"
      :footer="null"
      centered
      @cancel="logoPreview = null"
    >
      <div class="logo-preview">
        <img
          v-if="logoPreview"
          :src="logoPreview.url"
          :alt="logoPreview.team"
          class="logo-preview__img"
        />
      </div>
    </a-modal>
  </a-spin>
</template>

<style scoped lang="scss">
.teams-panel {
  max-width: 44rem;
}

.teams-panel__intro {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  margin-bottom: 1.25rem;

  p {
    margin: 0;
    font-size: 0.9rem;
    line-height: 1.45;
    color: rgba(232, 237, 245, 0.62);
  }
}

.teams-panel__list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.teams-panel__card {
  padding: 1rem 1.1rem 1.15rem;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.03);
}

.teams-panel__head {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.teams-panel__identity {
  display: flex;
  align-items: center;
  gap: 0.75rem;

  h3 {
    margin: 0;
    font-size: 1.15rem;
    font-weight: 600;
    color: #e8edf5;
  }

  p {
    margin: 0.15rem 0 0;
    font-size: 0.8rem;
    color: rgba(232, 237, 245, 0.5);
  }
}

.teams-panel__swatch {
  width: 1.35rem;
  height: 1.35rem;
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  flex-shrink: 0;

  &--sm {
    width: 1rem;
    height: 1rem;
  }
}

.teams-panel__logo-btn {
  margin-left: auto;
  padding: 0;
  border: none;
  background: none;
  cursor: zoom-in;
  line-height: 0;
  border-radius: 6px;

  &:focus-visible {
    outline: 2px solid #00b4d8;
    outline-offset: 2px;
  }
}

.teams-panel__logo-preview {
  width: 40px;
  height: 40px;
  object-fit: contain;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  transition: transform 0.15s ease;

  .teams-panel__logo-btn:hover & {
    transform: scale(1.08);
  }
}

.logo-preview {
  display: flex;
  justify-content: center;
  padding: 0.5rem 0;
}

.logo-preview__img {
  max-width: 100%;
  max-height: 60vh;
  object-fit: contain;
  border-radius: 8px;
}

.teams-panel__fields {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 0.65rem;
}

.teams-panel__field {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  font-size: 0.75rem;
  color: rgba(232, 237, 245, 0.55);

  &--grow {
    flex: 1;
    min-width: 12rem;
  }
}

.teams-panel__color {
  width: 3rem;
  height: 2rem;
  padding: 0;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 6px;
  background: transparent;
  cursor: pointer;
}

.teams-panel__readonly {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.teams-panel__muted {
  font-size: 0.8rem;
  color: rgba(232, 237, 245, 0.45);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.teams-panel__categories {
  margin-top: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.teams-panel__category {
  h4 {
    margin: 0 0 0.45rem;
    font-size: 0.78rem;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: rgba(0, 180, 216, 0.9);
  }
}

.teams-panel__players {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.teams-panel__player {
  display: grid;
  grid-template-columns: 3rem 1fr auto auto;
  gap: 0.5rem;
  align-items: center;
  padding: 0.4rem 0.55rem;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.03);
  font-size: 0.85rem;
}

.teams-panel__number {
  font-weight: 600;
  color: rgba(232, 237, 245, 0.75);
}

.teams-panel__name {
  color: #e8edf5;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.teams-panel__role {
  font-size: 0.72rem;
  color: rgba(232, 237, 245, 0.45);
}

.teams-panel__edit {
  padding: 0 0.25rem;
  height: auto;
  font-size: 0.78rem;
}

.teams-panel__empty-roster {
  margin: 0.85rem 0 0;
  font-size: 0.82rem;
  color: rgba(232, 237, 245, 0.42);
}

.player-form__grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0 0.75rem;

  @media (max-width: 520px) {
    grid-template-columns: 1fr;
  }
}

.player-form__footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 0.25rem;
}

@media (max-width: 560px) {
  .teams-panel__intro {
    flex-direction: column;
  }

  .teams-panel__player {
    grid-template-columns: 2.5rem 1fr auto;
    grid-template-areas:
      'num name edit'
      'role role role';
  }

  .teams-panel__number { grid-area: num; }
  .teams-panel__name { grid-area: name; }
  .teams-panel__role { grid-area: role; }
  .teams-panel__edit { grid-area: edit; }
}
</style>
