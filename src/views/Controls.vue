<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import { Modal } from 'ant-design-vue'
import { useScoreboardStore } from '@/stores/scoreboard'
import { useAuthStore } from '@/stores/auth'
import { fetchMatchState, finishMatch, publishMatchState } from '@/services/matchSync'
import {
  advanceToNextTournamentMatch,
  fetchTournament,
  fetchTournamentMatchByMatchId,
  finishTournamentMatch,
  getNextScheduledMatch,
} from '@/services/tournamentService'
import { isSupabaseConfigured } from '@/services/supabaseClient'
import { readMatchIdFromStorage, writeCourtActiveMatch, clearMatchIdFromStorage } from '@/utils/localSync'
import { normalizeGameTime, parseTimeToSeconds } from '@/utils/clock'
import { playCountdownBeep } from '@/utils/countdownBeep'
import { playLateGameWarning } from '@/utils/lateGameWarningBeep'
import {
  getCountdownBeepSeconds,
  getLateGameWarningMinutes,
  isLateGameWarningEnabled,
} from '@/utils/userPreferences'
import { buildAppUrl, tournamentBoardPath } from '@/utils/appUrl'
import { getLiveClockUpdateMs } from '@/config/poll'
import { MAX_PERIODS, isGoalPending, DEFAULT_INTERMISSION_TIME } from '@/types/hockeyScoreboard'
import type { TeamPenalty } from '@/types/hockeyScoreboard'
import { penaltyTypeLabel } from '@/data/penaltyCatalog'
import { findPlayerById, findPlayerByNumber, playerLabel } from '@/utils/roster'
import TimeInput from '@/components/controls/TimeInput.vue'
import ControlsRosterPanel from '@/components/controls/ControlsRosterPanel.vue'
import ControlsGoalsPanel from '@/components/controls/ControlsGoalsPanel.vue'
import ControlsPenaltiesPanel from '@/components/controls/ControlsPenaltiesPanel.vue'

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
const clockSectionEl = ref<HTMLElement | null>(null)
const clockDisplayEl = ref<HTMLElement | null>(null)
/** Empieza en false: en pantallas chicas el reloj suele estar fuera de vista al cargar. */
const clockInView = ref(false)
let clockObserver: IntersectionObserver | null = null
let lastCountdownBeepSecond: number | null = null
/** Evita repetir el aviso de últimos minutos en el mismo periodo/umbral. */
let lateGameWarningKey: string | null = null
let prevLateGameSeconds: number | null = null

const dockClockTime = computed(() =>
  store.state.intermissionActive
    ? store.state.intermissionTime
    : store.state.timeGame,
)

const dockClockLabel = computed(() => {
  if (store.state.intermissionActive) {
    return store.state.isPaused ? 'Descanso · pausa' : 'Descanso'
  }
  return store.state.isPaused
    ? `P${store.state.gamePeriod} · pausa`
    : `Periodo ${store.state.gamePeriod}`
})

const dockPenaltyTeams = computed(() => {
  const teams = [
    {
      key: 'local' as const,
      name: store.state.localTeam,
      penalties: store.state.penaltiesLocal,
    },
    {
      key: 'visit' as const,
      name: store.state.visitTeam,
      penalties: store.state.penaltiesVisit,
    },
  ]
  return teams
    .map((team) => ({
      ...team,
      items: team.penalties.map((penalty) => ({
        id: penalty.id,
        player: dockPenaltyPlayer(team.key, penalty),
        time: penalty.time.trim() || '0:00',
      })),
    }))
    .filter((team) => team.items.length > 0)
})

const showDockClock = computed(
  () => Boolean(matchId.value) && !clockInView.value,
)

const showDockPenalties = computed(
  () =>
    Boolean(matchId.value) &&
    dockPenaltyTeams.value.length > 0 &&
    activeTab.value !== 'penalties',
)

const showDock = computed(() => showDockClock.value || showDockPenalties.value)

function dockPenaltyPlayer(
  team: 'local' | 'visit',
  penalty: TeamPenalty,
): string {
  const roster = team === 'local' ? store.state.rosterLocal : store.state.rosterVisit
  const player =
    findPlayerById(roster, penalty.playerId) ??
    findPlayerByNumber(roster, penalty.player)
  const number = (penalty.player.trim() || player?.number.trim() || '').replace(/\D/g, '')
  if (number) return `#${number.slice(0, 2)}`
  if (player) return playerLabel(player).slice(0, 8)
  return '—'
}

