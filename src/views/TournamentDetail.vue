<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Modal, message } from 'ant-design-vue'
import type { Rule } from 'ant-design-vue/es/form'
import { useAuthStore } from '@/stores/auth'
import {
  clearTournamentCalendar,
  createTournamentMatch,
  deleteTournament,
  deleteTournamentMatch,
  fetchTournament,
  fetchTournamentMatches,
  finishTournament as finishTournamentService,
  importTournamentCsv,
  startTournamentMatch,
  syncTournamentTeams,
  updateTournamentMatch,
} from '@/services/tournamentService'
import {
  buildTournamentTemplateWorkbook,
  parseTournamentImportFile,
} from '@/utils/tournamentImport'
import { normalizeGameTime } from '@/utils/clock'
import { buildAppUrl, tournamentOverlayPath } from '@/utils/appUrl'
import { calculateStandings } from '@/utils/standings'
import { writeMatchIdToStorage } from '@/utils/localSync'
import {
  assignTournamentAssistant,
  canAccessTournament,
  fetchTournamentAssistants,
  removeTournamentAssistant,
} from '@/services/tournamentAssistantService'
import { getTournamentTableRefreshMs } from '@/config/poll'
import type {
  CsvMatchRow,
  CsvPlayerRow,
  Tournament,
  TournamentAssistant,
  TournamentMatch,
} from '@/types/tournament'
import { MAX_TOURNAMENT_ASSISTANTS } from '@/types/tournament'
import TournamentStandings from '@/components/TournamentStandings.vue'
import TournamentTeamsPanel from '@/components/TournamentTeamsPanel.vue'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const tournament = ref<Tournament | null>(null)
const assistants = ref<TournamentAssistant[]>([])
const matches = ref<TournamentMatch[]>([])
const loading = ref(true)
const refreshing = ref(false)
const importing = ref(false)
const clearing = ref(false)
const deleting = ref(false)
const copiedCourt = ref<string | null>(null)
const assistantEmail = ref('')
const assigningAssistant = ref(false)
const removingAssistantId = ref<string | null>(null)
const activeTab = ref('partidos')
const showMatchModal = ref(false)
const creatingMatch = ref(false)
const matchFormError = ref<string | null>(null)
const editingMatchId = ref<string | null>(null)
const deletingMatchId = ref<string | null>(null)

const matchForm = reactive({
  local_team: '',
  visit_team: '',
  category: '',
  court: '',
  game_time: '20:00',
  scheduled_at: '',
})

const matchFormRules: Record<string, Rule[]> = {
  local_team: [{ required: true, message: 'Ingresa el equipo local' }],
  visit_team: [{ required: true, message: 'Ingresa el equipo visita' }],
  court: [{ required: true, message: 'Ingresa la cancha' }],
  game_time: [{ required: true, message: 'Ingresa el tiempo de juego' }],
}

const matchModalTitle = computed(() =>
  editingMatchId.value ? 'Editar partido' : 'Agregar partido',
)

const matchSubmitLabel = computed(() =>
  editingMatchId.value ? 'Guardar cambios' : 'Guardar partido',
)

let pollTimer: number | null = null

const isOwner = computed(
  () => tournament.value?.organizer_id === auth.profile?.id,
)

const canEditMatches = computed(
  () => tournament.value?.status !== 'finished',
)

const canAddAssistant = computed(
  () => assistants.value.length < MAX_TOURNAMENT_ASSISTANTS,
)

const streamCourts = computed(() =>
  [...new Set(matches.value.map((m) => m.court))].sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true }),
  ),
)

const standings = computed(() =>
  calculateStandings(
    matches.value
      .filter((m) => m.status === 'finished')
      .map((m) => ({
        local: m.local_team,
        visit: m.visit_team,
        goalLocal: m.goal_local ?? 0,
        goalVisit: m.goal_visit ?? 0,
      })),
  ),
)

async function load(options: { silent?: boolean } = {}): Promise<void> {
  const id = route.params.id as string
  if (options.silent) {
    refreshing.value = true
  } else {
    loading.value = true
  }
  try {
    tournament.value = await fetchTournament(id)
    if (!tournament.value) {
      await router.replace({ name: 'tournaments' })
      return
    }

    if (auth.profile) {
      const allowed = await canAccessTournament(
        id,
        auth.profile.id,
        tournament.value.organizer_id,
      )
      if (!allowed) {
        message.error('No tienes acceso a este torneo.')
        await router.replace({ name: 'tournaments' })
        return
      }
    }

    assistants.value = await fetchTournamentAssistants(id)
    matches.value = await fetchTournamentMatches(id)
  } finally {
    loading.value = false
    refreshing.value = false
  }
}

