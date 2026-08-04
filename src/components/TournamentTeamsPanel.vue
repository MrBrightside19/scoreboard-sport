<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import type { Rule } from 'ant-design-vue/es/form'
import {
  createTournamentRosterPlayer,
  deleteTournamentRosterPlayer,
  fetchTournamentRosters,
  syncTournamentTeams,
  updateTournamentRosterPlayer,
  updateTournamentTeam,
} from '@/services/tournamentService'
import {
  joinPersonName,
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
const deletingPlayerId = ref<string | null>(null)
const showPlayerModal = ref(false)
const playerModalMode = ref<'create' | 'edit'>('edit')
const editingPlayerId = ref<string | null>(null)
const playerFormError = ref<string | null>(null)
const logoPreview = ref<{ url: string; team: string } | null>(null)
const drafts = reactive<Record<string, { color: string; logo_url: string }>>({})

const selectedTeamId = ref<string | null>(null)
const teamQuery = ref('')
const categoryFilter = ref('all')

const playerForm = reactive({
  number: '',
  name: '',
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

const filteredTeamViews = computed(() => {
  const q = teamQuery.value.trim().toLowerCase()
  if (!q) return teamViews.value
  return teamViews.value.filter((view) => view.team.team.toLowerCase().includes(q))
})

const selectedView = computed(
  () =>
    teamViews.value.find((view) => view.team.id === selectedTeamId.value) ??
    filteredTeamViews.value[0] ??
    null,
)

const categoryOptions = computed(() => {
  const view = selectedView.value
  if (!view) return [{ value: 'all', label: 'Todas' }]
  return [
    { value: 'all', label: `Todas (${view.playerCount})` },
    ...view.categories.map((group) => ({
      value: group.category,
      label: `${group.category} (${group.players.length})`,
    })),
  ]
})

const visiblePlayers = computed(() => {
  const view = selectedView.value
  if (!view) return [] as Array<TournamentRosterPlayer & { categoryLabel: string }>
  const groups =
    categoryFilter.value === 'all'
      ? view.categories
      : view.categories.filter((group) => group.category === categoryFilter.value)
  return groups.flatMap((group) =>
    group.players.map((player) => ({
      ...player,
      categoryLabel: group.category,
    })),
  )
})

const totals = computed(() => ({
  teams: teams.value.length,
  players: rosters.value.length,
}))

const playerModalTitle = computed(() =>
  playerModalMode.value === 'create' ? 'Agregar jugador' : 'Editar jugador',
)

const playerSubmitLabel = computed(() =>
  playerModalMode.value === 'create' ? 'Agregar' : 'Guardar cambios',
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

function selectTeam(teamId: string): void {
  selectedTeamId.value = teamId
  categoryFilter.value = 'all'
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
    if (
      !selectedTeamId.value ||
      !synced.some((team) => team.id === selectedTeamId.value)
    ) {
      selectedTeamId.value = synced[0]?.id ?? null
    }
    categoryFilter.value = 'all'
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

function playerDisplayName(player: TournamentRosterPlayer): string {
  return joinPersonName(player.name, player.last_name)
}

function openLogoPreview(view: { team: TournamentTeam }): void {
  const url = drafts[view.team.id]?.logo_url || view.team.logo_url
  if (!url) return
  logoPreview.value = { url, team: view.team.team }
}

function resetPlayerForm(): void {
  editingPlayerId.value = null
  playerModalMode.value = 'edit'
  playerForm.number = ''
  playerForm.name = ''
  playerForm.category =
    categoryFilter.value !== 'all' ? categoryFilter.value : ''
  playerForm.role = 'player'
  playerFormError.value = null
}

function openCreatePlayer(): void {
  if (!props.canEdit || !selectedView.value) return
  playerModalMode.value = 'create'
  editingPlayerId.value = null
  playerForm.number = ''
  playerForm.name = ''
  playerForm.category =
    categoryFilter.value !== 'all' && categoryFilter.value !== 'Sin categoría'
      ? categoryFilter.value
      : ''
  playerForm.role = 'player'
  playerFormError.value = null
  showPlayerModal.value = true
}

function openEditPlayer(player: TournamentRosterPlayer): void {
  if (!props.canEdit) return
  playerModalMode.value = 'edit'
  editingPlayerId.value = player.id
  playerForm.number = player.number
  playerForm.name = playerDisplayName(player)
  playerForm.category = player.category ?? ''
  playerForm.role = parseRoleFromText(player.position)
  playerFormError.value = null
  showPlayerModal.value = true
}

async function submitPlayer(): Promise<void> {
  if (!props.canEdit) return

  savingPlayerId.value = editingPlayerId.value ?? 'new'
  playerFormError.value = null
  try {
    const payload = {
      number: digitsOnly(playerForm.number),
      name: playerForm.name.trim(),
      category: playerForm.category.trim() || null,
      position: roleToPositionText(playerForm.role),
    }

    if (!payload.number || !payload.name) {
      throw new Error('Dorsal y nombre son obligatorios.')
    }

    if (playerModalMode.value === 'create') {
      const teamName = selectedView.value?.team.team
      if (!teamName) throw new Error('Selecciona un equipo.')
      const created = await createTournamentRosterPlayer(props.tournamentId, {
        team: teamName,
        ...payload,
      })
      rosters.value = [...rosters.value, created]
      if (created.category?.trim()) {
        categoryFilter.value = created.category.trim()
      }
      message.success('Jugador agregado.')
    } else {
      if (!editingPlayerId.value) return
      const updated = await updateTournamentRosterPlayer(
        editingPlayerId.value,
        payload,
      )
      rosters.value = rosters.value.map((item) =>
        item.id === updated.id ? updated : item,
      )
      message.success('Jugador actualizado.')
    }

    showPlayerModal.value = false
    resetPlayerForm()
  } catch (err) {
    playerFormError.value =
      err instanceof Error ? err.message : 'No se pudo guardar el jugador.'
  } finally {
    savingPlayerId.value = null
  }
}

async function removePlayer(player: TournamentRosterPlayer): Promise<void> {
  if (!props.canEdit || deletingPlayerId.value) return
  deletingPlayerId.value = player.id
  try {
    await deleteTournamentRosterPlayer(player.id)
    rosters.value = rosters.value.filter((item) => item.id !== player.id)
    message.success('Jugador eliminado.')
  } catch (err) {
    message.error(
      err instanceof Error ? err.message : 'No se pudo eliminar el jugador.',
    )
  } finally {
    deletingPlayerId.value = null
  }
}

watch(
  () => props.tournamentId,
  () => {
    selectedTeamId.value = null
    void loadTeams()
  },
)

watch(filteredTeamViews, (views) => {
  if (!views.length) return
  if (!views.some((view) => view.team.id === selectedTeamId.value)) {
    selectedTeamId.value = views[0]!.team.id
    categoryFilter.value = 'all'
  }
})

onMounted(() => {
  void loadTeams()
})

defineExpose({ reload: loadTeams })
</script>

<template>
  <a-spin :spinning="loading">
    <div class="teams-panel">
      <header class="teams-panel__intro">
        <div>
          <h2 class="teams-panel__title">Equipos</h2>
          <p>
            Color y logo para el marcador TV, y nómina por categoría.
            <template v-if="totals.teams">
              {{ totals.teams }} {{ totals.teams === 1 ? 'equipo' : 'equipos' }}
              · {{ totals.players }}
              {{ totals.players === 1 ? 'jugador' : 'jugadores' }}.
            </template>
          </p>
        </div>
        <a-button size="small" :loading="loading" @click="loadTeams">
          Actualizar
        </a-button>
      </header>

      <a-empty
        v-if="!loading && !teamViews.length"
        description="Aún no hay equipos. Agrega partidos o importa la plantilla."
      />

      <div v-else class="teams-panel__shell">
        <aside class="teams-panel__rail" aria-label="Lista de equipos">
          <a-input
            v-model:value="teamQuery"
            allow-clear
            placeholder="Buscar equipo…"
            class="teams-panel__search"
          />
          <div class="teams-panel__rail-list" role="listbox">
            <button
              v-for="view in filteredTeamViews"
              :key="view.team.id"
              type="button"
              role="option"
              class="teams-panel__rail-item"
              :class="{ 'teams-panel__rail-item--active': selectedView?.team.id === view.team.id }"
              :aria-selected="selectedView?.team.id === view.team.id"
              @click="selectTeam(view.team.id)"
            >
              <span
                class="teams-panel__swatch"
                :style="{ background: drafts[view.team.id]?.color || view.team.color }"
              />
              <span class="teams-panel__rail-name">{{ view.team.team }}</span>
              <span class="teams-panel__rail-count">{{ view.playerCount }}</span>
            </button>
            <p v-if="!filteredTeamViews.length" class="teams-panel__rail-empty">
              Sin coincidencias
            </p>
          </div>
        </aside>

        <section v-if="selectedView" class="teams-panel__detail">
          <div class="teams-panel__detail-head">
            <div class="teams-panel__identity">
              <button
                v-if="drafts[selectedView.team.id]?.logo_url || selectedView.team.logo_url"
                type="button"
                class="teams-panel__logo-btn"
                :aria-label="`Ver logo de ${selectedView.team.team}`"
                @click="openLogoPreview(selectedView)"
              >
                <img
                  :src="drafts[selectedView.team.id]?.logo_url || selectedView.team.logo_url"
                  :alt="selectedView.team.team"
                  class="teams-panel__logo-preview"
                />
              </button>
              <span
                v-else
                class="teams-panel__swatch teams-panel__swatch--lg"
                :style="{ background: drafts[selectedView.team.id]?.color || selectedView.team.color }"
              />
              <div class="teams-panel__identity-text">
                <h3>{{ selectedView.team.team }}</h3>
                <p>
                  {{ selectedView.playerCount }}
                  {{ selectedView.playerCount === 1 ? 'jugador' : 'jugadores' }}
                  · {{ selectedView.categories.length }}
                  {{ selectedView.categories.length === 1 ? 'categoría' : 'categorías' }}
                </p>
              </div>
            </div>

            <div
              v-if="canEdit && drafts[selectedView.team.id]"
              class="teams-panel__fields"
            >
              <label class="teams-panel__field">
                <span>Color</span>
                <input
                  v-model="drafts[selectedView.team.id]!.color"
                  type="color"
                  class="teams-panel__color"
                />
              </label>
              <label class="teams-panel__field teams-panel__field--grow">
                <span>Logo (URL)</span>
                <a-input
                  v-model:value="drafts[selectedView.team.id]!.logo_url"
                  placeholder="https://…"
                  allow-clear
                  size="small"
                />
              </label>
              <a-button
                type="primary"
                size="small"
                :loading="savingId === selectedView.team.id"
                @click="saveTeam(selectedView.team)"
              >
                Guardar
              </a-button>
            </div>
          </div>

          <div class="teams-panel__filters">
            <a-segmented
              v-if="categoryOptions.length > 1"
              v-model:value="categoryFilter"
              :options="categoryOptions"
              size="small"
            />
            <span v-else class="teams-panel__muted">Sin categorías</span>
            <a-button
              v-if="canEdit"
              type="primary"
              size="small"
              class="teams-panel__add"
              @click="openCreatePlayer"
            >
              + Agregar jugador
            </a-button>
          </div>

          <div v-if="visiblePlayers.length" class="teams-panel__table-wrap">
            <table class="teams-panel__table">
              <thead>
                <tr>
                  <th class="teams-panel__col-num">#</th>
                  <th>Jugador</th>
                  <th class="teams-panel__col-cat">Categoría</th>
                  <th class="teams-panel__col-role">Rol</th>
                  <th v-if="canEdit" class="teams-panel__col-action" />
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="player in visiblePlayers"
                  :key="player.id"
                  class="teams-panel__row"
                  :class="{ 'teams-panel__row--editable': canEdit }"
                  @click="canEdit ? openEditPlayer(player) : undefined"
                >
                  <td class="teams-panel__col-num">{{ player.number }}</td>
                  <td class="teams-panel__col-name">{{ playerDisplayName(player) }}</td>
                  <td class="teams-panel__col-cat">{{ player.categoryLabel }}</td>
                  <td class="teams-panel__col-role">{{ playerRole(player) }}</td>
                  <td v-if="canEdit" class="teams-panel__col-action">
                    <div class="teams-panel__row-actions" @click.stop>
                      <a-button
                        type="text"
                        size="small"
                        class="teams-panel__icon-btn"
                        aria-label="Editar jugador"
                        title="Editar"
                        @click="openEditPlayer(player)"
                      >
                        <span class="teams-panel__icon" aria-hidden="true">
                          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M12 20h9" />
                            <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                          </svg>
                        </span>
                      </a-button>
                      <a-popconfirm
                        title="¿Eliminar este jugador de la nómina del torneo?"
                        ok-text="Eliminar"
                        cancel-text="Cancelar"
                        ok-type="danger"
                        :disabled="deletingPlayerId === player.id"
                        @confirm="removePlayer(player)"
                      >
                        <a-button
                          type="text"
                          size="small"
                          danger
                          class="teams-panel__icon-btn"
                          aria-label="Eliminar jugador"
                          title="Eliminar"
                          :loading="deletingPlayerId === player.id"
                        >
                          <span class="teams-panel__icon" aria-hidden="true">
                            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                              <path d="M3 6h18" />
                              <path d="M8 6V4h8v2" />
                              <path d="M19 6l-1 14H6L5 6" />
                              <path d="M10 11v6" />
                              <path d="M14 11v6" />
                            </svg>
                          </span>
                        </a-button>
                      </a-popconfirm>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-else class="teams-panel__empty-roster">
            <p>
              Sin jugadores
              {{ categoryFilter === 'all' ? 'importados' : 'en esta categoría' }}
              para este equipo.
            </p>
            <a-button
              v-if="canEdit"
              type="primary"
              size="small"
              @click="openCreatePlayer"
            >
              + Agregar jugador
            </a-button>
          </div>
        </section>
      </div>
    </div>

    <a-modal
      v-model:open="showPlayerModal"
      :title="playerModalTitle"
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

        <a-form-item label="Nombre" name="name">
          <a-input
            v-model:value="playerForm.name"
            placeholder="Nombre y apellido"
            :disabled="!!savingPlayerId"
          />
        </a-form-item>

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
            {{ playerSubmitLabel }}
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
  width: 100%;
  max-width: none;
}

.teams-panel__intro {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  margin-bottom: 1rem;
}

.teams-panel__title {
  margin: 0 0 0.25rem;
  font-size: 1.15rem;
  font-weight: 650;
  color: var(--app-text);
}

.teams-panel__intro p {
  margin: 0;
  font-size: 0.88rem;
  line-height: 1.45;
  color: var(--app-text-muted);
}

.teams-panel__shell {
  display: grid;
  grid-template-columns: minmax(13rem, 17rem) minmax(0, 1fr);
  gap: 0;
  min-height: 28rem;
  border: 1px solid var(--app-border);
  border-radius: 12px;
  overflow: hidden;
  background: var(--app-bg-elevated);
}

.teams-panel__rail {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  padding: 0.85rem 0.75rem;
  border-right: 1px solid var(--app-border);
  background: color-mix(in srgb, var(--app-bg-elevated) 92%, var(--app-text) 8%);
  min-height: 0;
}

.teams-panel__search {
  flex-shrink: 0;
}

.teams-panel__rail-list {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  overflow-y: auto;
  min-height: 0;
  flex: 1;
  padding-right: 0.15rem;
}

.teams-panel__rail-item {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.55rem;
  width: 100%;
  padding: 0.55rem 0.6rem;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: var(--app-text);
  text-align: left;
  cursor: pointer;
  transition:
    background 0.15s ease,
    border-color 0.15s ease;

  &:hover {
    background: var(--app-surface-strong);
  }

  &--active {
    background: var(--app-surface-strong);
    border-color: var(--app-border-strong);
  }
}

.teams-panel__rail-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.88rem;
  font-weight: 550;
}

.teams-panel__rail-count {
  font-size: 0.72rem;
  font-variant-numeric: tabular-nums;
  color: var(--app-text-muted);
  background: var(--app-surface-inset);
  border-radius: 999px;
  padding: 0.1rem 0.45rem;
}

.teams-panel__rail-empty {
  margin: 0.75rem 0.35rem;
  font-size: 0.8rem;
  color: var(--app-text-muted);
}

.teams-panel__detail {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  padding: 1rem 1.1rem 1.15rem;
  min-width: 0;
  min-height: 0;
}

.teams-panel__detail-head {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  padding-bottom: 0.85rem;
  border-bottom: 1px solid var(--app-border);
}

.teams-panel__identity {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-width: 0;
}

.teams-panel__identity-text {
  min-width: 0;

  h3 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 650;
    color: var(--app-text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  p {
    margin: 0.15rem 0 0;
    font-size: 0.8rem;
    color: var(--app-text-muted);
  }
}

.teams-panel__swatch {
  width: 0.85rem;
  height: 0.85rem;
  border-radius: 3px;
  border: 1px solid var(--app-border-strong);
  flex-shrink: 0;

  &--lg {
    width: 2.5rem;
    height: 2.5rem;
    border-radius: 8px;
  }
}

.teams-panel__logo-btn {
  padding: 0;
  border: none;
  background: none;
  cursor: zoom-in;
  line-height: 0;
  border-radius: 8px;
  flex-shrink: 0;

  &:focus-visible {
    outline: 2px solid var(--app-primary);
    outline-offset: 2px;
  }
}

.teams-panel__logo-preview {
  width: 2.5rem;
  height: 2.5rem;
  object-fit: contain;
  border-radius: 8px;
  background: var(--app-surface-strong);
  border: 1px solid var(--app-border);
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
  gap: 0.55rem;
}

.teams-panel__field {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.72rem;
  color: var(--app-text-muted);

  &--grow {
    flex: 1;
    min-width: 10rem;
  }
}

.teams-panel__color {
  width: 2.75rem;
  height: 1.85rem;
  padding: 0;
  border: 1px solid var(--app-border-strong);
  border-radius: 6px;
  background: transparent;
  cursor: pointer;
}

.teams-panel__filters {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;

  :deep(.ant-segmented) {
    max-width: 100%;
    overflow-x: auto;
  }
}

.teams-panel__add {
  margin-left: auto;
}

.teams-panel__muted {
  font-size: 0.8rem;
  color: var(--app-text-muted);
}

.teams-panel__table-wrap {
  overflow: auto;
  border: 1px solid var(--app-border);
  border-radius: 10px;
  min-height: 0;
  flex: 1;
}

.teams-panel__table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;

  th,
  td {
    padding: 0.55rem 0.7rem;
    text-align: left;
    border-bottom: 1px solid var(--app-border);
    font-size: 0.85rem;
  }

  th {
    position: sticky;
    top: 0;
    z-index: 1;
    background: var(--app-bg-elevated);
    color: var(--app-text-muted);
    font-size: 0.72rem;
    font-weight: 650;
    letter-spacing: 0.03em;
    text-transform: uppercase;
  }

  tbody tr:last-child td {
    border-bottom: none;
  }
}

.teams-panel__row {
  &--editable {
    cursor: pointer;

    &:hover td {
      background: var(--app-surface-strong);
    }
  }
}

.teams-panel__col-num {
  width: 3.25rem;
  font-variant-numeric: tabular-nums;
  font-weight: 650;
  color: var(--app-text-soft);
}

.teams-panel__col-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--app-text);
}

.teams-panel__col-cat {
  width: 8.5rem;
  color: var(--app-text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.teams-panel__col-role {
  width: 8rem;
  color: var(--app-text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.teams-panel__col-action {
  width: 5.5rem;
  text-align: right;
}

.teams-panel__row-actions {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.1rem;
}

.teams-panel__icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.85rem;
  height: 1.85rem;
  padding: 0;
}

.teams-panel__icon {
  display: inline-flex;
  line-height: 0;
}

.teams-panel__empty-roster {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.75rem;
  margin: 0.5rem 0 0;

  p {
    margin: 0;
    font-size: 0.85rem;
    color: var(--app-text-muted);
  }
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

@media (max-width: 860px) {
  .teams-panel__shell {
    grid-template-columns: 1fr;
    min-height: 0;
  }

  .teams-panel__rail {
    border-right: none;
    border-bottom: 1px solid var(--app-border);
    max-height: 14rem;
  }

  .teams-panel__col-cat {
    width: 6.5rem;
  }

  .teams-panel__col-role {
    width: 6.5rem;
  }
}

@media (max-width: 560px) {
  .teams-panel__intro {
    flex-direction: column;
  }

  .teams-panel__table {
    th.teams-panel__col-cat,
    td.teams-panel__col-cat {
      display: none;
    }
  }
}
</style>
