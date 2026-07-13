<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import { Modal } from 'ant-design-vue'
import { useScoreboardStore } from '@/stores/scoreboard'
import { useAuthStore } from '@/stores/auth'
import { fetchMatchState, finishMatch, publishMatchState } from '@/services/matchSync'
import {
  advanceToNextTournamentMatch,
  fetchTournamentMatchByMatchId,
  finishTournamentMatch,
  getNextScheduledMatch,
} from '@/services/tournamentService'
import { isSupabaseConfigured } from '@/services/supabaseClient'
import { readMatchIdFromStorage, writeCourtActiveMatch, clearMatchIdFromStorage } from '@/utils/localSync'
import { normalizeGameTime, parseTimeToSeconds } from '@/utils/clock'
import { playCountdownBeep } from '@/utils/countdownBeep'
import { buildAppUrl, tournamentBoardPath, tournamentLivePath, tournamentOverlayPath } from '@/utils/appUrl'
import { getLiveClockUpdateMs } from '@/config/poll'
import { MAX_PERIODS, isGoalPending, DEFAULT_INTERMISSION_TIME } from '@/types/hockeyScoreboard'
import type { TeamPenalty } from '@/types/hockeyScoreboard'
import { penaltyTypeLabel } from '@/data/penaltyCatalog'
import { findPlayerById, findPlayerByNumber, playerLabel } from '@/utils/roster'
import ControlsRosterPanel from '@/components/controls/ControlsRosterPanel.vue'
import ControlsGoalsPanel from '@/components/controls/ControlsGoalsPanel.vue'
import ControlsPenaltiesPanel from '@/components/controls/ControlsPenaltiesPanel.vue'
import TimeInput from '@/components/controls/TimeInput.vue'

const route = useRoute()
const router = useRouter()
const store = useScoreboardStore()
const auth = useAuthStore()

const matchId = computed(
  () => (route.query.matchId as string) || readMatchIdFromStorage() || '',
)

const matchFallback = computed((): Pick<
  import('@/types/hockeyScoreboard').ScoreboardState,
  'localTeam' | 'visitTeam' | 'timeGame'
> | undefined => {
  const local = route.query.local as string | undefined
  const visit = route.query.visit as string | undefined
  const time = route.query.time as string | undefined
  if (!local || !visit) return undefined
  return { localTeam: local, visitTeam: visit, timeGame: normalizeGameTime(time ?? '20:00') }
})

const copied = ref<string | null>(null)
const hydrated = ref(false)
const advancing = ref(false)
const finishing = ref(false)
const advanceError = ref<string | null>(null)
const tournamentContext = ref<{ tournamentId: string; court: string } | null>(null)
const hasNextMatch = ref(false)
const skipLeaveGuard = ref(false)
const activeTab = ref('match')
const clockDraft = ref(store.state.timeGame)
const clockEditing = ref(false)
let lastCountdownBeepSecond: number | null = null

const pendingGoalsCount = computed(
  () => store.state.goals.filter((goal) => isGoalPending(goal)).length,
)

const canAdvancePeriod = computed(
  () =>
    store.state.intermissionActive ||
    store.state.isPaused ||
    parseTimeToSeconds(store.state.timeGame) <= 0,
)

const showIntermissionControls = computed(
  () =>
    store.state.intermissionActive || parseTimeToSeconds(store.state.timeGame) <= 0,
)

const intermissionDraft = ref(DEFAULT_INTERMISSION_TIME)

watch(
  () => store.state.intermissionActive,
  (active) => {
    if (!active) {
      intermissionDraft.value = DEFAULT_INTERMISSION_TIME
    }
  },
)

watch(
  () => store.state.intermissionTime,
  (time) => {
    if (store.state.intermissionActive) {
      intermissionDraft.value = time
    } else {
      intermissionDraft.value = DEFAULT_INTERMISSION_TIME
    }
  },
)

function goToNextPeriod(): void {
  if (!canAdvancePeriod.value) return

  if (typeof store.advanceToNextPeriod === 'function') {
    store.advanceToNextPeriod()
  } else {
    if (!store.state.isPaused && parseTimeToSeconds(store.state.timeGame) > 0) {
      store.syncElapsedAndPause()
    } else if (!store.state.isPaused) {
      store.patch({ isPaused: true })
    }
    store.setPeriod(store.state.gamePeriod + 1)
    store.setGameTime('20:00')
    store.patch({
      intermissionActive: false,
      intermissionTime: DEFAULT_INTERMISSION_TIME,
      isPaused: true,
    })
  }

  clockDraft.value = store.state.timeGame
  intermissionDraft.value = DEFAULT_INTERMISSION_TIME
}