function scrollToClock(): void {
  if (activeTab.value !== 'match') {
    activeTab.value = 'match'
    void nextTick(() => {
      clockSectionEl.value?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
    return
  }
  clockSectionEl.value?.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

function openPenaltiesTab(): void {
  activeTab.value = 'penalties'
}

/** Espacio superior ocupado por navbar + tabs (no cuenta como “visible”). */
function clockViewportTopInset(): number {
  const nav = document.querySelector('.app-nav')
  const tabs = document.querySelector('.controls__tabs .ant-tabs-nav')
  const navBottom = nav?.getBoundingClientRect().bottom ?? 0
  const tabsBottom = tabs?.getBoundingClientRect().bottom ?? 0
  return Math.max(navBottom, tabsBottom, 0) + 8
}

/**
 * El tiempo es visible solo si el centro del display está dentro del área
 * útil de la pantalla (debajo del navbar/tabs). Así no basta con que asome
 * el borde del card.
 */
function measureClockDisplayInView(): boolean {
  const el = clockDisplayEl.value
  if (!el) return false
  const rect = el.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) return false
  const top = clockViewportTopInset()
  const bottom = (window.innerHeight || document.documentElement.clientHeight) - 8
  const midY = rect.top + rect.height / 2
  return midY >= top && midY <= bottom
}

function syncClockInView(): void {
  clockInView.value = measureClockDisplayInView()
}

function setupClockObserver(): void {
  clockObserver?.disconnect()
  clockObserver = null
  const el = clockDisplayEl.value
  if (!el || typeof IntersectionObserver === 'undefined') {
    syncClockInView()
    return
  }

  const topInset = clockViewportTopInset()
  clockObserver = new IntersectionObserver(
    () => {
      syncClockInView()
    },
    {
      root: null,
      threshold: [0, 0.25, 0.5, 0.75, 1],
      rootMargin: `-${Math.round(topInset)}px 0px -8px 0px`,
    },
  )
  clockObserver.observe(el)
  syncClockInView()
  requestAnimationFrame(() => {
    requestAnimationFrame(syncClockInView)
  })
}

const pendingGoalsCount = computed(
  () => store.state.goals.filter((goal) => isGoalPending(goal)).length,
)

function shotCount(team: 'local' | 'visit', result: 'miss' | 'save'): number {
  return store.state.shots.filter(
    (shot) => shot.team === team && shot.result === result,
  ).length
}

const countdownBeepPrefsTick = ref(0)
const countdownBeepSeconds = computed(() => {
  countdownBeepPrefsTick.value
  return getCountdownBeepSeconds()
})
const lateGameWarningMinutes = computed(() => {
  countdownBeepPrefsTick.value
  return getLateGameWarningMinutes()
})
const lateGameWarningEnabled = computed(() => {
  countdownBeepPrefsTick.value
  return isLateGameWarningEnabled()
})

function onPrefsChange(): void {
  countdownBeepPrefsTick.value += 1
}

const goalkeeperSelection = ref<{ local: string; visit: string }>({
  local: '',
  visit: '',
})

function goalkeepersFor(team: 'local' | 'visit') {
  const roster = team === 'local' ? store.state.rosterLocal : store.state.rosterVisit
  return roster.filter((player) => player.role === 'goalkeeper')
}

function currentGoalkeeperId(team: 'local' | 'visit'): string {
  const keepers = goalkeepersFor(team)
  const selected = goalkeeperSelection.value[team]
  if (selected && keepers.some((player) => player.id === selected)) return selected
  return keepers[0]?.id ?? ''
}

function setGoalkeeper(team: 'local' | 'visit', playerId: string): void {
  goalkeeperSelection.value = { ...goalkeeperSelection.value, [team]: playerId }
}

function markSave(team: 'local' | 'visit'): void {
  store.markShot(team, 'save', currentGoalkeeperId(team))
}

function goalkeeperName(team: 'local' | 'visit'): string {
  const keeper = goalkeepersFor(team).find(
    (player) => player.id === currentGoalkeeperId(team),
  )
  return keeper ? playerLabel(keeper) : ''
}

const shotLogByTeam = computed(() => [
  {
    key: 'local' as const,
    label: 'Local',
    shots: [...store.state.shots]
      .filter((shot) => shot.team === 'local')
      .reverse()
      .map((shot) => ({
        ...shot,
        resultLabel: shot.result === 'save' ? 'Atajada' : 'Tiro',
      })),
  },
  {
    key: 'visit' as const,
    label: 'Visita',
    shots: [...store.state.shots]
      .filter((shot) => shot.team === 'visit')
      .reverse()
      .map((shot) => ({
        ...shot,
        resultLabel: shot.result === 'save' ? 'Atajada' : 'Tiro',
      })),
  },
])

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

const intermissionDraft = ref(
  store.state.intermissionDuration || DEFAULT_INTERMISSION_TIME,
)

watch(
  () => store.state.intermissionActive,
  (active) => {
    if (!active) {
      intermissionDraft.value =
        store.state.intermissionDuration || DEFAULT_INTERMISSION_TIME
    }
  },
)

watch(
  () => [store.state.intermissionTime, store.state.intermissionDuration] as const,
  ([time, duration]) => {
    if (store.state.intermissionActive) {
      intermissionDraft.value = time
    } else {
      intermissionDraft.value = duration || DEFAULT_INTERMISSION_TIME
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
      intermissionTime: store.state.intermissionDuration || DEFAULT_INTERMISSION_TIME,
      isPaused: true,
    })
  }

  clockDraft.value = store.state.timeGame
  intermissionDraft.value =
    store.state.intermissionDuration || DEFAULT_INTERMISSION_TIME
}

function startOrToggleIntermission(): void {
  if (store.state.intermissionActive) {
    store.togglePause()
    return
  }
  const duration =
    intermissionDraft.value.trim() ||
    store.state.intermissionDuration ||
    DEFAULT_INTERMISSION_TIME
  intermissionDraft.value = duration
  store.startIntermission(duration)
}

function onIntermissionDraftUpdate(value: string): void {
  intermissionDraft.value = value
}

function commitIntermissionDraft(): void {
  const normalized =
    intermissionDraft.value.trim() ||
    store.state.intermissionDuration ||
    DEFAULT_INTERMISSION_TIME
  store.setIntermissionTime(normalized)
  intermissionDraft.value = store.state.intermissionActive
    ? store.state.intermissionTime
    : store.state.intermissionDuration
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
      intermissionTime: store.state.intermissionDuration || DEFAULT_INTERMISSION_TIME,
      isPaused: true,
    })
  }
  clockDraft.value = store.state.timeGame
  intermissionDraft.value =
    store.state.intermissionDuration || DEFAULT_INTERMISSION_TIME
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
    const threshold = getCountdownBeepSeconds()
    if (seconds < 0 || seconds > threshold) {
      lastCountdownBeepSecond = null
      return
    }
    if (lastCountdownBeepSecond === seconds) return
    lastCountdownBeepSecond = seconds
    void playCountdownBeep(seconds === 0)
  },
)