async function refresh(): Promise<void> {
  if (!matches.value.length) return
  await load({ silent: true })
}

function onVisibilityChange(): void {
  if (document.visibilityState === 'visible' && matches.value.length > 0) {
    void refresh()
  }
}

function toDatetimeLocal(iso: string | null): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function statusLabel(status: TournamentMatch['status']): string {
  const labels: Record<TournamentMatch['status'], string> = {
    scheduled: 'Programado',
    live: 'En vivo',
    finished: 'Finalizado',
  }
  return labels[status]
}

function statusColor(status: TournamentMatch['status']): string {
  if (status === 'live') return 'green'
  if (status === 'finished') return 'default'
  return 'blue'
}

function openControls(tm: TournamentMatch): void {
  if (!tm.match_id) return
  if (tournament.value?.status === 'finished') {
    message.warning('El torneo está finalizado. No se pueden abrir los controles.')
    return
  }
  writeMatchIdToStorage(tm.match_id)
  window.open(
    router.resolve({
      name: 'controls',
      query: {
        matchId: tm.match_id,
        local: tm.local_team,
        visit: tm.visit_team,
        time: normalizeGameTime(tm.game_time),
        tournamentId: tm.tournament_id,
      },
    }).href,
    '_blank',
    'noopener',
  )
}

function downloadTemplate(): void {
  const buffer = buildTournamentTemplateWorkbook()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'plantilla-torneo.xlsx'
  a.click()
  URL.revokeObjectURL(url)
}

async function importCalendarRows(
  matchRows: CsvMatchRow[],
  players: CsvPlayerRow[] = [],
): Promise<void> {
  if (!tournament.value) return

  const replaced = matches.value.length > 0
  importing.value = true
  try {
    if (replaced) {
      await clearTournamentCalendar(tournament.value.id)
    }
    await importTournamentCsv(tournament.value.id, matchRows, players)
    await syncTournamentTeams(tournament.value.id)
    await load()

    const count = matchRows.length
    const partidos = count === 1 ? 'partido' : 'partidos'
    const playerCount = players.length
    const jugadores =
      playerCount > 0
        ? ` · ${playerCount} ${playerCount === 1 ? 'jugador' : 'jugadores'}`
        : ''
    message.success(
      replaced
        ? `Calendario reemplazado: ${count} ${partidos} importados${jugadores}.`
        : `Calendario importado: ${count} ${partidos} cargados${jugadores}.`,
    )
  } catch (err) {
    Modal.error({
      title: 'Error al importar calendario',
      content: err instanceof Error ? err.message : 'No se pudo importar el archivo.',
    })
  } finally {
    importing.value = false
  }
}

async function onCsvUpload(file: File): Promise<void> {
  if (!tournament.value) return

  let payload: Awaited<ReturnType<typeof parseTournamentImportFile>>
  try {
    payload = await parseTournamentImportFile(file)
  } catch (err) {
    Modal.error({
      title: 'Archivo inválido',
      content: err instanceof Error ? err.message : 'No se pudo leer el archivo.',
    })
    return
  }

  if (matches.value.length > 0) {
    Modal.confirm({
      title: '¿Reemplazar el calendario?',
      content:
        'Ya tienes un calendario importado. Si continúas, se eliminarán todos los partidos, plantillas de jugadores, resultados y datos del torneo, y se cargará el nuevo archivo. Esta acción no se puede deshacer.',
      okText: 'Reemplazar calendario',
      cancelText: 'Cancelar',
      okType: 'danger',
      onOk: () => importCalendarRows(payload.matches, payload.players),
    })
    return
  }

  await importCalendarRows(payload.matches, payload.players)
}

function resetMatchForm(): void {
  editingMatchId.value = null
  matchForm.local_team = ''
  matchForm.visit_team = ''
  matchForm.category = ''
  matchForm.court = ''
  matchForm.game_time = '20:00'
  matchForm.scheduled_at = ''
  matchFormError.value = null
}

function openMatchModal(): void {
  if (!canEditMatches.value) {
    message.warning('El torneo está finalizado. No se pueden agregar partidos.')
    return
  }
  resetMatchForm()
  showMatchModal.value = true
}

