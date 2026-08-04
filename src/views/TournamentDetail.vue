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
  updateTournamentVisibility,
} from '@/services/tournamentService'
import {
  buildTournamentTemplateWorkbook,
  parseTournamentImportFile,
} from '@/utils/tournamentImport'
import { normalizeGameTime } from '@/utils/clock'
import { formatScheduledAt } from '@/utils/datetime'
import { createMatchesTablePagination } from '@/utils/tablePagination'
import { buildAppUrl, tournamentLivePath, tournamentOverlayPath } from '@/utils/appUrl'
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
import TournamentTeamsPanel from '@/components/TournamentTeamsPanel.vue'
import MatchReportDrawer from '@/components/MatchReportDrawer.vue'
import TournamentStatsPanel from '@/components/TournamentStatsPanel.vue'
import { fetchMatchState } from '@/services/matchSync'
import {
  buildMatchReport,
  buildMatchReportFromFinishedScores,
  matchReportMetaFromTournamentMatch,
  type MatchReport,
} from '@/utils/matchReport'
import {
  buildMatchWorkbook,
  buildTournamentWorkbook,
  downloadWorkbookBuffer,
  matchReportFilename,
  tournamentReportFilename,
} from '@/utils/matchReportWorkbook'

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
const copiedLinkKey = ref<string | null>(null)
const assistantEmail = ref('')
const assigningAssistant = ref(false)
const removingAssistantId = ref<string | null>(null)
const activeTab = ref('partidos')
const showMatchModal = ref(false)
const creatingMatch = ref(false)
const matchFormError = ref<string | null>(null)
const editingMatchId = ref<string | null>(null)
const deletingMatchId = ref<string | null>(null)
const startingMatchId = ref<string | null>(null)
const savingVisibility = ref(false)
const matchesPagination = createMatchesTablePagination(10)
const reportOpen = ref(false)
const reportLoading = ref(false)
const reportDownloading = ref(false)
const tournamentReportDownloading = ref(false)
const activeReport = ref<MatchReport | null>(null)

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