function startOrToggleIntermission(): void {
  if (store.state.intermissionActive) {
    store.togglePause()
    return
  }
  const duration = intermissionDraft.value.trim() || DEFAULT_INTERMISSION_TIME
  intermissionDraft.value = duration
  store.setIntermissionTime(duration)
  store.startIntermission(duration)
}

function onIntermissionDraftUpdate(value: string): void {
  intermissionDraft.value = value
}

function commitIntermissionDraft(): void {
  const normalized = intermissionDraft.value.trim() || DEFAULT_INTERMISSION_TIME
  store.setIntermissionTime(normalized)
  intermissionDraft.value = store.state.intermissionTime
}

function stopIntermission(): void {
  if (typeof store.stopIntermission === 'function') {
    store.stopIntermission()
  } else if (
    typeof store.advanceToNextPeriod === 'function' &&
    store.state.gamePeriod < MAX_PERIODS
  ) {
    store.advanceToNextPeriod()
  } else {
    store.patch({
      intermissionActive: false,
      intermissionTime: DEFAULT_INTERMISSION_TIME,
      isPaused: true,
    })
  }
  clockDraft.value = store.state.timeGame
  intermissionDraft.value = DEFAULT_INTERMISSION_TIME
}

const powerPlayModalOpen = ref(false)
const powerPlayTeam = ref<'local' | 'visit'>('local')
const powerPlayPenalties = ref<TeamPenalty[]>([])
const selectedPenaltyId = ref('')

const powerPlayTeamName = computed(() =>
  powerPlayTeam.value === 'local' ? store.state.localTeam : store.state.visitTeam,
)

function penaltyPlayerLabel(team: 'local' | 'visit', penalty: TeamPenalty): string {
  const roster = team === 'local' ? store.state.rosterLocal : store.state.rosterVisit
  const player =
    findPlayerById(roster, penalty.playerId) ?? findPlayerByNumber(roster, penalty.player)
  if (player) return playerLabel(player)
  return penalty.player.trim() ? `#${penalty.player}` : 'Jugador'
}

function markGoal(team: 'local' | 'visit'): void {
  store.markGoal(team)

  const against = team === 'local' ? 'visit' : 'local'
  const penalties =
    against === 'local' ? store.state.penaltiesLocal : store.state.penaltiesVisit
  if (penalties.length === 0) return

  powerPlayTeam.value = against
  powerPlayPenalties.value = [...penalties]
  selectedPenaltyId.value = penalties[0]?.id ?? ''
  powerPlayModalOpen.value = true
}

function keepPowerPlayPenalties(): void {
  powerPlayModalOpen.value = false
}

function releasePowerPlayPenalty(): void {
  if (selectedPenaltyId.value) {
    store.removePenalty(powerPlayTeam.value, selectedPenaltyId.value)
  }
  powerPlayModalOpen.value = false
}

watch(
  () => store.state.timeGame,
  (time) => {
    if (!clockEditing.value) clockDraft.value = time
  },
)

watch(
  () => ({
    seconds: parseTimeToSeconds(store.state.timeGame),
    paused: store.state.isPaused,
    intermission: store.state.intermissionActive,
  }),
  ({ seconds, paused, intermission }) => {
    if (paused || intermission) {
      lastCountdownBeepSecond = null
      return
    }
    if (seconds < 0 || seconds > 10) {
      lastCountdownBeepSecond = null
      return
    }
    if (lastCountdownBeepSecond === seconds) return
    lastCountdownBeepSecond = seconds
    void playCountdownBeep(seconds === 0)
  },
)

let lastIntermissionBeepSecond: number | null = null

watch(
  () => ({
    seconds: parseTimeToSeconds(store.state.intermissionTime),
    active: store.state.intermissionActive,
    paused: store.state.isPaused,
  }),
  ({ seconds, active, paused }) => {
    if (!active || paused) {
      lastIntermissionBeepSecond = null
      return
    }
    if (seconds < 0 || seconds > 10) {
      lastIntermissionBeepSecond = null
      return
    }
    if (lastIntermissionBeepSecond === seconds) return
    lastIntermissionBeepSecond = seconds
    void playCountdownBeep(seconds === 0)
  },
)

function onClockFocus(): void {
  clockEditing.value = true
  clockDraft.value = store.state.timeGame
}