function openEditMatchModal(tm: TournamentMatch): void {
  if (!canEditMatches.value) {
    message.warning('El torneo está finalizado. No se pueden editar partidos.')
    return
  }
  if (tm.status === 'live') {
    message.warning('No se puede editar un partido en vivo.')
    return
  }
  editingMatchId.value = tm.id
  matchForm.local_team = tm.local_team
  matchForm.visit_team = tm.visit_team
  matchForm.category = tm.category ?? ''
  matchForm.court = tm.court
  matchForm.game_time = normalizeGameTime(tm.game_time)
  matchForm.scheduled_at = toDatetimeLocal(tm.scheduled_at)
  matchFormError.value = null
  showMatchModal.value = true
}

function goToImport(): void {
  activeTab.value = 'configuracion'
}

async function submitMatch(): Promise<void> {
  if (!tournament.value) return
  if (!canEditMatches.value) {
    matchFormError.value = 'El torneo está finalizado. No se pueden modificar partidos.'
    return
  }

  creatingMatch.value = true
  matchFormError.value = null
  try {
    const payload = {
      local_team: matchForm.local_team,
      visit_team: matchForm.visit_team,
      court: matchForm.court,
      game_time: matchForm.game_time,
      category: matchForm.category,
      scheduled_at: matchForm.scheduled_at || null,
    }

    if (editingMatchId.value) {
      await updateTournamentMatch(editingMatchId.value, payload)
      await syncTournamentTeams(tournament.value.id)
      message.success('Partido actualizado.')
    } else {
      await createTournamentMatch(tournament.value.id, payload)
      await syncTournamentTeams(tournament.value.id)
      message.success('Partido agregado al calendario.')
    }

    showMatchModal.value = false
    resetMatchForm()
    await load({ silent: true })
  } catch (err) {
    matchFormError.value =
      err instanceof Error ? err.message : 'No se pudo guardar el partido.'
  } finally {
    creatingMatch.value = false
  }
}

function confirmDeleteMatch(tm: TournamentMatch): void {
  if (!canEditMatches.value) {
    message.warning('El torneo está finalizado. No se pueden eliminar partidos.')
    return
  }
  if (tm.status === 'live') {
    message.warning('No se puede eliminar un partido en vivo. Finalízalo primero.')
    return
  }

  Modal.confirm({
    title: '¿Eliminar este partido?',
    content: `Se eliminará ${tm.local_team} vs ${tm.visit_team} del calendario.`,
    okText: 'Eliminar',
    okType: 'danger',
    cancelText: 'Cancelar',
    async onOk() {
      deletingMatchId.value = tm.id
      try {
        await deleteTournamentMatch(tm)
        message.success('Partido eliminado.')
        await load({ silent: true })
      } catch (err) {
        Modal.error({
          title: 'No se pudo eliminar el partido',
          content: err instanceof Error ? err.message : 'Error desconocido',
        })
        throw err
      } finally {
        deletingMatchId.value = null
      }
    },
  })
}

async function clearTournamentData(): Promise<void> {
  if (!tournament.value) return

  Modal.confirm({
    title: '¿Eliminar la información del torneo?',
    content:
      'Se eliminarán todos los partidos, plantillas de jugadores, resultados y enlaces de cancha. El torneo volverá a estado borrador. Esta acción no se puede deshacer.',
    okText: 'Eliminar información',
    okType: 'danger',
    cancelText: 'Cancelar',
    async onOk() {
      if (!tournament.value) return
      clearing.value = true
      try {
        await clearTournamentCalendar(tournament.value.id)
        message.success('Información del torneo eliminada.')
        await load()
      } catch (err) {
        Modal.error({
          title: 'No se pudo eliminar',
          content: err instanceof Error ? err.message : 'Error desconocido',
        })
        throw err
      } finally {
        clearing.value = false
      }
    },
  })
}

async function removeTournamentCompletely(): Promise<void> {
  if (!tournament.value || !isOwner.value) return

  const name = tournament.value.name
  Modal.confirm({
    title: '¿Eliminar el torneo por completo?',
    content:
      `Se eliminará permanentemente «${name}» junto con partidos, plantillas, asistentes y resultados. Esta acción no se puede deshacer.`,
    okText: 'Eliminar torneo',
    okType: 'danger',
    cancelText: 'Cancelar',
    async onOk() {
      if (!tournament.value) return
      deleting.value = true
      try {
        await deleteTournament(tournament.value.id)
        message.success('Torneo eliminado.')
        await router.replace({ name: 'tournaments' })
      } catch (err) {
        Modal.error({
          title: 'No se pudo eliminar el torneo',
          content: err instanceof Error ? err.message : 'Error desconocido',
        })
        throw err
      } finally {
        deleting.value = false
      }
    },
  })
}