watch(
  () => ({
    seconds: parseTimeToSeconds(store.state.timeGame),
    period: store.state.gamePeriod,
    paused: store.state.isPaused,
    intermission: store.state.intermissionActive,
    enabled: lateGameWarningEnabled.value,
    minutes: lateGameWarningMinutes.value,
  }),
  ({ seconds, period, paused, intermission, enabled, minutes }) => {
    const threshold = minutes * 60
    const prev = prevLateGameSeconds
    prevLateGameSeconds = seconds

    if (!enabled || paused || intermission || seconds < 0) return

    // Solo al cruzar el umbral (p. ej. 2:01 → 2:00), no al cargar la mesa ya dentro.
    const crossed = prev != null && prev > threshold && seconds <= threshold
    if (!crossed) return

    const key = `${period}:${threshold}`
    if (lateGameWarningKey === key) return
    lateGameWarningKey = key
    void playLateGameWarning()
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
    const threshold = getCountdownBeepSeconds()
    if (seconds < 0 || seconds > threshold) {
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

async function loadTournamentContext(id: string): Promise<boolean> {
  tournamentContext.value = null
  hasNextMatch.value = false

  if (!isSupabaseConfigured) return true

  try {
    const record = await fetchMatchState(id)
    if (!record?.tournament_id || !record.court) return true

    const tournament = await fetchTournament(record.tournament_id)
    if (tournament?.status === 'finished') {
      Modal.warning({
        title: 'Torneo finalizado',
        content: 'No se pueden abrir los controles de un torneo finalizado.',
      })
      skipLeaveGuard.value = true
      await router.replace({
        name: 'tournament-detail',
        params: { id: record.tournament_id },
      })
      return false
    }

    tournamentContext.value = {
      tournamentId: record.tournament_id,
      court: record.court,
    }
    writeCourtActiveMatch(record.tournament_id, record.court, id)
    const next = await getNextScheduledMatch(record.tournament_id, record.court)
    hasNextMatch.value = Boolean(next)
    return true
  } catch {
    tournamentContext.value = null
    return true
  }
}

async function initMatch(id: string): Promise<void> {
  hydrated.value = false
  advanceError.value = null
  await store.hydrateMatch(id, matchFallback.value)
  const allowed = await loadTournamentContext(id)
  if (!allowed) return
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

type LinkType = 'live' | 'overlay' | 'board-torneo'

function copyLink(type: LinkType): void {
  let path = ''

  if (type === 'board-torneo' && tournamentContext.value) {
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
    shots: store.state.shots,
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
  window.addEventListener('scoreboard:prefs-change', onPrefsChange)
  window.addEventListener('resize', syncClockInView, { passive: true })
  window.addEventListener('scroll', syncClockInView, { passive: true, capture: true })
  if (matchId.value) {
    const pollMs = getLiveClockUpdateMs()
    publishTimer = window.setInterval(() => {
      if (hydrated.value) void publish()
    }, pollMs)
  }
  void nextTick(setupClockObserver)
})

watch(activeTab, () => {
  void nextTick(setupClockObserver)
})

watch(matchId, () => {
  void nextTick(setupClockObserver)
})

watch(hydrated, (ready) => {
  if (ready) void nextTick(setupClockObserver)
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
  window.removeEventListener('scoreboard:prefs-change', onPrefsChange)
  window.removeEventListener('resize', syncClockInView)
  window.removeEventListener('scroll', syncClockInView)
  clockObserver?.disconnect()
  clockObserver = null
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
          <a-button type="primary">Abrir TV local</a-button>
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
          <a-button>Abrir TV local</a-button>
        </router-link>
        <template v-if="tournamentContext">
          <a-button @click="copyLink('board-torneo')">
            {{ copied === 'board-torneo' ? '¡Copiado!' : 'Copiar TV remoto' }}
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
                  <a-input
                    :value="store.state.localColor"
                    type="color"
                    size="small"
                    class="controls__color"
                    @update:value="(v: string) => store.setTeamColors(v, store.state.visitColor)"
                  />
                  <div class="controls__score-controls">
                    <a-button size="large" @click="store.removeLastGoal('local')">−</a-button>
                    <span class="controls__score">{{ store.state.goalLocal }}</span>
                    <a-button type="primary" size="large" @click="markGoal('local')">+</a-button>
                  </div>
                  <div class="controls__shot-rows">
                    <div class="controls__shot-row">
                      <span class="controls__shot-label">Tiro</span>
                      <div class="controls__shot-controls">
                        <a-button
                          size="small"
                          :disabled="shotCount('local', 'miss') === 0"
                          @click="store.removeLastShot('local', 'miss')"
                        >
                          −
                        </a-button>
                        <span class="controls__shot-count">{{ shotCount('local', 'miss') }}</span>
                        <a-button
                          size="small"
                          type="primary"
                          @click="store.markShot('local', 'miss')"
                        >
                          +
                        </a-button>
                      </div>
                    </div>
                    <div class="controls__shot-row">
                      <span class="controls__shot-label">Atajada (arquero)</span>
                      <div class="controls__shot-controls">
                        <a-button
                          size="small"
                          :disabled="shotCount('local', 'save') === 0"
                          @click="store.removeLastShot('local', 'save')"
                        >
                          −
                        </a-button>
                        <span class="controls__shot-count">{{ shotCount('local', 'save') }}</span>
                        <a-button
                          size="small"
                          type="primary"
                          @click="markSave('local')"
                        >
                          +
                        </a-button>
                      </div>
                    </div>
                    <div class="controls__goalkeeper">
                      <a-select
                        v-if="goalkeepersFor('local').length > 1"
                        size="small"
                        class="controls__goalkeeper-select"
                        :value="currentGoalkeeperId('local')"
                        @update:value="(v: string) => setGoalkeeper('local', v)"
                      >
                        <a-select-option
                          v-for="keeper in goalkeepersFor('local')"
                          :key="keeper.id"
                          :value="keeper.id"
                        >
                          {{ playerLabel(keeper) }}
                        </a-select-option>
                      </a-select>
                      <span v-else class="controls__goalkeeper-hint">
                        {{
                          goalkeeperName('local')
                            ? `Atajadas para ${goalkeeperName('local')}`
                            : 'Sin arquero en la nómina'
                        }}
                      </span>
                    </div>
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
                  <a-input
                    :value="store.state.visitColor"
                    type="color"
                    size="small"
                    class="controls__color"
                    @update:value="(v: string) => store.setTeamColors(store.state.localColor, v)"
                  />
                  <div class="controls__score-controls">
                    <a-button size="large" @click="store.removeLastGoal('visit')">−</a-button>
                    <span class="controls__score">{{ store.state.goalVisit }}</span>
                    <a-button type="primary" size="large" @click="markGoal('visit')">+</a-button>
                  </div>
                  <div class="controls__shot-rows">
                    <div class="controls__shot-row">
                      <span class="controls__shot-label">Tiro</span>
                      <div class="controls__shot-controls">
                        <a-button
                          size="small"
                          :disabled="shotCount('visit', 'miss') === 0"
                          @click="store.removeLastShot('visit', 'miss')"
                        >
                          −
                        </a-button>
                        <span class="controls__shot-count">{{ shotCount('visit', 'miss') }}</span>
                        <a-button
                          size="small"
                          type="primary"
                          @click="store.markShot('visit', 'miss')"
                        >
                          +
                        </a-button>
                      </div>
                    </div>
                    <div class="controls__shot-row">
                      <span class="controls__shot-label">Atajada (arquero)</span>
                      <div class="controls__shot-controls">
                        <a-button
                          size="small"
                          :disabled="shotCount('visit', 'save') === 0"
                          @click="store.removeLastShot('visit', 'save')"
                        >
                          −
                        </a-button>
                        <span class="controls__shot-count">{{ shotCount('visit', 'save') }}</span>
                        <a-button
                          size="small"
                          type="primary"
                          @click="markSave('visit')"
                        >
                          +
                        </a-button>
                      </div>
                    </div>
                    <div class="controls__goalkeeper">
                      <a-select
                        v-if="goalkeepersFor('visit').length > 1"
                        size="small"
                        class="controls__goalkeeper-select"
                        :value="currentGoalkeeperId('visit')"
                        @update:value="(v: string) => setGoalkeeper('visit', v)"
                      >
                        <a-select-option
                          v-for="keeper in goalkeepersFor('visit')"
                          :key="keeper.id"
                          :value="keeper.id"
                        >
                          {{ playerLabel(keeper) }}
                        </a-select-option>
                      </a-select>
                      <span v-else class="controls__goalkeeper-hint">
                        {{
                          goalkeeperName('visit')
                            ? `Atajadas para ${goalkeeperName('visit')}`
                            : 'Sin arquero en la nómina'
                        }}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              <p class="controls__score-hint">
                El botón <strong>+</strong> marca el gol y captura el minuto del reloj. Completa autor y asistencia en <strong>Goles</strong>.
                <strong>Tiro</strong> = al arco sin contacto del arquero.
                <strong>Atajada</strong> = el arquero de ese equipo detuvo el tiro.
                Si el rival tiene una penalidad activa, se te preguntará si corresponde liberar al jugador.
              </p>
              <div
                v-if="store.state.shots.length"
                class="controls__shot-log-grid"
              >
                <article
                  v-for="team in shotLogByTeam"
                  :key="team.key"
                  class="controls__shot-log-card"
                  :class="`controls__shot-log-card--${team.key}`"
                >
                  <header class="controls__shot-log-head">
                    <h4>{{ team.label }}</h4>
                    <span>
                      {{ shotCount(team.key, 'miss') }} tiros ·
                      {{ shotCount(team.key, 'save') }} atajadas
                    </span>
                  </header>
                  <ul v-if="team.shots.length" class="controls__shot-log">
                    <li v-for="shot in team.shots" :key="shot.id">
                      <span class="controls__shot-log-text">
                        {{ shot.resultLabel }} · P{{ shot.period }} {{ shot.gameMinute }}
                      </span>
                      <a-popconfirm
                        :title="`¿Eliminar este registro de ${shot.resultLabel.toLowerCase()}? No se puede deshacer.`"
                        ok-text="Eliminar"
                        cancel-text="Cancelar"
                        :ok-button-props="{ danger: true }"
                        placement="topRight"
                        @confirm="store.removeShot(shot.id)"
                      >
                        <button
                          type="button"
                          class="controls__shot-log-remove"
                          :aria-label="`Eliminar ${shot.resultLabel} de P${shot.period} ${shot.gameMinute}`"
                          title="Eliminar registro"
                        >
                          ×
                        </button>
                      </a-popconfirm>
                    </li>
                  </ul>
                  <p v-else class="controls__shot-log-empty">Sin registros</p>
                </article>
              </div>
            </a-card>

            <div ref="clockSectionEl" class="controls__clock-section">
              <a-card
                title="Reloj y periodo"
                class="controls__card controls__card--wide controls__card--clock"
              >
                <div class="controls__clock">
                  <div class="controls__clock-main">
                    <div ref="clockDisplayEl" class="controls__clock-display">
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
                    <a-button
                      class="controls__clock-toggle"
                      size="large"
                      :type="store.state.isPaused ? 'primary' : 'default'"
                      @click="store.togglePause()"
                    >
                      {{ store.state.isPaused ? 'Reanudar' : 'Pausar' }}
                    </a-button>
                  </div>

                  <div class="controls__clock-panels">
                    <div class="controls__clock-field controls__clock-field--time">
                      <div class="controls__clock-field-head">
                        <label for="controls-game-time">Ajustar tiempo</label>
                        <TimeInput
                          id="controls-game-time"
                          compact
                          :value="clockDraft"
                          :disabled="!store.state.isPaused || store.state.intermissionActive"
                          @update:value="onClockDraftUpdate"
                          @focus="onClockFocus"
                          @blur="commitClockDraft"
                          @enter="commitClockDraft"
                        />
                      </div>
                      <span class="controls__clock-hint">
                        {{
                          store.state.intermissionActive
                            ? 'Durante el descanso usa el campo de abajo.'
                            : store.state.isPaused
                              ? 'Escribe minutos y segundos (solo números). Tab o flechas cambian de campo.'
                              : 'Pausa el reloj para ajustarlo.'
                        }}
                        <template v-if="lateGameWarningEnabled && !store.state.intermissionActive">
                          Aviso a los {{ lateGameWarningMinutes }} min
                          (Perfil).
                        </template>
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
                    <div class="controls__clock-field controls__clock-field--time">
                      <div class="controls__clock-field-head">
                        <label for="controls-intermission-time">Descanso</label>
                        <TimeInput
                          id="controls-intermission-time"
                          compact
                          :value="intermissionDraft"
                          :disabled="store.state.intermissionActive && !store.state.isPaused"
                          @update:value="onIntermissionDraftUpdate"
                          @blur="commitIntermissionDraft"
                          @enter="commitIntermissionDraft"
                        />
                      </div>
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
                      El marcador TV muestra la cuenta de descanso.
                      Beep en los últimos {{ countdownBeepSeconds }} s
                      (configurable en Perfil).
                      Al terminar (o al pulsar Terminar descanso), pasa solo al siguiente periodo
                      (salvo el último). Las faltas pendientes no corren hasta entonces.
                    </span>
                  </div>
                </div>
              </a-card>
            </div>

            <a-card
              title="Árbitros y mesa"
              class="controls__card controls__card--wide"
            >
              <div class="controls__officials">
                <label class="controls__officials-field">
                  <span>Árbitro 1</span>
                  <a-input
                    :value="store.state.referee1"
                    placeholder="Nombre"
                    :maxlength="40"
                    allow-clear
                    @update:value="(v: string) => store.patch({ referee1: v })"
                  />
                </label>
                <label class="controls__officials-field">
                  <span>Árbitro 2</span>
                  <a-input
                    :value="store.state.referee2"
                    placeholder="Nombre"
                    :maxlength="40"
                    allow-clear
                    @update:value="(v: string) => store.patch({ referee2: v })"
                  />
                </label>
                <label class="controls__officials-field">
                  <span>Mesa 1</span>
                  <a-input
                    :value="store.state.tableOfficial1"
                    placeholder="Nombre"
                    :maxlength="40"
                    allow-clear
                    @update:value="(v: string) => store.patch({ tableOfficial1: v })"
                  />
                </label>
                <label class="controls__officials-field">
                  <span>Mesa 2</span>
                  <a-input
                    :value="store.state.tableOfficial2"
                    placeholder="Nombre"
                    :maxlength="40"
                    allow-clear
                    @update:value="(v: string) => store.patch({ tableOfficial2: v })"
                  />
                </label>
                <label class="controls__officials-field">
                  <span>Mesa 3</span>
                  <a-input
                    :value="store.state.tableOfficial3"
                    placeholder="Opcional"
                    :maxlength="40"
                    allow-clear
                    @update:value="(v: string) => store.patch({ tableOfficial3: v })"
                  />
                </label>
              </div>
              <p class="controls__tournament-hint">
                Quedan guardados con el partido y salen en el informe Excel.
              </p>
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
                El enlace <strong>TV remoto</strong> es fijo para esta cancha.
                El marcador TV se actualiza al instante si está en el mismo navegador;
                al pasar de partido cambia solo sin cerrar la pestaña.
                Los enlaces OBS y Live están en Configuración del torneo.
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

        <a-tab-pane key="roster" tab="Nómina">
          <ControlsRosterPanel
            :tournament-id="tournamentContext?.tournamentId ?? null"
            :sync-enabled="hydrated && Boolean(tournamentContext)"
          />
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

    <Transition name="controls-dock">
      <div
        v-if="showDock"
        class="controls__dock"
        :class="{ 'controls__dock--with-penalties': showDockPenalties }"
      >
        <aside
          v-if="showDockClock"
          class="controls__dock-clock"
          :class="{
            'controls__dock-clock--paused': store.state.isPaused,
            'controls__dock-clock--intermission': store.state.intermissionActive,
          }"
          role="status"
          aria-live="polite"
          title="Ir al reloj"
          tabindex="0"
          @click="scrollToClock"
          @keydown.enter="scrollToClock"
        >
          <span class="controls__dock-clock-label">{{ dockClockLabel }}</span>
          <span class="controls__dock-clock-time">{{ dockClockTime }}</span>
        </aside>

        <aside
          v-if="showDockPenalties"
          class="controls__dock-penalties"
          aria-label="Penalidades activas"
        >
          <header class="controls__dock-penalties-head">
            <span>Faltas</span>
            <button
              type="button"
              class="controls__dock-penalties-link"
              @click="openPenaltiesTab"
            >
              Ver
            </button>
          </header>
          <div
            v-for="team in dockPenaltyTeams"
            :key="team.key"
            class="controls__dock-penalties-team"
            :class="`controls__dock-penalties-team--${team.key}`"
          >
            <span class="controls__dock-penalties-side" :title="team.name">
              {{ team.name }}
            </span>
            <ul class="controls__dock-penalties-list">
              <li v-for="item in team.items" :key="item.id">
                <span class="controls__dock-penalties-player">{{ item.player }}</span>
                <span class="controls__dock-penalties-time">{{ item.time }}</span>
              </li>
            </ul>
          </div>
        </aside>
      </div>
    </Transition>
  </div>
</template>

<style scoped lang="scss">
.controls {
  max-width: 1100px;
  margin: 0 auto;
  padding: 1.5rem;
}

.controls__clock-section {
  grid-column: 1 / -1;
  min-width: 0;
}

/* Dock fijo en el margen derecho (reloj + faltas). */
.controls__dock {
  --dock-width: 6.4rem;

  position: fixed;
  z-index: 220;
  top: 50%;
  transform: translateY(-50%);
  right: max(
    0.75rem,
    calc((100vw - 1100px) / 2 - var(--dock-width) - 0.85rem)
  );
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  width: var(--dock-width);
  max-height: min(70vh, 28rem);

  &--with-penalties {
    --dock-width: 9rem;
  }
}

.controls__dock-clock {
  box-sizing: border-box;
  width: 100%;
  padding: 0.7rem 0.55rem 0.75rem;
  border-radius: 12px;
  border: 1px solid var(--app-border);
  background: var(--app-bg-elevated);
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.22);
  text-align: center;
  cursor: pointer;
  user-select: none;

  &:hover {
    border-color: color-mix(in srgb, var(--app-link) 45%, var(--app-border));
  }

  &:focus-visible {
    outline: 2px solid var(--app-link);
    outline-offset: 2px;
  }

  &--paused .controls__dock-clock-time {
    opacity: 0.72;
  }

  &--intermission .controls__dock-clock-time {
    color: #c9a227;
  }
}

.controls__dock-clock-label {
  display: block;
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--app-text-muted);
  line-height: 1.2;
  margin-bottom: 0.35rem;
}

.controls__dock-clock-time {
  display: block;
  font-family: 'Bebas Neue', sans-serif;
  font-size: 1.85rem;
  line-height: 1;
  letter-spacing: 0.04em;
  font-variant-numeric: tabular-nums;
  color: var(--app-text);
}

.controls__dock-penalties {
  box-sizing: border-box;
  width: 100%;
  min-height: 0;
  overflow: auto;
  padding: 0.55rem 0.5rem 0.6rem;
  border-radius: 12px;
  border: 1px solid var(--app-border);
  background: var(--app-bg-elevated);
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.18);
}

.controls__dock-penalties-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.35rem;
  margin-bottom: 0.45rem;
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--app-text-muted);
}