function onClockDraftUpdate(value: string): void {
  clockDraft.value = value
}

function commitClockDraft(): void {
  clockEditing.value = false
  if (!store.state.isPaused) {
    clockDraft.value = store.state.timeGame
    return
  }
  store.setGameTime(clockDraft.value)
  clockDraft.value = store.state.timeGame
}

let publishTimer: number | null = null
let publishDebounceTimer: number | null = null
let publishInFlight = false
let publishQueued = false

function penaltySignature(
  penalties: import('@/types/hockeyScoreboard').TeamPenalty[],
): string {
  return penalties
    .map((penalty) =>
      `${penalty.id}|${penalty.playerId}|${penalty.penaltyTypeId}|${penalty.infraction}`,
    )
    .join(';')
}

function schedulePublish(delayMs = 400): void {
  if (!hydrated.value || !matchId.value || !isSupabaseConfigured) return
  if (publishDebounceTimer) clearTimeout(publishDebounceTimer)
  publishDebounceTimer = window.setTimeout(() => {
    publishDebounceTimer = null
    void publish()
  }, delayMs)
}

async function finalizeOnExit(): Promise<void> {
  store.stopWriterTick()
  if (publishTimer) {
    clearInterval(publishTimer)
    publishTimer = null
  }
  if (publishDebounceTimer) {
    clearTimeout(publishDebounceTimer)
    publishDebounceTimer = null
  }
  if (!matchId.value || !hydrated.value || !isSupabaseConfigured) return
  hydrated.value = false
  store.syncElapsedAndPause()
  await publish()
}

function onBeforeUnload(event: BeforeUnloadEvent): void {
  if (!matchId.value || !hydrated.value || skipLeaveGuard.value) return
  event.preventDefault()
  event.returnValue = ''
}

let leaveModalOpen = false

async function loadTournamentContext(id: string): Promise<void> {
  tournamentContext.value = null
  hasNextMatch.value = false

  if (!isSupabaseConfigured) return

  try {
    const record = await fetchMatchState(id)
    if (!record?.tournament_id || !record.court) return

    tournamentContext.value = {
      tournamentId: record.tournament_id,
      court: record.court,
    }
    writeCourtActiveMatch(record.tournament_id, record.court, id)
    const next = await getNextScheduledMatch(record.tournament_id, record.court)
    hasNextMatch.value = Boolean(next)
  } catch {
    tournamentContext.value = null
  }
}

async function initMatch(id: string): Promise<void> {
  hydrated.value = false
  advanceError.value = null
  await store.hydrateMatch(id, matchFallback.value)
  await loadTournamentContext(id)
  hydrated.value = true
  if (!store.isWriter) {
    store.startWriterTick()
  }
}

async function goToNextMatch(): Promise<void> {
  if (!matchId.value || !auth.profile) return

  advancing.value = true
  advanceError.value = null
  hydrated.value = false
  store.stopWriterTick()

  try {
    const result = await advanceToNextTournamentMatch(
      matchId.value,
      store.state,
      auth.profile.id,
    )

    if (!result) {
      // El partido actual ya quedó finalizado; no volver a publicar como en vivo.
      skipLeaveGuard.value = true
      const tournamentId = tournamentContext.value?.tournamentId
      if (tournamentId) {
        await router.replace({ name: 'tournament-detail', params: { id: tournamentId } })
      } else {
        await router.replace({ name: 'tournaments' })
      }
      return
    }

    skipLeaveGuard.value = true
    writeCourtActiveMatch(result.tournamentId, result.court, result.matchId)
    await router.replace({
      name: 'controls',
      query: {
        matchId: result.matchId,
        local: result.localTeam,
        visit: result.visitTeam,
        time: result.timeGame,
        tournamentId: result.tournamentId,
      },
    })
  } catch (err) {
    advanceError.value = err instanceof Error ? err.message : 'Error al avanzar al siguiente partido'
    hydrated.value = true
    store.startWriterTick()
  } finally {
    advancing.value = false
  }
}