async function startMatch(tm: TournamentMatch): Promise<void> {
  if (!auth.profile) return
  if (tournament.value?.status === 'finished') {
    message.warning('El torneo está finalizado. No se pueden iniciar partidos.')
    return
  }
  try {
    const matchId = await startTournamentMatch(tm, auth.profile.id)
    openControls({ ...tm, match_id: matchId })
    await load()
  } catch (err) {
    Modal.error({
      title: 'No se pudo iniciar el partido',
      content: err instanceof Error ? err.message : 'Error desconocido',
    })
  }
}

async function finishTournament(): Promise<void> {
  if (!tournament.value) return

  Modal.confirm({
    title: '¿Finalizar torneo?',
    content:
      'Los partidos sin jugar quedarán 0-0 y no se podrán abrir controles ni iniciar partidos.',
    okText: 'Finalizar',
    okType: 'danger',
    cancelText: 'Cancelar',
    async onOk() {
      if (!tournament.value) return
      await finishTournamentService(tournament.value.id)
      message.success('Torneo finalizado.')
      await load()
    },
  })
}

function copyOverlayForCourt(court: string): void {
  if (!tournament.value) return
  const url = buildAppUrl(tournamentOverlayPath(tournament.value.id, court))
  void navigator.clipboard.writeText(url)
  copiedCourt.value = court
  setTimeout(() => { copiedCourt.value = null }, 2000)
}

async function submitAssistant(): Promise<void> {
  if (!tournament.value || !auth.profile || !isOwner.value) return

  assigningAssistant.value = true
  try {
    const created = await assignTournamentAssistant(
      tournament.value.id,
      assistantEmail.value,
      auth.profile.id,
      tournament.value.organizer_id,
    )
    assistants.value = [...assistants.value, created].sort(
      (a, b) => a.created_at.localeCompare(b.created_at),
    )
    assistantEmail.value = ''
    message.success(`Asistente asignado: ${created.email}`)
    if (auth.profile?.id === created.user_id) {
      await auth.loadProfile()
    }
  } catch (err) {
    Modal.error({
      title: 'No se pudo asignar asistente',
      content: err instanceof Error ? err.message : 'Error desconocido',
    })
  } finally {
    assigningAssistant.value = false
  }
}

async function removeAssistant(userId: string): Promise<void> {
  if (!tournament.value || !isOwner.value) return

  removingAssistantId.value = userId
  try {
    await removeTournamentAssistant(tournament.value.id, userId)
    assistants.value = assistants.value.filter((assistant) => assistant.user_id !== userId)
    message.success('Asistente removido del torneo.')
    if (auth.profile?.id === userId) {
      await auth.loadProfile()
      await router.replace({ name: 'tournaments' })
    }
  } catch (err) {
    Modal.error({
      title: 'No se pudo quitar al asistente',
      content: err instanceof Error ? err.message : 'Error desconocido',
    })
  } finally {
    removingAssistantId.value = null
  }
}

onMounted(() => {
  void load()
  pollTimer = window.setInterval(() => void refresh(), getTournamentTableRefreshMs())
  document.addEventListener('visibilitychange', onVisibilityChange)
})

onUnmounted(() => {
  if (pollTimer) clearInterval(pollTimer)
  document.removeEventListener('visibilitychange', onVisibilityChange)
})
</script>

