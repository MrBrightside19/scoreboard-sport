<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Modal, message } from 'ant-design-vue'
import { useAuthStore } from '@/stores/auth'
import {
  clearTournamentCalendar,
  fetchTournament,
  fetchTournamentMatches,
  importTournamentCsv,
  startTournamentMatch,
  updateTournamentStatus,
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

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const tournament = ref<Tournament | null>(null)
const assistants = ref<TournamentAssistant[]>([])
const matches = ref<TournamentMatch[]>([])
const loading = ref(true)
const refreshing = ref(false)
const importing = ref(false)
const copiedCourt = ref<string | null>(null)
const assistantEmail = ref('')
const assigningAssistant = ref(false)
const removingAssistantId = ref<string | null>(null)

let pollTimer: number | null = null

const isOwner = computed(
  () => tournament.value?.organizer_id === auth.profile?.id,
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
  await load({ silent: true })
}

function onVisibilityChange(): void {
  if (document.visibilityState === 'visible') {
    void refresh()
  }
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

async function startMatch(tm: TournamentMatch): Promise<void> {
  if (!auth.profile) return
  const matchId = await startTournamentMatch(tm, auth.profile.id)
  openControls({ ...tm, match_id: matchId })
  await load()
}

async function finishTournament(): Promise<void> {
  if (!tournament.value) return
  await updateTournamentStatus(tournament.value.id, 'finished')
  await load()
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
        <div class="detail__actions">
          <a-button @click="downloadTemplate">Descargar plantilla</a-button>
          <a-upload
            :show-upload-list="false"
            accept=".xlsx,.xls,.csv"
            :before-upload="(f: File) => { onCsvUpload(f); return false }"
          >
            <a-button :loading="importing">Importar calendario</a-button>
          </a-upload>
          <a-button
            v-if="tournament.status !== 'finished'"
            danger
            @click="finishTournament"
          >
            Finalizar torneo
          </a-button>
        </div>
      </header>
      <p v-if="tournament" class="detail__template-hint">
        La plantilla Excel tiene dos hojas: <strong>Calendario</strong> (partidos) y
        <strong>Jugadores</strong> (equipo, categoría, número, nombre, apellido y posición,
        donde la posición es el tipo: jugador, arquero, capitán o Asistente Capitán).
        Al importar se cargan ambas. Al iniciar un partido aparecen en Plantillas según equipo y categoría.
      </p>

      <section v-if="tournament && isOwner" class="detail__section">
        <h2>Asistentes del torneo</h2>
        <p class="detail__assistant-hint">
          Puedes asignar hasta {{ MAX_TOURNAMENT_ASSISTANTS }} personas como asistentes
          ({{ assistants.length }}/{{ MAX_TOURNAMENT_ASSISTANTS }}).
          Podrán operar el calendario y la mesa de control desde sus propias cuentas.
        </p>

        <div v-if="assistants.length" class="detail__assistant-list">
          <div
            v-for="item in assistants"
            :key="item.user_id"
            class="detail__assistant-current"
          >
            <div>
              <strong>{{ item.email }}</strong>
              <span class="detail__assistant-role">Asistente</span>
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

        <div v-if="canAddAssistant" class="detail__assistant-form">
          <a-input
            v-model:value="assistantEmail"
            type="email"
            placeholder="correo@ejemplo.com"
            :disabled="assigningAssistant"
          />
          <a-button
            type="primary"
            class="detail__assistant-submit"
            :loading="assigningAssistant"
            :disabled="!assistantEmail.trim()"
            @click="submitAssistant"
          >
            Agregar asistente
          </a-button>
        </div>
      </section>

      <section class="detail__section">
        <h2>Tabla de posiciones</h2>
        <TournamentStandings :standings="standings" />
      </section>

      <section v-if="tournament && streamCourts.length" class="detail__section">
        <h2>Overlay OBS por cancha</h2>
        <p class="detail__stream-hint">
          Enlaces fijos para transmisión continua. No necesitas cambiarlos entre partidos.
        </p>
        <div class="detail__stream-list">
          <div v-for="court in streamCourts" :key="court" class="detail__stream-item">
            <span>Cancha {{ court }}</span>
            <a-button size="small" @click="copyOverlayForCourt(court)">
              {{ copiedCourt === court ? '¡Copiado!' : 'Copiar OBS' }}
            </a-button>
          </div>
        </div>
      </section>

      <section class="detail__section">
        <div class="detail__section-header">
          <h2>Calendario</h2>
          <div class="detail__section-actions">
            <span v-if="refreshing" class="detail__refreshing">Actualizando…</span>
            <a-button size="small" :loading="refreshing" @click="refresh">
              Actualizar
            </a-button>
          </div>
        </div>
        <div class="detail__table-wrap">
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
            <a-table-column title="Acciones" :width="120" fixed="right">
              <template #default="{ record }">
                <div class="detail__match-actions">
                  <a-button
                    v-if="record.status === 'scheduled'"
                    type="primary"
                    size="small"
                    @click="startMatch(record)"
                  >
                    Iniciar
                  </a-button>
                  <a-button
                    v-if="record.status === 'live' && record.match_id"
                    type="primary"
                    size="small"
                    @click="openControls(record)"
                  >
                    Controles
                  </a-button>
                </div>
              </template>
            </a-table-column>
          </a-table>
        </div>
      </section>
    </a-spin>
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

.detail__template-hint {
  margin: 0 0 2rem;
  font-size: 0.85rem;
  opacity: 0.65;
  line-height: 1.4;
  max-width: 42rem;
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

.detail__stream-hint {
  margin: 0 0 1rem;
  font-size: 0.85rem;
  opacity: 0.7;
}

.detail__assistant-hint {
  margin: 0 0 1rem;
  font-size: 0.85rem;
  opacity: 0.7;
}

.detail__assistant-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.detail__assistant-current {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  padding: 0.85rem 1rem;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.detail__assistant-role {
  display: inline-block;
  margin-left: 0.5rem;
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #b37feb;
}

.detail__assistant-form {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 0.5rem;
}

:deep(.detail__assistant-form .ant-input) {
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

:deep(.detail__assistant-submit.ant-btn-primary) {
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

.detail__stream-list {
  display: grid;
  gap: 0.5rem;
}

.detail__stream-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.75rem 1rem;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
}
</style>