async function finishCurrentMatch(): Promise<void> {
  if (!matchId.value || finishing.value) return

  finishing.value = true
  advanceError.value = null
  store.stopWriterTick()
  if (publishTimer) {
    clearInterval(publishTimer)
    publishTimer = null
  }
  if (publishDebounceTimer) {
    clearTimeout(publishDebounceTimer)
    publishDebounceTimer = null
  }

  try {
    store.syncElapsedAndPause()
    const tm = await fetchTournamentMatchByMatchId(matchId.value)
    if (tm) {
      await finishTournamentMatch(tm, store.state)
    } else {
      await finishMatch(matchId.value, store.state)
    }

    skipLeaveGuard.value = true
    hydrated.value = false
    if (!tm) clearMatchIdFromStorage()

    const tournamentId = tournamentContext.value?.tournamentId ?? tm?.tournament_id
    if (tournamentId) {
      await router.replace({ name: 'tournament-detail', params: { id: tournamentId } })
    } else {
      await router.replace({ name: 'home' })
    }
  } catch (err) {
    advanceError.value = err instanceof Error ? err.message : 'Error al finalizar el partido'
    hydrated.value = true
    store.startWriterTick()
  } finally {
    finishing.value = false
  }
}

async function publish(): Promise<void> {
  if (!matchId.value || !isSupabaseConfigured) return
  if (publishInFlight) {
    publishQueued = true
    return
  }

  publishInFlight = true
  try {
    await publishMatchState(matchId.value, store.state, {
      organizer_id: auth.profile?.id ?? null,
      is_live: true,
      title: `${store.state.localTeam} vs ${store.state.visitTeam}`,
    })
  } finally {
    publishInFlight = false
    if (publishQueued) {
      publishQueued = false
      void publish()
    }
  }
}

type LinkType = 'live' | 'overlay' | 'live-torneo' | 'overlay-torneo' | 'board-torneo'

function copyLink(type: LinkType): void {
  let path = ''

  if (type === 'overlay-torneo' && tournamentContext.value) {
    const { tournamentId, court } = tournamentContext.value
    path = tournamentOverlayPath(tournamentId, court)
  } else if (type === 'live-torneo' && tournamentContext.value) {
    const { tournamentId, court } = tournamentContext.value
    path = tournamentLivePath(tournamentId, court)
  } else if (type === 'board-torneo' && tournamentContext.value) {
    const { tournamentId, court } = tournamentContext.value
    path = tournamentBoardPath(tournamentId, court)
  } else if (type === 'live') {
    path = `/live/${matchId.value}`
  } else {
    path = `/overlay/${matchId.value}`
  }

  void navigator.clipboard.writeText(buildAppUrl(path))
  copied.value = type
  setTimeout(() => { copied.value = null }, 2000)
}

watch(
  matchId,
  (id) => {
    if (id) void initMatch(id)
  },
  { immediate: true },
)

watch(
  () => ({
    localTeam: store.state.localTeam,
    visitTeam: store.state.visitTeam,
    goalLocal: store.state.goalLocal,
    goalVisit: store.state.goalVisit,
    gamePeriod: store.state.gamePeriod,
    isPaused: store.state.isPaused,
    goals: store.state.goals,
    rosterLocal: store.state.rosterLocal,
    rosterVisit: store.state.rosterVisit,
    penaltiesLocal: penaltySignature(store.state.penaltiesLocal),
    penaltiesVisit: penaltySignature(store.state.penaltiesVisit),
    manualClock: store.state.isPaused ? store.state.timeGame : null,
  }),
  () => {
    schedulePublish()
  },
  { deep: true },
)

onMounted(() => {
  window.addEventListener('beforeunload', onBeforeUnload)
  if (matchId.value) {
    const pollMs = getLiveClockUpdateMs()
    publishTimer = window.setInterval(() => {
      if (hydrated.value) void publish()
    }, pollMs)
  }
})

onBeforeRouteLeave((_to, _from, next) => {
  if (skipLeaveGuard.value || !matchId.value || !hydrated.value) {
    skipLeaveGuard.value = false
    next()
    return
  }

  if (leaveModalOpen) {
    next(false)
    return
  }

  leaveModalOpen = true
  Modal.confirm({
    title: '¿Cerrar la mesa de control?',
    content:
      'Si sales, el reloj se pausará y dejarás de operar el partido. El overlay seguirá mostrando el marcador pausado. Usa «Finalizar partido» si quieres cerrarlo del todo.',
    okText: 'Salir',
    cancelText: 'Quedarme',
    okType: 'danger',
    onOk: async () => {
      skipLeaveGuard.value = true
      await finalizeOnExit()
      leaveModalOpen = false
      next()
    },
    onCancel: () => {
      leaveModalOpen = false
      next(false)
    },
  })
})

onUnmounted(() => {
  window.removeEventListener('beforeunload', onBeforeUnload)
  if (!skipLeaveGuard.value) {
    void finalizeOnExit()
  }
})
</script>