<template>
  <div class="detail">
    <a-spin :spinning="loading">
      <header v-if="tournament" class="detail__header">
        <div>
          <router-link to="/tournaments">← Torneos</router-link>
          <h1>{{ tournament.name }}</h1>
        </div>
      </header>

      <a-tabs v-if="tournament" v-model:active-key="activeTab" class="detail__tabs">
        <a-tab-pane key="partidos" tab="Partidos">
          <section class="detail__section">
            <div class="detail__section-header">
              <h2>Calendario</h2>
              <div class="detail__section-actions">
                <span v-if="refreshing" class="detail__refreshing">Actualizando…</span>
                <a-button
                  v-if="matches.length"
                  size="small"
                  :loading="refreshing"
                  @click="refresh"
                >
                  Actualizar
                </a-button>
                <a-button
                  v-if="canEditMatches"
                  type="primary"
                  size="small"
                  @click="openMatchModal"
                >
                  Agregar partido
                </a-button>
              </div>
            </div>

            <div v-if="matches.length" class="detail__table-wrap">
              <a-table
                :data-source="matches.map((m) => ({ ...m, key: m.id }))"
                :pagination="false"
                size="small"
                :scroll="{ x: 880 }"
                table-layout="fixed"
                :row-class-name="(record: TournamentMatch) =>
                  record.status === 'live' ? 'detail__row--live' : ''"
              >
                <a-table-column title="Local" data-index="local_team" :ellipsis="true" :width="140" />
                <a-table-column title="Visita" data-index="visit_team" :ellipsis="true" :width="140" />
                <a-table-column title="Categoría" :width="100" :ellipsis="true">
                  <template #default="{ record }">
                    {{ record.category || '—' }}
                  </template>
                </a-table-column>
                <a-table-column title="Cancha" data-index="court" :width="80" :ellipsis="true" />
                <a-table-column title="Tiempo" :width="72">
                  <template #default="{ record }">
                    {{ normalizeGameTime(record.game_time) }}
                  </template>
                </a-table-column>
                <a-table-column title="Estado" :width="110">
                  <template #default="{ record }">
                    <a-tag :color="statusColor(record.status)">
                      {{ statusLabel(record.status) }}
                    </a-tag>
                  </template>
                </a-table-column>
                <a-table-column title="Resultado" :width="90">
                  <template #default="{ record }">
                    <span v-if="record.status === 'finished'">
                      {{ record.goal_local }} - {{ record.goal_visit }}
                    </span>
                    <span v-else>—</span>
                  </template>
                </a-table-column>
                <a-table-column title="Acciones" :width="150" fixed="right">
                  <template #default="{ record }">
                    <div class="detail__match-actions">
                      <a-button
                        v-if="record.status === 'scheduled' && tournament.status !== 'finished'"
                        type="primary"
                        size="small"
                        @click="startMatch(record)"
                      >
                        Iniciar
                      </a-button>
                      <a-button
                        v-if="
                          record.status === 'live'
                            && record.match_id
                            && tournament.status !== 'finished'
                        "
                        type="primary"
                        size="small"
                        @click="openControls(record)"
                      >
                        Controles
                      </a-button>
                      <a-dropdown
                        v-if="canEditMatches && record.status !== 'live'"
                        :trigger="['click']"
                        placement="bottomRight"
                      >
                        <a-button
                          size="small"
                          class="detail__more-btn"
                          :loading="deletingMatchId === record.id"
                          aria-label="Más acciones"
                        >
                          ⋯
                        </a-button>
                        <template #overlay>
                          <a-menu>
                            <a-menu-item
                              key="edit"
                              @click="openEditMatchModal(record)"
                            >
                              Editar
                            </a-menu-item>
                            <a-menu-item
                              key="delete"
                              danger
                              @click="confirmDeleteMatch(record)"
                            >
                              Eliminar
                            </a-menu-item>
                          </a-menu>
                        </template>
                      </a-dropdown>
                    </div>
                  </template>
                </a-table-column>
              </a-table>
            </div>

            <div v-else class="detail__empty">
              <a-empty description="Aún no hay partidos en este torneo">
                <div v-if="canEditMatches" class="detail__empty-actions">
                  <a-button type="primary" @click="openMatchModal">
                    Crear primer partido
                  </a-button>
                  <a-button @click="goToImport">Importar Excel</a-button>
                </div>
              </a-empty>
            </div>
          </section>
        </a-tab-pane>

        <a-tab-pane key="posiciones" tab="Tabla de Posiciones">
          <section class="detail__section">
            <h2>Tabla de posiciones</h2>
            <TournamentStandings :standings="standings" />
          </section>
        </a-tab-pane>

        <a-tab-pane key="equipos" tab="Equipos">
          <TournamentTeamsPanel
            :tournament-id="tournament.id"
            :can-edit="canEditMatches"
          />
        </a-tab-pane>

        <a-tab-pane key="configuracion" tab="Configuración">
          <div class="config">
            <header class="config__intro">
              <p>
                Configura los datos, el equipo de trabajo y la transmisión del torneo.
                Las acciones destructivas están al final.
              </p>
            </header>

            <section class="config__panel" aria-labelledby="config-datos">
              <div class="config__panel-head">
                <div>
                  <h2 id="config-datos">Calendario y plantillas</h2>
                  <p class="config__desc">
                    Descarga la plantilla Excel, complétala e impórtala para cargar partidos y jugadores.
                  </p>
                </div>
                <div class="config__actions">
                  <a-button @click="downloadTemplate">Descargar plantilla</a-button>
                  <a-upload
                    :show-upload-list="false"
                    accept=".xlsx,.xls,.csv"
                    :before-upload="(f: File) => { onCsvUpload(f); return false }"
                  >
                    <a-button type="primary" :loading="importing">
                      Importar Excel
                    </a-button>
                  </a-upload>
                </div>
              </div>
              <ul class="config__notes">
                <li>
                  Hojas: <strong>Calendario</strong> (partidos) y <strong>Jugadores</strong>
                  (equipo, categoría, número, nombre, apellido, posición).
                </li>
                <li>
                  Posición = tipo de jugador (jugador, arquero, capitán o Asistente Capitán).
                </li>
                <li>
                  Al iniciar un partido, el roster se filtra por equipo y categoría.
                </li>
              </ul>
            </section>

            <section
              v-if="isOwner"
              class="config__panel"
              aria-labelledby="config-asistentes"
            >
              <div class="config__panel-head">
                <div>
                  <h2 id="config-asistentes">Asistentes</h2>
                  <p class="config__desc">
                    Hasta {{ MAX_TOURNAMENT_ASSISTANTS }} personas pueden operar calendario y controles
                    ({{ assistants.length }}/{{ MAX_TOURNAMENT_ASSISTANTS }}).
                  </p>
                </div>
              </div>

              <div v-if="assistants.length" class="config__list">
                <div
                  v-for="item in assistants"
                  :key="item.user_id"
                  class="config__row"
                >
                  <div class="config__row-main">
                    <strong>{{ item.email }}</strong>
                    <span class="config__badge">Asistente</span>
                  </div>
                  <a-popconfirm
                    title="¿Quitar a esta persona como asistente?"
                    ok-text="Sí, quitar"
                    cancel-text="Cancelar"
                    @confirm="removeAssistant(item.user_id)"
                  >
                    <a-button
                      danger
                      size="small"
                      :loading="removingAssistantId === item.user_id"
                    >
                      Quitar
                    </a-button>
                  </a-popconfirm>
                </div>
              </div>
              <p v-else class="config__empty">Aún no hay asistentes asignados.</p>

              <div v-if="canAddAssistant" class="config__form">
                <a-input
                  v-model:value="assistantEmail"
                  type="email"
                  placeholder="correo@ejemplo.com"
                  :disabled="assigningAssistant"
                  @press-enter="submitAssistant"
                />
                <a-button
                  type="primary"
                  class="config__form-submit"
                  :loading="assigningAssistant"
                  :disabled="!assistantEmail.trim()"
                  @click="submitAssistant"
                >
                  Agregar
                </a-button>
              </div>
            </section>

            <section class="config__panel" aria-labelledby="config-obs">
              <div class="config__panel-head">
                <div>
                  <h2 id="config-obs">Overlay OBS por cancha</h2>
                  <p class="config__desc">
                    Enlaces fijos para OBS. No cambian entre partidos de la misma cancha.
                  </p>
                </div>
              </div>

              <div v-if="streamCourts.length" class="config__list config__list--grid">
                <div
                  v-for="court in streamCourts"
                  :key="court"
                  class="config__row"
                >
                  <span class="config__row-main">Cancha {{ court }}</span>
                  <a-button size="small" @click="copyOverlayForCourt(court)">
                    {{ copiedCourt === court ? '¡Copiado!' : 'Copiar URL' }}
                  </a-button>
                </div>
              </div>
              <p v-else class="config__empty">
                Importa el calendario para generar los enlaces por cancha.
              </p>
            </section>

            <section class="config__danger" aria-labelledby="config-peligro">
              <div class="config__danger-head">
                <h2 id="config-peligro">Zona de peligro</h2>
                <p class="config__desc">
                  Úsalas solo si estás seguro. Piden confirmación antes de ejecutarse.
                </p>
              </div>

              <div class="config__danger-list">
                <div
                  v-if="tournament.status !== 'finished'"
                  class="config__danger-row"
                >
                  <div>
                    <h3>Finalizar torneo</h3>
                    <p>
                      Cierra el torneo. Los partidos sin jugar quedan 0-0 y no se podrán iniciar ni abrir controles.
                    </p>
                  </div>
                  <a-button
                    danger
                    :disabled="clearing || deleting"
                    @click="finishTournament"
                  >
                    Finalizar torneo
                  </a-button>
                </div>

                <div class="config__danger-row">
                  <div>
                    <h3>Limpiar datos</h3>
                    <p>
                      Quita partidos, plantillas y resultados. El torneo queda en borrador.
                    </p>
                  </div>
                  <a-button
                    danger
                    :loading="clearing"
                    :disabled="deleting"
                    @click="clearTournamentData"
                  >
                    Limpiar datos
                  </a-button>
                </div>

                <div v-if="isOwner" class="config__danger-row">
                  <div>
                    <h3>Eliminar torneo</h3>
                    <p>
                      Borra el torneo de la base de datos, con asistentes e información.
                    </p>
                  </div>
                  <a-button
                    danger
                    type="primary"
                    :loading="deleting"
                    :disabled="clearing"
                    @click="removeTournamentCompletely"
                  >
                    Eliminar torneo
                  </a-button>
                </div>
              </div>
            </section>
          </div>
        </a-tab-pane>
      </a-tabs>
    </a-spin>

    <a-modal
      v-model:open="showMatchModal"
      :title="matchModalTitle"
      :footer="null"
      destroy-on-close
      @cancel="resetMatchForm"
    >
      <a-form
        layout="vertical"
        :model="matchForm"
        :rules="matchFormRules"
        @finish="submitMatch"
      >
        <div class="match-form__grid">
          <a-form-item label="Equipo local" name="local_team">
            <a-input
              v-model:value="matchForm.local_team"
              placeholder="Ej. Halcones"
              :disabled="creatingMatch"
            />
          </a-form-item>
          <a-form-item label="Equipo visita" name="visit_team">
            <a-input
              v-model:value="matchForm.visit_team"
              placeholder="Ej. Tigres"
              :disabled="creatingMatch"
            />
          </a-form-item>
        </div>

        <div class="match-form__grid">
          <a-form-item label="Categoría">
            <a-input
              v-model:value="matchForm.category"
              placeholder="Opcional"
              :disabled="creatingMatch"
            />
          </a-form-item>
          <a-form-item label="Cancha" name="court">
            <a-input
              v-model:value="matchForm.court"
              placeholder="Ej. 1"
              :disabled="creatingMatch"
            />
          </a-form-item>
        </div>

        <div class="match-form__grid">
          <a-form-item label="Tiempo de juego" name="game_time">
            <a-input
              v-model:value="matchForm.game_time"
              placeholder="20:00"
              :disabled="creatingMatch"
            />
          </a-form-item>
          <a-form-item label="Fecha programada">
            <a-input
              v-model:value="matchForm.scheduled_at"
              type="datetime-local"
              :disabled="creatingMatch"
            />
          </a-form-item>
        </div>

        <a-alert
          v-if="matchFormError"
          type="error"
          :message="matchFormError"
          show-icon
          style="margin-bottom: 1rem"
        />

        <div class="match-form__footer">
          <a-button
            :disabled="creatingMatch"
            @click="showMatchModal = false; resetMatchForm()"
          >
            Cancelar
          </a-button>
          <a-button type="primary" html-type="submit" :loading="creatingMatch">
            {{ matchSubmitLabel }}
          </a-button>
        </div>
      </a-form>
    </a-modal>
  </div>