.controls__dock-penalties-link {
  border: 0;
  padding: 0;
  background: none;
  color: var(--app-link);
  font: inherit;
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  cursor: pointer;

  &:hover {
    text-decoration: underline;
  }
}

.controls__dock-penalties-team {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  min-width: 0;

  & + & {
    margin-top: 0.45rem;
    padding-top: 0.45rem;
    border-top: 1px solid var(--app-border);
  }

  &--local .controls__dock-penalties-side {
    color: #3da5ff;
  }

  &--visit .controls__dock-penalties-side {
    color: #ff5a36;
  }
}

.controls__dock-penalties-side {
  font-size: 0.68rem;
  font-weight: 800;
  line-height: 1.2;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.controls__dock-penalties-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  min-width: 0;

  li {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.3rem;
    min-width: 0;
  }
}

.controls__dock-penalties-player {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.72rem;
  font-weight: 650;
  color: var(--app-text);
}

.controls__dock-penalties-time {
  flex-shrink: 0;
  font-family: 'Bebas Neue', sans-serif;
  font-size: 0.95rem;
  line-height: 1;
  letter-spacing: 0.03em;
  font-variant-numeric: tabular-nums;
  color: #ff4d5e;
}

.controls-dock-enter-active,
.controls-dock-leave-active {
  transition:
    opacity 0.18s ease,
    transform 0.18s ease;
}