<template>
  <div class="controls">
    <header class="controls__header">
      <div>
        <h1>Mesa de control</h1>
        <p v-if="matchId" class="controls__match-id">Partido: {{ matchId }}</p>
      </div>
      <div class="controls__links">
        <router-link
          v-if="tournamentContext"
          :to="{
            name: 'tournament-board',
            params: {
              tournamentId: tournamentContext.tournamentId,
              court: tournamentContext.court,
            },
            query: { matchId },
          }"
          target="_blank"
        >
          <a-button type="primary">Abrir Marcador TV</a-button>
        </router-link>
        <router-link
          v-else
          :to="{
            name: 'board',
            query: {
              matchId,
              local: route.query.local,
              visit: route.query.visit,
              time: route.query.time,
            },
          }"
          target="_blank"
        >
          <a-button>Abrir Marcador TV</a-button>
        </router-link>
        <template v-if="tournamentContext">
          <a-button @click="copyLink('board-torneo')">
            {{ copied === 'board-torneo' ? '¡Copiado!' : 'Copiar TV torneo' }}
          </a-button>
          <a-button @click="copyLink('overlay-torneo')">
            {{ copied === 'overlay-torneo' ? '¡Copiado!' : 'Copiar OBS torneo' }}
          </a-button>
          <a-button @click="copyLink('live-torneo')">
            {{ copied === 'live-torneo' ? '¡Copiado!' : 'Copiar Live torneo' }}
          </a-button>
        </template>
        <template v-else>
          <a-button @click="copyLink('live')">
            {{ copied === 'live' ? '¡Copiado!' : 'Copiar Live' }}
          </a-button>
          <a-button @click="copyLink('overlay')">
            {{ copied === 'overlay' ? '¡Copiado!' : 'Copiar OBS' }}
          </a-button>
        </template>
      </div>
    </header>

    <a-alert
      v-if="!matchId"
      type="warning"
      message="Sin partido activo"
      description="Crea un partido desde Inicio para comenzar."
      show-icon
    />

    <a-alert
      v-else-if="!hydrated"
      type="info"
      message="Cargando partido…"
      show-icon
    />

    <div v-else class="controls__body">
      <a-tabs v-model:active-key="activeTab" class="controls__tabs">
        <a-tab-pane key="match" tab="Partido">
          <div class="controls__grid">
            <a-card title="Marcador" class="controls__card controls__card--wide">
              <div class="controls__match">
                <div class="controls__side controls__side--local">
                  <span class="controls__side-label">Local</span>
                  <a-input
                    :value="store.state.localTeam"
                    size="large"
                    :maxlength="18"
                    show-count
                    @update:value="(v: string) => store.setTeams(v, store.state.visitTeam)"
                  />
                  <a-input
                    :value="store.state.localLogo"
                    size="small"
                    placeholder="URL logo local"
                    @update:value="(v: string) => store.setTeamLogos(v, store.state.visitLogo)"
                  />
                  <div class="controls__score-controls">
                    <a-button size="large" @click="store.removeLastGoal('local')">−</a-button>
                    <span class="controls__score">{{ store.state.goalLocal }}</span>
                    <a-button type="primary" size="large" @click="markGoal('local')">+</a-button>
                  </div>
                </div>

                <div class="controls__divider" aria-hidden="true">VS</div>

                <div class="controls__side controls__side--visit">
                  <span class="controls__side-label">Visita</span>
                  <a-input
                    :value="store.state.visitTeam"
                    size="large"
                    :maxlength="18"
                    show-count
                    @update:value="(v: string) => store.setTeams(store.state.localTeam, v)"
                  />
                  <a-input
                    :value="store.state.visitLogo"
                    size="small"
                    placeholder="URL logo visita"
                    @update:value="(v: string) => store.setTeamLogos(store.state.localLogo, v)"
                  />
                  <div class="controls__score-controls">
                    <a-button size="large" @click="store.removeLastGoal('visit')">−</a-button>
                    <span class="controls__score">{{ store.state.goalVisit }}</span>
                    <a-button type="primary" size="large" @click="markGoal('visit')">+</a-button>
                  </div>
                </div>
              </div>
              <p class="controls__score-hint">
                El botón <strong>+</strong> marca el gol y captura el minuto del reloj. Completa autor y asistencia en <strong>Goles</strong>.
                Si el rival tiene una penalidad activa, se te preguntará si corresponde liberar al jugador.
              </p>
            </a-card>

            <a-card title="Reloj y periodo" class="controls__card controls__card--wide controls__card--clock">
              <div class="controls__clock">
                <div class="controls__clock-main">
                  <div class="controls__clock-display">
                    {{
                      store.state.intermissionActive
                        ? store.state.intermissionTime
                        : store.state.timeGame
                    }}
                  </div>
                  <p class="controls__clock-status">
                    <template v-if="store.state.intermissionActive">
                      {{ store.state.isPaused ? 'Descanso en pausa' : 'Descanso' }}
                    </template>
                    <template v-else>
                      {{ store.state.isPaused ? 'En pausa' : 'En juego' }}
                    </template>
                  </p>
                </div>

                <div class="controls__clock-actions">
                  <a-button
                    block
                    size="large"
                    :type="store.state.isPaused ? 'primary' : 'default'"
                    @click="store.togglePause()"
                  >
                    {{ store.state.isPaused ? 'Reanudar' : 'Pausar' }}
                  </a-button>

                  <div class="controls__clock-field">
                    <label for="controls-game-time">Ajustar tiempo</label>
                    <TimeInput
                      id="controls-game-time"
                      :value="clockDraft"
                      :disabled="!store.state.isPaused || store.state.intermissionActive"
                      @update:value="onClockDraftUpdate"
                      @focus="onClockFocus"
                      @blur="commitClockDraft"
                      @enter="commitClockDraft"
                    />
                    <span class="controls__clock-hint">
                      {{
                        store.state.intermissionActive
                          ? 'Durante el descanso usa el campo de abajo.'
                          : store.state.isPaused
                            ? 'Escribe minutos y segundos (solo números). Tab o flechas cambian de campo.'
                            : 'Pausa el reloj para ajustarlo.'
                      }}
                    </span>
                  </div>

                  <div class="controls__clock-field controls__clock-field--period">
                    <label>Periodo</label>
                    <div class="controls__clock-period">
                      <a-button @click="store.setPeriod(store.state.gamePeriod - 1)">−</a-button>
                      <span class="controls__clock-period-label">
                        {{ store.state.gamePeriod }} / {{ MAX_PERIODS }}
                      </span>
                      <a-button @click="store.setPeriod(store.state.gamePeriod + 1)">+</a-button>
                    </div>
                    <a-button
                      block
                      class="controls__next-period"
                      :disabled="!canAdvancePeriod"
                      @click="goToNextPeriod"
                    >
                      Siguiente periodo
                    </a-button>
                    <span class="controls__clock-hint">
                      Las faltas con tiempo restante continúan en el siguiente periodo.
                    </span>
                  </div>
                </div>

                <div
                  v-if="showIntermissionControls"
                  class="controls__intermission"
                >
                  <div class="controls__clock-field">
                    <label for="controls-intermission-time">Descanso</label>
                    <TimeInput
                      id="controls-intermission-time"
                      :value="intermissionDraft"
                      :disabled="store.state.intermissionActive && !store.state.isPaused"
                      @update:value="onIntermissionDraftUpdate"
                      @blur="commitIntermissionDraft"
                      @enter="commitIntermissionDraft"
                    />
                  </div>
                  <div class="controls__intermission-actions">
                    <a-button
                      type="primary"
                      @click="startOrToggleIntermission"
                    >
                      <template v-if="!store.state.intermissionActive">
                        Iniciar descanso
                      </template>
                      <template v-else-if="store.state.isPaused">
                        Reanudar descanso
                      </template>
                      <template v-else>
                        Pausar descanso
                      </template>
                    </a-button>
                    <a-button
                      v-if="store.state.intermissionActive"
                      @click="stopIntermission"
                    >
                      Terminar descanso
                    </a-button>
                  </div>
                  <span class="controls__clock-hint">
                    El marcador TV muestra la cuenta de descanso. Beep en los últimos 10 s.
                    Al terminar (o al pulsar Terminar descanso), pasa solo al siguiente periodo
                    (salvo el último). Las faltas pendientes no corren hasta entonces.
                  </span>
                </div>
              </div>
            </a-card>

            <a-card
              v-if="!tournamentContext"
              title="Partido libre"
              class="controls__card controls__card--wide"
            >
              <a-alert
                v-if="advanceError"
                type="error"
                :message="advanceError"
                show-icon
                style="margin-bottom: 0.75rem"
              />
              <p class="controls__tournament-hint">
                Solo puede haber un partido libre a la vez. Al finalizarlo podrás crear otro desde el menú.
              </p>
              <a-popconfirm
                title="¿Finalizar este partido? Dejará de aparecer en En vivo."
                ok-text="Finalizar"
                cancel-text="Cancelar"
                :disabled="finishing"
                @confirm="finishCurrentMatch"
              >
                <a-button block danger :loading="finishing">
                  Finalizar partido
                </a-button>
              </a-popconfirm>
            </a-card>

            <a-card v-if="tournamentContext" title="Torneo" class="controls__card controls__card--wide">
              <p class="controls__tournament-meta">
                Cancha {{ tournamentContext.court }}
              </p>
              <p class="controls__tournament-hint controls__tournament-hint--info">
                Los enlaces <strong>TV torneo</strong>, <strong>OBS torneo</strong> y <strong>Live torneo</strong>
                son fijos para esta cancha. El marcador TV se actualiza al instante si está en el mismo navegador;
                al pasar de partido cambia solo sin cerrar la pestaña.
              </p>
              <a-alert
                v-if="advanceError"
                type="error"
                :message="advanceError"
                show-icon
                style="margin-bottom: 0.75rem"
              />
              <a-popconfirm
                title="¿Finalizar este partido e iniciar el siguiente de la cancha?"
                ok-text="Sí, continuar"
                cancel-text="Cancelar"
                :disabled="!hasNextMatch || advancing || finishing"
                @confirm="goToNextMatch"
              >
                <a-button
                  type="primary"
                  block
                  :loading="advancing"
                  :disabled="!hasNextMatch || finishing"
                >
                  Siguiente partido
                </a-button>
              </a-popconfirm>
              <a-popconfirm
                title="¿Finalizar este partido? Dejará de aparecer en En vivo."
                ok-text="Finalizar"
                cancel-text="Cancelar"
                :disabled="advancing || finishing"
                @confirm="finishCurrentMatch"
              >
                <a-button
                  block
                  danger
                  :loading="finishing"
                  :disabled="advancing"
                  style="margin-top: 0.5rem"
                >
                  Finalizar partido
                </a-button>
              </a-popconfirm>
              <p v-if="!hasNextMatch" class="controls__tournament-hint">
                No quedan partidos programados en esta cancha. Usa Finalizar partido para cerrarlo.
              </p>
            </a-card>
          </div>
        </a-tab-pane>

        <a-tab-pane key="roster" tab="Plantillas">
          <ControlsRosterPanel />
        </a-tab-pane>

        <a-tab-pane key="goals">
          <template #tab>
            Goles
            <a-badge
              v-if="pendingGoalsCount > 0"
              :count="pendingGoalsCount"
              :number-style="{ backgroundColor: '#faad14' }"
              class="controls__tab-badge"
            />
          </template>
          <ControlsGoalsPanel />
        </a-tab-pane>

        <a-tab-pane key="penalties" tab="Penalidades">
          <ControlsPenaltiesPanel />
        </a-tab-pane>
      </a-tabs>
    </div>

    <a-modal
      v-model:open="powerPlayModalOpen"
      title="¿Liberar jugador penalizado?"
      ok-text="Liberar jugador"
      cancel-text="Mantener penalidad"
      :ok-button-props="{ disabled: !selectedPenaltyId }"
      destroy-on-close
      @ok="releasePowerPlayPenalty"
      @cancel="keepPowerPlayPenalties"
    >
      <p>
        <strong>{{ powerPlayTeamName }}</strong> tiene
        {{ powerPlayPenalties.length === 1 ? 'un jugador penalizado' : 'jugadores penalizados' }}.
        Si el gol fue en superioridad numérica, puedes terminar la penalidad y devolver al jugador.
      </p>

      <a-radio-group
        v-model:value="selectedPenaltyId"
        class="controls__power-play-list"
      >
        <a-radio
          v-for="penalty in powerPlayPenalties"
          :key="penalty.id"
          :value="penalty.id"
          class="controls__power-play-option"
        >
          {{ penaltyPlayerLabel(powerPlayTeam, penalty) }}
          · {{ penaltyTypeLabel(penalty.penaltyTypeId) }}
          · {{ penalty.time }}
          <template v-if="penalty.infraction"> · {{ penalty.infraction }}</template>
        </a-radio>
      </a-radio-group>
    </a-modal>
  </div>