</template>

<style scoped lang="scss">
.detail {
  max-width: min(1000px, 100%);
  width: 100%;
  margin: 0 auto;
  padding: 1.5rem;
  box-sizing: border-box;
  overflow-x: clip;
}

.detail__table-wrap {
  width: 100%;
  max-width: 100%;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

.detail__table-wrap :deep(.ant-table) {
  min-width: 0;
}

.detail__table-wrap :deep(.ant-table-cell) {
  white-space: nowrap;
}

.detail__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  margin-bottom: 0.75rem;
  flex-wrap: wrap;

  h1 {
    margin: 0.5rem 0 0;
    font-family: 'Bebas Neue', sans-serif;
    font-size: 2.2rem;
  }
}

.detail__tabs {
  margin-top: 0.5rem;

  :deep(.ant-tabs-nav) {
    margin-bottom: 1.25rem;

    &::before {
      border-color: rgba(255, 255, 255, 0.12);
    }
  }

  :deep(.ant-tabs-tab) {
    color: rgba(232, 237, 245, 0.65);

    &:hover {
      color: #e8edf5;
    }
  }

  :deep(.ant-tabs-tab-active .ant-tabs-tab-btn) {
    color: #00d4ff;
    text-shadow: none;
  }

  :deep(.ant-tabs-ink-bar) {
    background: #00d4ff;
  }
}