const canDownloadTournamentReport = computed(
  () => matches.value.some((m) => m.status === 'finished' && m.match_id),
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

async function loadReportForMatch(tm: TournamentMatch): Promise<MatchReport> {
  const meta = matchReportMetaFromTournamentMatch(tm)
  if (!tm.match_id) {
    return buildMatchReportFromFinishedScores(
      meta,
      tm.goal_local ?? 0,
      tm.goal_visit ?? 0,
    )
  }
  const record = await fetchMatchState(tm.match_id)
  if (!record?.state) {
    return buildMatchReportFromFinishedScores(
      meta,
      tm.goal_local ?? record?.goal_local ?? 0,
      tm.goal_visit ?? record?.goal_visit ?? 0,
    )
  }
  return buildMatchReport(meta, {
    ...record.state,
    goalLocal: record.goal_local ?? record.state.goalLocal,
    goalVisit: record.goal_visit ?? record.state.goalVisit,
  })
}

async function openMatchReport(tm: TournamentMatch): Promise<void> {
  reportOpen.value = true
  reportLoading.value = true
  activeReport.value = null
  try {
    activeReport.value = await loadReportForMatch(tm)
  } catch (err) {
    message.error(err instanceof Error ? err.message : 'No se pudo cargar el informe')
    reportOpen.value = false
  } finally {
    reportLoading.value = false
  }
}

function downloadActiveReport(): void {
  if (!activeReport.value) return
  reportDownloading.value = true
  try {
    const buffer = buildMatchWorkbook(activeReport.value)
    downloadWorkbookBuffer(buffer, matchReportFilename(activeReport.value))
  } finally {
    reportDownloading.value = false
  }
}

async function downloadTournamentReports(): Promise<void> {
  if (!tournament.value) return
  const targets = matches.value.filter((m) => m.status === 'finished' && m.match_id)
  if (targets.length === 0) {
    message.warning('No hay partidos finalizados con datos para exportar')
    return
  }

  tournamentReportDownloading.value = true
  try {
    const reports: MatchReport[] = []
    for (const tm of targets) {
      reports.push(await loadReportForMatch(tm))
    }
    const buffer = buildTournamentWorkbook(tournament.value.name, reports)
    downloadWorkbookBuffer(buffer, tournamentReportFilename(tournament.value.name))
  } catch (err) {
    message.error(err instanceof Error ? err.message : 'No se pudo generar el Excel del torneo')
  } finally {
    tournamentReportDownloading.value = false
  }
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

async function changeVisibility(visibility: Tournament['visibility']): Promise<void> {
  if (!tournament.value || !isOwner.value) return
  if (tournament.value.visibility === visibility || savingVisibility.value) return

  savingVisibility.value = true
  try {
    tournament.value = await updateTournamentVisibility(tournament.value.id, visibility)
    message.success(
      visibility === 'public'
        ? 'El torneo ahora es público.'
        : 'El torneo ahora es privado.',
    )
  } catch (err) {
    Modal.error({
      title: 'No se pudo cambiar la visibilidad',
      content: err instanceof Error ? err.message : 'Error desconocido',
    })
  } finally {
    savingVisibility.value = false
  }
}

async function startMatch(tm: TournamentMatch): Promise<void> {
  if (!auth.profile || startingMatchId.value) return
  if (tournament.value?.status === 'finished') {
    message.warning('El torneo está finalizado. No se pueden iniciar partidos.')
    return
  }
  startingMatchId.value = tm.id
  try {
    const matchId = await startTournamentMatch(tm, auth.profile.id)
    openControls({ ...tm, match_id: matchId })
    await load()
  } catch (err) {
    Modal.error({
      title: 'No se pudo iniciar el partido',
      content: err instanceof Error ? err.message : 'Error desconocido',
    })
  } finally {
    startingMatchId.value = null
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

function copyCourtLink(
  court: string,
  type: 'obs' | 'live',
): void {
  if (!tournament.value) return
  const path =
    type === 'obs'
      ? tournamentOverlayPath(tournament.value.id, court)
      : tournamentLivePath(tournament.value.id, court)
  void navigator.clipboard.writeText(buildAppUrl(path))
  const key = `${court}-${type}`
  copiedLinkKey.value = key
  setTimeout(() => {
    if (copiedLinkKey.value === key) copiedLinkKey.value = null
  }, 2000)
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
                :pagination="matchesPagination"
                size="small"
                table-layout="fixed"
                :scroll="{ x: 986 }"
                :row-class-name="(record: TournamentMatch) =>
                  record.status === 'live' ? 'detail__row--live' : ''"
              >
                <a-table-column title="Local" data-index="local_team" :ellipsis="true" :width="140" />
                <a-table-column title="Visita" data-index="visit_team" :ellipsis="true" :width="140" />
                <a-table-column title="Categoría" :width="110" :ellipsis="true">
                  <template #default="{ record }">
                    {{ record.category || '—' }}
                  </template>
                </a-table-column>
                <a-table-column title="Cancha" data-index="court" :width="80" :ellipsis="true" />
                <a-table-column title="Hora" :width="72" align="center">
                  <template #default="{ record }">
                    {{ formatScheduledAt(record.scheduled_at) }}
                  </template>
                </a-table-column>
                <a-table-column title="Duración" :width="88" align="center">
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
                <a-table-column title="Resultado" :width="96" align="center">
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
                        :loading="startingMatchId === record.id"
                        :disabled="startingMatchId !== null && startingMatchId !== record.id"
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
                      <a-button
                        v-if="
                          record.match_id
                            && (record.status === 'finished' || record.status === 'live')
                        "
                        size="small"
                        class="detail__info-btn"
                        aria-label="Ver informe"
                        title="Ver informe"
                        @click="openMatchReport(record)"
                      >
                        <span class="detail__btn-icon" aria-hidden="true">
                          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="12" cy="12" r="9" />
                            <path d="M12 11v6" />
                            <path d="M12 8h.01" />
                          </svg>
                        </span>
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

        <a-tab-pane key="estadisticas" tab="Estadísticas">
          <TournamentStatsPanel :standings="standings" :matches="matches" />
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
              <div>
                <h2 class="config__title">Configuración</h2>
                <p>
                  Datos del torneo, equipo de trabajo y transmisión.
                  Las acciones destructivas están al final.
                </p>
              </div>
            </header>

            <div class="config__grid">
              <section
                v-if="isOwner"
                class="config__card config__card--wide config__card--split"
                aria-labelledby="config-visibilidad"
              >
                <div class="config__card-top">
                  <span class="config__eyebrow">Acceso</span>
                  <h3 id="config-visibilidad">Visibilidad</h3>
                  <p class="config__desc">
                    Público aparece en Torneos públicos. Privado solo lo ven el organizador y sus asistentes.
                  </p>
                </div>
                <div class="config__card-body config__card-body--end">
                  <a-radio-group
                    class="config__visibility"
                    :value="tournament.visibility"
                    button-style="solid"
                    :disabled="savingVisibility"
                    @update:value="(v: Tournament['visibility']) => changeVisibility(v)"
                  >
                    <a-radio-button value="public">Público</a-radio-button>
                    <a-radio-button value="private">Privado</a-radio-button>
                  </a-radio-group>
                  <p v-if="savingVisibility" class="config__hint">Guardando…</p>
                </div>
              </section>

              <section
                class="config__card config__card--wide config__card--split"
                aria-labelledby="config-informes"
              >
                <div class="config__card-top">
                  <span class="config__eyebrow">Exportar</span>
                  <h3 id="config-informes">Informes</h3>
                  <p class="config__desc">
                    Excel consolidado con resultados, destacados y estadísticas de partidos finalizados.
                  </p>
                </div>
                <div class="config__card-body config__card-body--end">
                  <a-button
                    type="primary"
                    block
                    :loading="tournamentReportDownloading"
                    :disabled="!canDownloadTournamentReport"
                    class="detail__report-torneo-btn config__export-btn"
                    @click="downloadTournamentReports"
                  >
                    <span class="detail__btn-icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M12 3v12" />
                        <path d="m7 10 5 5 5-5" />
                        <path d="M5 21h14" />
                      </svg>
                    </span>
                    Informe torneo
                  </a-button>
                  <p v-if="!canDownloadTournamentReport" class="config__hint">
                    Disponible con al menos un partido finalizado con datos.
                  </p>
                </div>
              </section>

              <section class="config__card" aria-labelledby="config-datos">
                <div class="config__card-top">
                  <span class="config__eyebrow">Datos</span>
                  <h3 id="config-datos">Calendario y plantillas</h3>
                  <p class="config__desc">
                    Descarga la plantilla Excel, complétala e impórtala para cargar partidos y jugadores.
                  </p>
                </div>
                <div class="config__card-body">
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
                  <ul class="config__notes">
                    <li>
                      Hojas <strong>Calendario</strong> y <strong>Jugadores</strong>
                      (nombre completo en una columna).
                    </li>
                    <li>
                      <strong>fecha_programada</strong> (ej. 2026-06-15 18:00) = hora del partido.
                    </li>
                    <li>
                      Posición = jugador, arquero, capitán o Asistente Capitán.
                    </li>
                  </ul>
                </div>
              </section>

              <section
                v-if="isOwner"
                class="config__card"
                aria-labelledby="config-asistentes"
              >
                <div class="config__card-top">
                  <span class="config__eyebrow">Equipo</span>
                  <h3 id="config-asistentes">Asistentes</h3>
                  <p class="config__desc">
                    Hasta {{ MAX_TOURNAMENT_ASSISTANTS }} personas pueden operar calendario y controles
                    ({{ assistants.length }}/{{ MAX_TOURNAMENT_ASSISTANTS }}).
                  </p>
                </div>
                <div class="config__card-body">
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
                  <p v-else class="config__hint">Aún no hay asistentes asignados.</p>

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
                </div>
              </section>

              <section
                class="config__card config__card--wide"
                aria-labelledby="config-enlaces"
              >
                <div class="config__stream-head">
                  <div class="config__card-top">
                    <span class="config__eyebrow">Transmisión</span>
                    <h3 id="config-enlaces">Enlaces por cancha</h3>
                    <p class="config__desc">
                      Enlaces fijos de OBS y Live. No cambian entre partidos de la misma cancha.
                    </p>
                  </div>
                  <p v-if="streamCourts.length" class="config__stream-count">
                    {{ streamCourts.length }}
                    {{ streamCourts.length === 1 ? 'cancha' : 'canchas' }}
                  </p>
                </div>
                <div class="config__card-body">
                  <div v-if="streamCourts.length" class="config__courts">
                    <div
                      v-for="court in streamCourts"
                      :key="court"
                      class="config__court"
                    >
                      <span class="config__court-label">Cancha {{ court }}</span>
                      <div class="config__court-actions">
                        <a-button
                          class="config__court-btn"
                          @click="copyCourtLink(court, 'obs')"
                        >
                          {{
                            copiedLinkKey === `${court}-obs`
                              ? '¡Copiado!'
                              : 'Copiar OBS'
                          }}
                        </a-button>
                        <a-button
                          class="config__court-btn"
                          type="primary"
                          ghost
                          @click="copyCourtLink(court, 'live')"
                        >
                          {{
                            copiedLinkKey === `${court}-live`
                              ? '¡Copiado!'
                              : 'Copiar Live'
                          }}
                        </a-button>
                      </div>
                    </div>
                  </div>
                  <p v-else class="config__hint">
                    Importa el calendario o agrega partidos para generar los enlaces por cancha.
                  </p>
                </div>
              </section>
            </div>

            <section class="config__danger" aria-labelledby="config-peligro">
              <div class="config__danger-head">
                <span class="config__eyebrow config__eyebrow--danger">Peligro</span>
                <h3 id="config-peligro">Zona de peligro</h3>
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
                    <h4>Finalizar torneo</h4>
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
                    <h4>Limpiar datos</h4>
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
                    <h4>Eliminar torneo</h4>
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

    <MatchReportDrawer
      v-model:open="reportOpen"
      :report="activeReport"
      :loading="reportLoading"
      :can-download="true"
      :downloading="reportDownloading"
      @download="downloadActiveReport"
    />
  </div>
</template>

<style scoped lang="scss">
.detail {
  max-width: min(1180px, 100%);
  width: 100%;
  margin: 0 auto;
  padding: 1.25rem 0.85rem;
  box-sizing: border-box;
  overflow-x: clip;

  @media (min-width: 640px) {
    padding: 1.5rem 1.25rem;
  }

  @media (min-width: 1100px) {
    padding: 1.75rem 1.5rem;
  }
}

.detail__table-wrap {
  width: 100%;
  max-width: 100%;
}

.detail__table-wrap :deep(.ant-table-thead > tr > th) {
  white-space: nowrap;
}

.detail__table-wrap :deep(.ant-table-tbody > tr > td) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.detail__table-wrap :deep(.ant-table-cell-fix-right) {
  background: var(--app-bg-elevated) !important;
}

.detail__table-wrap :deep(.ant-table-tbody > tr:hover > td.ant-table-cell-fix-right) {
  background: var(--app-bg-elevated) !important;
}

.detail__table-wrap :deep(.detail__row--live > td.ant-table-cell-fix-right) {
  background: color-mix(in srgb, var(--app-bg-elevated) 88%, #52c41a) !important;
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
      border-color: var(--app-border-strong);
    }
  }

  :deep(.ant-tabs-tab) {
    color: var(--app-text-muted);

    &:hover {
      color: var(--app-text);
    }
  }

  :deep(.ant-tabs-tab-active .ant-tabs-tab-btn) {
    color: var(--app-link);
    text-shadow: none;
  }

  :deep(.ant-tabs-ink-bar) {
    background: var(--app-link);
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

.detail__btn-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  line-height: 0;
}

.detail__report-torneo-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}

.detail__info-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 28px;
  padding-inline: 0.4rem;
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
  flex-wrap: nowrap;
  gap: 0.3rem;
  align-items: center;
  justify-content: flex-start;
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
  width: 100%;
  max-width: none;
}

.config__intro {
  margin: 0;
}

.config__title {
  margin: 0 0 0.25rem;
  font-size: 1.15rem;
  font-weight: 650;
  color: var(--app-text);
}

.config__intro p {
  margin: 0;
  font-size: 0.88rem;
  line-height: 1.45;
  color: var(--app-text-muted);
}

.config__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.85rem;
}

.config__card {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
  padding: 1.1rem 1.15rem 1.2rem;
  border-radius: 12px;
  border: 1px solid var(--app-border);
  background: var(--app-bg-elevated);
  min-width: 0;
}

.config__card--wide {
  grid-column: 1 / -1;
}

.config__card--split {
  @media (min-width: 640px) {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    gap: 1.5rem;
    padding-block: 1.15rem;

    .config__card-top {
      flex: 1 1 auto;
      min-width: 0;
      max-width: none;
    }

    .config__card-body {
      flex: 0 0 18rem;
      width: 18rem;
      margin-top: 0;
    }
  }

  @media (min-width: 960px) {
    .config__card-body {
      flex-basis: 22rem;
      width: 22rem;
    }
  }
}

.config__card-top {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.config__eyebrow {
  font-size: 0.68rem;
  font-weight: 650;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--app-primary);

  &--danger {
    color: var(--app-danger-text);
  }
}

.config__card-top h3,
.config__danger-head h3 {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 650;
  color: var(--app-text);
}

.config__desc {
  margin: 0;
  font-size: 0.84rem;
  line-height: 1.45;
  color: var(--app-text-muted);
}

.config__card-body {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-top: auto;
}

.config__card-body--end {
  align-items: stretch;
}

.config__visibility {
  display: flex !important;
  width: 100%;

  :deep(.ant-radio-button-wrapper) {
    flex: 1;
    text-align: center;
  }
}

.config__export-btn {
  width: 100%;
  justify-content: center;
}

.config__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.config__notes {
  margin: 0;
  padding: 0.7rem 0.85rem 0.7rem 1.25rem;
  border-radius: 8px;
  background: var(--app-surface);
  border: 1px solid var(--app-border);
  font-size: 0.78rem;
  line-height: 1.45;
  color: var(--app-text-muted);

  li + li {
    margin-top: 0.3rem;
  }

  strong {
    color: var(--app-text-soft);
    font-weight: 600;
  }
}

.config__list {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.config__stream-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.config__stream-count {
  margin: 0.15rem 0 0;
  flex-shrink: 0;
  font-size: 0.78rem;
  font-weight: 650;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--app-text-muted);
}

.config__courts {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(14.5rem, 1fr));
  gap: 0.65rem;
}

.config__court {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  padding: 0.85rem 0.9rem;
  border-radius: 10px;
  background: var(--app-surface);
  border: 1px solid var(--app-border);
  min-width: 0;
}

.config__court-label {
  font-size: 0.92rem;
  font-weight: 650;
  color: var(--app-text);
}

.config__court-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.4rem;
}