.controls-dock-enter-from,
.controls-dock-leave-to {
  opacity: 0;
  transform: translateY(-50%) translateX(0.6rem);
}

@media (max-width: 1280px) {
  .controls__dock {
    top: auto;
    bottom: max(1rem, env(safe-area-inset-bottom));
    right: max(0.75rem, env(safe-area-inset-right));
    transform: none;
    max-height: min(55vh, 24rem);
  }

  .controls-dock-enter-from,
  .controls-dock-leave-to {
    transform: translateY(0.6rem);
  }
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

.controls__officials {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 0.75rem 1rem;
}

.controls__officials-field {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  min-width: 0;
}

.controls__officials-field > span {
  font-size: 0.8rem;
  opacity: 0.7;
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
  padding: 0.85rem 0.9rem;
  border-radius: 10px;
  background: var(--app-surface);
  border: 1px solid var(--app-border);
}

.controls__side--local {
  border-top: 2px solid rgba(0, 212, 255, 0.5);
}

.controls__side--visit {
  border-top: 2px solid rgba(255, 107, 53, 0.5);
}

.controls__color {
  width: 100%;
  max-width: 4.5rem;
  height: 2rem;
  padding: 0.15rem;
  cursor: pointer;
}

.controls__side-label {
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  opacity: 0.55;
}

.controls__side--local .controls__side-label {
  color: var(--app-link);
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

.controls__shot-rows {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  margin-top: 0.65rem;
  width: 100%;
}

.controls__shot-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.controls__shot-label {
  font-size: 0.78rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  opacity: 0.65;
  min-width: 4.5rem;
}

.controls__goalkeeper {
  display: flex;
  justify-content: flex-end;
}

.controls__goalkeeper-select {
  min-width: 60%;
  max-width: 100%;
}

.controls__goalkeeper-hint {
  font-size: 0.72rem;
  opacity: 0.5;
  text-align: right;
}

.controls__shot-controls {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.controls__shot-count {
  font-family: 'Bebas Neue', sans-serif;
  font-size: 1.35rem;
  min-width: 1.5ch;
  text-align: center;
  line-height: 1;
}

.controls__shot-log-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
  margin-top: 0.85rem;

  @media (max-width: 640px) {
    grid-template-columns: 1fr;
  }
}

.controls__shot-log-card {
  padding: 0.7rem 0.8rem;
  border-radius: 8px;
  background: var(--app-surface);
  border: 1px solid var(--app-border);
  min-width: 0;

  &--local {
    border-top: 2px solid rgba(0, 212, 255, 0.45);
  }

  &--visit {
    border-top: 2px solid rgba(255, 107, 53, 0.45);
  }
}

.controls__shot-log-head {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  margin-bottom: 0.5rem;

  h4 {
    margin: 0;
    font-size: 0.88rem;
    font-weight: 650;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  span {
    font-size: 0.72rem;
    opacity: 0.55;
  }
}

.controls__shot-log {
  margin: 0;
  padding: 0 0.35rem 0 0;
  list-style: none;
  font-size: 0.78rem;
  opacity: 0.8;
  display: flex;
  flex-direction: column;
  gap: 0.28rem;
  max-height: 9rem;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-gutter: stable;

  li {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.4rem;
  }
}

.controls__shot-log-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.controls__shot-log-remove {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.15rem;
  height: 1.15rem;
  padding: 0;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: inherit;
  font-size: 0.95rem;
  line-height: 1;
  opacity: 0.45;
  cursor: pointer;
  transition: opacity 0.15s ease, background 0.15s ease, color 0.15s ease;

  &:hover,
  &:focus-visible {
    opacity: 1;
    background: rgba(255, 77, 79, 0.16);
    color: #ff7875;
  }
}

.controls__shot-log-empty {
  margin: 0;
  font-size: 0.78rem;
  opacity: 0.45;
}

.controls__tabs {
  :deep(.ant-tabs-nav) {
    margin-bottom: 1rem;

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
  font-size: clamp(2.8rem, 4vw, 3.6rem);
  text-align: center;
  line-height: 1;
  margin: 0;
  letter-spacing: 0.04em;
  font-variant-numeric: tabular-nums;
}

.controls__clock {
  display: grid;
  grid-template-columns: minmax(180px, 240px) minmax(0, 1fr);
  gap: 1.25rem 1.75rem;
  align-items: stretch;
}

.controls__clock-main {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.65rem;
  padding: 1rem 1.25rem;
  border-radius: 12px;
  background: var(--app-surface);
  border: 1px solid var(--app-border);
  text-align: center;
}

.controls__clock-status {
  margin: 0;
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  opacity: 0.55;
}

.controls__clock-toggle {
  width: min(100%, 9.5rem);
  margin-top: 0.25rem;
}

.controls__clock-panels {
  display: grid;
  grid-template-columns: minmax(11rem, 14rem) minmax(0, 1fr);
  gap: 1rem;
  align-items: stretch;
  min-width: 0;
}

.controls__clock-field {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.55rem;
  min-width: 0;
  height: 100%;
  padding: 0.9rem 1rem;
  border-radius: 12px;
  background: var(--app-surface);
  border: 1px solid var(--app-border);
  text-align: center;

  label {
    font-size: 0.75rem;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    opacity: 0.6;
  }
}

.controls__clock-field-head {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.55rem;
}

.controls__clock-field--time {
  .controls__clock-field-head {
    flex-direction: column;
    align-items: center;
  }
}

.controls__clock-hint {
  max-width: 18rem;
  margin-top: 0.15rem;
  font-size: 0.72rem;
  opacity: 0.5;
  line-height: 1.35;
  text-align: center;
}

.controls__clock-period {
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr) 40px;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  max-width: 11rem;
}

.controls__next-period {
  margin-top: 0.15rem;
  width: 100%;
  max-width: 12rem;
}

.controls__intermission {
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: auto auto;
  justify-content: center;
  justify-items: center;
  gap: 0.85rem 1.5rem;
  align-items: center;
  margin-top: 0.15rem;
  padding: 0.85rem 1rem;
  border-radius: 12px;
  background: var(--app-surface);
  border: 1px solid var(--app-border);
  text-align: center;

  .controls__clock-field {
    padding: 0;
    background: transparent;
    border: none;
    height: auto;
  }

  .controls__clock-field-head {
    flex-direction: column;
    align-items: center;
  }
}

.controls__intermission-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
  justify-content: center;
}

.controls__intermission .controls__clock-hint {
  grid-column: 1 / -1;
  margin-top: 0;
  max-width: 36rem;
}

.controls__clock-period-label {
  text-align: center;
  font-size: 1rem;
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

@media (max-width: 900px) {
  .controls__clock {
    grid-template-columns: 1fr;
  }

  .controls__clock-panels {
    grid-template-columns: minmax(10rem, 13rem) minmax(0, 1fr);
  }
}

@media (max-width: 720px) {
  .controls__match {
    grid-template-columns: 1fr;
  }

  .controls__divider {
    padding-top: 0;
    text-align: center;
  }

  .controls__clock-panels {
    grid-template-columns: 1fr;
  }

  .controls__clock-period,
  .controls__next-period {
    max-width: none;
  }

  .controls__intermission {
    grid-template-columns: 1fr;
  }
}
</style>