.detail__actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.detail__section {
  margin-bottom: 2rem;

  h2 {
    margin: 0;
    font-size: 1.1rem;
  }
}

.detail__section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1rem;
}

.detail__section-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.detail__refreshing {
  font-size: 0.8rem;
  opacity: 0.55;
}

:deep(.detail__row--live) {
  background: rgba(82, 196, 26, 0.08) !important;
}

.detail__match-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  align-items: center;
}

.detail__more-btn {
  min-width: 2rem;
  padding-inline: 0.35rem;
  font-size: 1.1rem;
  line-height: 1;
  letter-spacing: 0.05em;
}

.detail__empty {
  padding: 2rem 1rem 1.5rem;
  text-align: center;
}

.detail__empty-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.5rem;
  margin-top: 0.25rem;
}

.match-form__grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0 0.75rem;

  @media (max-width: 520px) {
    grid-template-columns: 1fr;
  }
}

.match-form__footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 0.25rem;
}

/* —— Configuración —— */
.config {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  max-width: 40rem;
}

.config__intro {
  margin: 0 0 0.25rem;

  p {
    margin: 0;
    font-size: 0.9rem;
    line-height: 1.45;
    color: rgba(232, 237, 245, 0.62);
  }
}

.config__panel {
  padding: 1.15rem 0 1.35rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.config__panel-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  flex-wrap: wrap;
  margin-bottom: 0.85rem;

  h2 {
    margin: 0 0 0.35rem;
    font-size: 1.2rem;
    font-weight: 600;
    letter-spacing: 0.01em;
    color: #e8edf5;
  }
}