.config__court-btn {
  width: 100%;
}

.config__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.7rem 0.85rem;
  border-radius: 8px;
  background: var(--app-surface);
  border: 1px solid var(--app-border);
}

.config__row-main {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.4rem;
  min-width: 0;
  font-size: 0.9rem;
}

.config__badge {
  font-size: 0.68rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: rgba(179, 127, 235, 0.95);
}

.config__hint {
  margin: 0;
  font-size: 0.8rem;
  color: var(--app-text-muted);
}

.config__form {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 0.5rem;
}

:deep(.config__form-submit.ant-btn-primary) {
  font-weight: 600;
}

.config__danger {
  padding: 1.15rem 1.15rem 1.25rem;
  border-radius: 12px;
  border: 1px solid var(--app-danger-border);
  background: var(--app-danger-hover-bg);
}

.config__danger-head {
  margin-bottom: 0.85rem;

  h3 {
    color: var(--app-danger-text);
  }
}

.config__danger-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
  gap: 0.65rem;
}

.config__danger-row {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.85rem;
  padding: 0.9rem 0.95rem;
  border-radius: 10px;
  border: 1px solid rgba(255, 77, 79, 0.16);
  background: color-mix(in srgb, var(--app-bg-elevated) 88%, transparent);

  h4 {
    margin: 0 0 0.25rem;
    font-size: 0.92rem;
    font-weight: 650;
    color: var(--app-text);
  }

  p {
    margin: 0;
    font-size: 0.8rem;
    line-height: 1.4;
    color: var(--app-text-muted);
  }

  .ant-btn {
    align-self: stretch;
  }
}

@media (max-width: 860px) {
  .config__grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 560px) {
  .config__form {
    grid-template-columns: 1fr;
  }

  .config__danger-list {
    grid-template-columns: 1fr;
  }
}
</style>