</template>

<style scoped lang="scss">
.controls {
  max-width: 1100px;
  margin: 0 auto;
  padding: 1.5rem;
}

.controls__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;

  h1 { margin: 0; }
}

.controls__match-id {
  margin: 0.25rem 0 0;
  font-size: 0.85rem;
  opacity: 0.6;
}

.controls__links {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.controls__power-play-list {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  width: 100%;
  margin-top: 0.75rem;
}

.controls__power-play-option {
  display: flex !important;
  align-items: flex-start;
  white-space: normal;
  height: auto;
  line-height: 1.35;
}

.controls__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1rem;
}

.controls__card--wide {
  grid-column: 1 / -1;
}

.controls__tournament-meta {
  margin: 0 0 0.75rem;
  font-size: 0.9rem;
  opacity: 0.7;
}

.controls__tournament-hint {
  margin: 0.75rem 0 0;
  font-size: 0.8rem;
  opacity: 0.55;
  text-align: center;

  &--info {
    margin-top: 0;
    margin-bottom: 0.75rem;
    text-align: left;
    opacity: 0.7;
  }
}

.controls__match {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 1rem;
  align-items: start;
}

.controls__side {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.controls__side-label {
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  opacity: 0.55;
}

.controls__side--local .controls__side-label {
  color: #00d4ff;
}

.controls__side--visit .controls__side-label {
  color: #ff6b35;
}

.controls__divider {
  align-self: center;
  font-family: 'Bebas Neue', sans-serif;
  font-size: 1.4rem;
  letter-spacing: 0.08em;
  opacity: 0.35;
  padding-top: 2rem;
}

.controls__score-controls {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
}

.controls__score {
  font-family: 'Bebas Neue', sans-serif;
  font-size: 2.8rem;
  min-width: 2ch;
  text-align: center;
  line-height: 1;
}

.controls__score-hint {
  margin: 0.75rem 0 0;
  text-align: center;
  font-size: 0.78rem;
  opacity: 0.55;
}

.controls__tabs {
  :deep(.ant-tabs-nav) {
    margin-bottom: 1rem;

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

.controls__tab-badge {
  margin-left: 0.35rem;
}

.controls__score-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.controls__team-block {
  text-align: center;

  span {
    display: block;
    margin-bottom: 0.5rem;
    font-size: 0.85rem;
    opacity: 0.7;
  }
}

.controls__score-btns {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;

  strong {
    font-family: 'Bebas Neue', sans-serif;
    font-size: 2.5rem;
    min-width: 2ch;
  }
}

.controls__clock-display {
  font-family: 'Bebas Neue', sans-serif;
  font-size: 3.25rem;
  text-align: center;
  line-height: 1;
  margin: 0;
}

.controls__clock {
  display: grid;
  grid-template-columns: minmax(140px, 200px) 1fr;
  gap: 1.5rem;
  align-items: center;
}

.controls__clock-main {
  text-align: center;
  padding-right: 1.5rem;
  border-right: 1px solid rgba(255, 255, 255, 0.08);
}

.controls__clock-status {
  margin: 0.35rem 0 0;
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  opacity: 0.5;
}

.controls__clock-actions {
  display: grid;
  grid-template-columns: minmax(130px, 160px) minmax(140px, 200px) minmax(160px, 220px);
  gap: 0.75rem;
  align-items: end;
}

.controls__clock-field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  min-width: 0;

  label {
    font-size: 0.75rem;
    opacity: 0.6;
  }
}

.controls__clock-hint {
  font-size: 0.72rem;
  opacity: 0.5;
  line-height: 1.3;
}

.controls__clock-period {
  display: grid;
  grid-template-columns: 40px 1fr 40px;
  align-items: center;
  gap: 0.5rem;
}

.controls__next-period {
  margin-top: 0.35rem;
}

.controls__intermission {
  display: grid;
  grid-template-columns: minmax(140px, 200px) auto;
  gap: 0.75rem 1rem;
  align-items: end;
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.controls__intermission-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.controls__intermission .controls__clock-hint {
  grid-column: 1 / -1;
}

.controls__clock-period-label {
  text-align: center;
  font-size: 0.95rem;
  font-weight: 600;
  white-space: nowrap;
}

.controls__btn-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-top: 0.75rem;
}

@media (max-width: 720px) {
  .controls__match {
    grid-template-columns: 1fr;
  }

  .controls__divider {
    padding-top: 0;
    text-align: center;
  }

  .controls__clock {
    grid-template-columns: 1fr;
    gap: 1rem;
  }

  .controls__clock-main {
    padding-right: 0;
    border-right: none;
    padding-bottom: 1rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .controls__clock-actions {
    grid-template-columns: 1fr;
  }
}
</style>