.config__desc {
  margin: 0;
  max-width: 28rem;
  font-size: 0.85rem;
  line-height: 1.4;
  color: rgba(232, 237, 245, 0.58);
}

.config__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  flex-shrink: 0;
}

.config__notes {
  margin: 0;
  padding: 0.75rem 0.9rem 0.75rem 1.35rem;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  font-size: 0.8rem;
  line-height: 1.45;
  color: rgba(232, 237, 245, 0.55);

  li + li {
    margin-top: 0.35rem;
  }

  strong {
    color: rgba(232, 237, 245, 0.78);
    font-weight: 600;
  }
}

.config__list {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.config__list--grid {
  @media (min-width: 640px) {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.5rem;
  }
}

.config__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.7rem 0.85rem;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.035);
  border: 1px solid rgba(255, 255, 255, 0.07);
}

.config__row-main {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.4rem;
  min-width: 0;
  font-size: 0.92rem;
}

.config__badge {
  font-size: 0.68rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: rgba(179, 127, 235, 0.95);
}

.config__empty {
  margin: 0;
  font-size: 0.85rem;
  color: rgba(232, 237, 245, 0.45);
}

.config__form {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 0.5rem;
  margin-top: 0.75rem;
}

:deep(.config__form .ant-input) {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.18);
  color: #e8edf5;

  &::placeholder {
    color: rgba(232, 237, 245, 0.45);
  }

  &:hover,
  &:focus {
    border-color: #00b4d8;
    background: rgba(255, 255, 255, 0.08);
  }
}

:deep(.config__form-submit.ant-btn-primary) {
  background: #00b4d8;
  border-color: #00b4d8;
  color: #041018;
  font-weight: 600;

  &:not(:disabled):hover {
    background: #00d4ff;
    border-color: #00d4ff;
    color: #041018;
  }

  &:disabled {
    background: rgba(0, 180, 216, 0.25);
    border-color: rgba(0, 180, 216, 0.35);
    color: rgba(232, 237, 245, 0.55);
  }
}

.config__danger {
  margin-top: 0.5rem;
  padding: 1.15rem 1rem 1.25rem;
  border-radius: 10px;
  border: 1px solid rgba(255, 77, 79, 0.28);
  background: rgba(255, 77, 79, 0.04);
}

.config__danger-head {
  margin-bottom: 1rem;

  h2 {
    margin: 0 0 0.35rem;
    font-size: 1.2rem;
    font-weight: 600;
    color: #ff7875;
  }
}

.config__danger-list {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.config__danger-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
  padding: 0.85rem 0;
  border-top: 1px solid rgba(255, 77, 79, 0.18);

  &:first-child {
    border-top: none;
    padding-top: 0;
  }

  h3 {
    margin: 0 0 0.2rem;
    font-size: 0.92rem;
    font-weight: 600;
    color: #e8edf5;
  }

  p {
    margin: 0;
    max-width: 22rem;
    font-size: 0.8rem;
    line-height: 1.4;
    color: rgba(232, 237, 245, 0.52);
  }
}

@media (max-width: 560px) {
  .config__form {
    grid-template-columns: 1fr;
  }

  .config__danger-row {
    align-items: stretch;

    .ant-btn {
      width: 100%;
    }
  }
}
</style>
