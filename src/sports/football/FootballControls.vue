<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import TimeInput from '@/components/controls/TimeInput.vue'
import ControlsShell from '@/components/controls/ControlsShell.vue'
import ControlsClockDock from '@/components/controls/ControlsClockDock.vue'
import ControlsMatchEndCard from '@/components/controls/ControlsMatchEndCard.vue'
import ControlsOperatorLinks from '@/components/controls/ControlsOperatorLinks.vue'
import { getSportModule } from '@/sports/registry'
import { isPeriodPlayFinished, isStoppagePlay, periodEndClockSeconds } from '@/sports/clockRules'
import { useMatchOperatorSession } from '@/composables/useMatchOperatorSession'
import { useControlsClockDock } from '@/composables/useControlsClockDock'
import { useMatchClockAlerts } from '@/composables/useMatchClockAlerts'
import FootballRosterPanel from '@/sports/football/controls/FootballRosterPanel.vue'
import FootballSideSwitch from '@/sports/football/controls/FootballSideSwitch.vue'
import HockeyGoalsPanel from '@/sports/hockey/controls/HockeyGoalsPanel.vue'
import {
  addFootballCard,
  cardCount,
  clampFootballStoppage,
  footballStoppageMinutes,
  isPlayerExpelled,
  playerYellowCount,
  undoLastFootballCard,
} from '@/sports/football/actions'
import {
  FOOTBALL_CARD_LABELS,
  FOOTBALL_EXTRA_PERIODS,
  FOOTBALL_EXTRA_TIME,
  FOOTBALL_HALF_TIME,
  FOOTBALL_MAX_PERIODS,
  FOOTBALL_MAX_STOPPAGE_MINUTES,
  FOOTBALL_PERIODS,
  type FootballCardKind,
} from '@/sports/football/types'
import { isGoalPending } from '@/sports/scoreboardState'
import { normalizeFootballExtraTime, normalizeFootballPeriodLength } from '@/sports/football/state'
import { formatSecondsToTime, parseTimeToSeconds } from '@/utils/clock'
import { findPlayerById, playerLabel } from '@/utils/roster'
import { message } from 'ant-design-vue'

const {
  store,
  matchId,
  copied,
  hydrated,
  advancing,
  finishing,
  advanceError,
  tournamentContext,
  hasNextMatch,
  goToNextMatch,
  finishCurrentMatch,
  copyLink,
} = useMatchOperatorSession()

const sport = computed(() => getSportModule('football'))
const activeTab = ref('match')
const mobileSide = ref<'local' | 'visit'>('local')
const clockSectionEl = ref<HTMLElement | null>(null)
const clockDisplayEl = ref<HTMLElement | null>(null)
const {
  dockClockTime,
  dockClockLabel,
  showDockClock,
  scrollToClock,
  setupClockObserver,
} = useControlsClockDock({ activeTab, matchId, clockSectionEl, clockDisplayEl })
const { countdownBeepSeconds, lateGameWarningMinutes, lateGameWarningEnabled } =
  useMatchClockAlerts()

const clockDraft = ref(store.state.timeGame)
const clockEditing = ref(false)
const intermissionDraft = ref(
  store.state.intermissionDuration || sport.value.clock.intermissionDefault,
)
const maxPeriods = computed(() => FOOTBALL_MAX_PERIODS)
const periodIndexLabel = computed(() => {
  const period = store.state.gamePeriod
  if (period > FOOTBALL_PERIODS) {
    return `${period - FOOTBALL_PERIODS}/${FOOTBALL_EXTRA_PERIODS}`
  }
  return `${period}/${FOOTBALL_PERIODS}`
})

const selectedCardPlayer = ref<{ local: string; visit: string }>({ local: '', visit: '' })

const pendingGoalsCount = computed(
  () => store.state.goals.filter((goal) => isGoalPending(goal)).length,
)

const restBreakConsumed = ref(false)

const showIntermissionControls = computed(() => {
  const restSeconds = parseTimeToSeconds(store.state.intermissionTime)
  if (store.state.intermissionActive) return restSeconds > 0
  if (restBreakConsumed.value) return false
  if (store.state.gamePeriod >= maxPeriods.value) return false
  return isPeriodPlayFinished(store.state)
})

const canAdjustGameClock = computed(
  () => store.state.isPaused && !showIntermissionControls.value,
)

const canEditPeriodLength = computed(
  () =>
    store.state.gamePeriod === 1 &&
    store.state.isPaused &&
    !store.state.intermissionActive,
)

const canEditExtraTime = computed(
  () => store.state.isPaused && !store.state.intermissionActive,
)

const periodLengthMinutes = computed(() =>
  Math.floor(
    parseTimeToSeconds(store.state.footballPeriodLength || FOOTBALL_HALF_TIME) /
      60,
  ),
)

const extraTimeMinutes = computed(() =>
  Math.floor(
    parseTimeToSeconds(store.state.footballExtraTimeLength || FOOTBALL_EXTRA_TIME) /
      60,
  ),
)

const periodLengthEditing = ref(false)
const periodLengthDraft = ref(String(periodLengthMinutes.value))
const extraTimeEditing = ref(false)
const extraTimeDraft = ref(String(extraTimeMinutes.value))

watch(
  periodLengthMinutes,
  (minutes) => {
    if (!periodLengthEditing.value) periodLengthDraft.value = String(minutes)
  },
)

watch(
  extraTimeMinutes,
  (minutes) => {
    if (!extraTimeEditing.value) extraTimeDraft.value = String(minutes)
  },
)

watch(
  () =>
    [
      store.state.timeGame,
      store.state.footballStoppageMinutes,
      store.state.footballPeriodLength,
    ] as const,
  ([time]) => {
    if (!clockEditing.value) clockDraft.value = time
    if (!isPeriodPlayFinished(store.state)) restBreakConsumed.value = false
  },
)

watch(
  () => store.state.intermissionActive,
  (active, wasActive) => {
    if (wasActive && !active) {
      restBreakConsumed.value = true
      clockEditing.value = false
      clockDraft.value = store.state.timeGame
      void nextTick(() => {
        clockEditing.value = false
        clockDraft.value = store.state.timeGame
      })
    }
    if (!active) {
      intermissionDraft.value =
        store.state.intermissionDuration || sport.value.clock.intermissionDefault
    }
  },
)

watch(
  () => [store.state.intermissionTime, store.state.intermissionDuration] as const,
  ([time, duration]) => {
    if (store.state.intermissionActive) {
      intermissionDraft.value = time
    } else {
      intermissionDraft.value = duration || sport.value.clock.intermissionDefault
    }
  },
)

watch(hydrated, (ready) => {
  if (!ready) return
  void nextTick(setupClockObserver)
  const current = store.state.footballPeriodLength
  const normalized = normalizeFootballPeriodLength(current)
  const extraCurrent = store.state.footballExtraTimeLength
  const extraNormalized = normalizeFootballExtraTime(extraCurrent)
  const lengthPatch: Partial<{
    footballPeriodLength: string
    footballExtraTimeLength: string
  }> = {}
  if (normalized !== current) lengthPatch.footballPeriodLength = normalized
  if (extraNormalized !== extraCurrent) lengthPatch.footballExtraTimeLength = extraNormalized
  if (Object.keys(lengthPatch).length > 0) {
    store.patch(clampClockToPeriodEnd(lengthPatch))
  }
})

function rosterFor(team: 'local' | 'visit') {
  return team === 'local' ? store.state.rosterLocal : store.state.rosterVisit
}

function onClockDraftUpdate(value: string): void {
  clockEditing.value = true
  clockDraft.value = value
}

function commitClockDraft(): void {
  clockEditing.value = false
  if (!canAdjustGameClock.value) {
    clockDraft.value = store.state.timeGame
    return
  }
  store.setGameTime(clockDraft.value)
  clockDraft.value = store.state.timeGame
}

function setPeriodLengthMinutes(minutes: number | null): void {
  if (!canEditPeriodLength.value || minutes == null) return
  const next = normalizeFootballPeriodLength(minutes)
  store.patch(clampClockToPeriodEnd({ footballPeriodLength: next }))
}

function setExtraTimeMinutes(minutes: number | null): void {
  if (!canEditExtraTime.value || minutes == null) return
  const next = normalizeFootballExtraTime(minutes)
  store.patch(clampClockToPeriodEnd({ footballExtraTimeLength: next }))
}

function onPeriodLengthInput(raw: string): void {
  periodLengthEditing.value = true
  periodLengthDraft.value = raw.replace(/\D/g, '').slice(0, 2)
}

function onExtraTimeInput(raw: string): void {
  extraTimeEditing.value = true
  extraTimeDraft.value = raw.replace(/\D/g, '').slice(0, 2)
}

function onPeriodLengthKeydown(event: KeyboardEvent): void {
  if (event.ctrlKey || event.metaKey || event.altKey) return
  if (event.key.length !== 1) return
  if (!/\d/.test(event.key)) event.preventDefault()
}

function commitPeriodLengthMinutes(): void {
  periodLengthEditing.value = false
  const parsed = Number.parseInt(periodLengthDraft.value, 10)
  if (Number.isFinite(parsed)) setPeriodLengthMinutes(parsed)
  periodLengthDraft.value = String(periodLengthMinutes.value)
}

function commitExtraTimeMinutes(): void {
  extraTimeEditing.value = false
  const parsed = Number.parseInt(extraTimeDraft.value, 10)
  if (Number.isFinite(parsed)) setExtraTimeMinutes(parsed)
  extraTimeDraft.value = String(extraTimeMinutes.value)
}

function setGamePeriod(period: number): void {
  const next = Math.max(1, Math.min(maxPeriods.value, period))
  if (next === store.state.gamePeriod) return
  store.patch({ gamePeriod: next })
}

function startOrToggleIntermission(): void {
  if (store.state.intermissionActive) {
    store.togglePause()
    return
  }
  const duration =
    intermissionDraft.value.trim() ||
    store.state.intermissionDuration ||
    sport.value.clock.intermissionDefault
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
    sport.value.clock.intermissionDefault
  store.setIntermissionTime(normalized)
  intermissionDraft.value = store.state.intermissionActive
    ? store.state.intermissionTime
    : store.state.intermissionDuration || normalized
}

function stopIntermission(): void {
  store.stopIntermission()
  clockEditing.value = false
  clockDraft.value = store.state.timeGame
  void nextTick(() => {
    clockDraft.value = store.state.timeGame
  })
  intermissionDraft.value =
    store.state.intermissionDuration || sport.value.clock.intermissionDefault
}

function markGoal(team: 'local' | 'visit'): void {
  store.markGoal(team)
}

function addCard(team: 'local' | 'visit', kind: FootballCardKind): void {
  const playerId = selectedCardPlayer.value[team]
  const result = addFootballCard(store.state, team, kind, playerId)
  if (result.blockedReason === 'player_required') {
    message.warning('Selecciona un jugador para la amarilla (necesario para doble amarilla).')
    return
  }
  if (result.blockedReason === 'already_expelled') {
    message.warning('Ese jugador ya está expulsado.')
    return
  }
  if (!result.patch.footballCards) return
  store.patch(result.patch)
  if (result.secondYellowExpulsion) {
    const who = playerName(team, playerId)
    message.error(`Doble amarilla: ${who || 'jugador'} expulsado (roja automática).`)
  }
}

function undoCard(team: 'local' | 'visit'): void {
  const next = undoLastFootballCard(store.state, team)
  if (next) store.patch(next)
}

function playerName(team: 'local' | 'visit', playerId: string): string {
  const player = findPlayerById(rosterFor(team), playerId)
  return player ? playerLabel(player) : 'Sin asignar'
}

function cardLabel(item: { kind: FootballCardKind; fromSecondYellow?: boolean }): string {
  if (item.kind === 'red' && item.fromSecondYellow) return 'Roja (doble amarilla)'
  return FOOTBALL_CARD_LABELS[item.kind]
}

const cardKinds = Object.entries(FOOTBALL_CARD_LABELS) as Array<[FootballCardKind, string]>
const recentCards = computed(() =>
  [...(store.state.footballCards ?? [])].slice(-10).reverse(),
)

const stoppageMinutes = computed(() => footballStoppageMinutes(store.state))

const inStoppagePlay = computed(() => isStoppagePlay(store.state))

const footballDockTime = computed(() => {
  if (!inStoppagePlay.value) return dockClockTime.value
  return `${dockClockTime.value} +${stoppageMinutes.value}`
})

const footballDockLabel = computed(() => {
  if (!inStoppagePlay.value) return dockClockLabel.value
  const period = sport.value.periodLabel(store.state.gamePeriod)
  return store.state.isPaused ? `${period} · descuento · pausa` : `${period} · descuento`
})

function clampClockToPeriodEnd(
  extra: Partial<{
    footballPeriodLength: string
    footballExtraTimeLength: string
    footballStoppageMinutes: number
    timeGame: string
  }>,
) {
  const nextState = { ...store.state, ...extra }
  const cap = periodEndClockSeconds(nextState)
  const elapsed = parseTimeToSeconds(nextState.timeGame)
  if (elapsed <= cap) return extra
  return {
    ...extra,
    timeGame: formatSecondsToTime(cap),
    isPaused: true,
  }
}

function adjustStoppage(delta: number): void {
  const nextMinutes = clampFootballStoppage(stoppageMinutes.value + delta)
  const extra = { footballStoppageMinutes: nextMinutes }
  const nextState = { ...store.state, ...extra }
  const nextCap = periodEndClockSeconds(nextState)
  const elapsed = parseTimeToSeconds(nextState.timeGame)

  if (elapsed > nextCap) {
    store.patch({
      ...extra,
      timeGame: formatSecondsToTime(nextCap),
      isPaused: true,
    })
    return
  }

  const stoppedAtPreviousCap =
    store.state.isPaused &&
    !store.state.intermissionActive &&
    elapsed >= periodEndClockSeconds(store.state)

  store.patch({
    ...extra,
    ...(stoppedAtPreviousCap && elapsed < nextCap ? { isPaused: false } : {}),
  })
}
</script>

<template>
  <ControlsShell
    class="football-controls"
    :sport-label="sport.label"
    :match-id="matchId || undefined"
    :empty="!matchId"
    :loading="Boolean(matchId) && !hydrated"
  >
    <template #links>
      <ControlsOperatorLinks
        :match-id="matchId || undefined"
        :copied="copied"
        :tournament-context="tournamentContext"
        @copy="copyLink"
      />
    </template>

    <a-tabs v-model:active-key="activeTab" class="controls__tabs">
      <template #moreIcon>
        <span class="football-controls__more-hidden" aria-hidden="true" />
      </template>
      <template #rightExtra>
        <button
          type="button"
          class="football-controls__tab-clock"
          :title="footballDockLabel"
          @click="activeTab = 'match'"
        >
          {{ footballDockTime }}
        </button>
      </template>
      <a-tab-pane key="match" tab="Partido">
        <div
          class="controls__grid"
          :class="{ 'controls__grid--rest': showIntermissionControls }"
        >
          <a-card title="Marcador" class="controls__card controls__card--wide football-match__score">
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
                <div class="controls__score-controls">
                  <a-button size="large" @click="store.removeLastGoal('local')">−</a-button>
                  <span class="controls__score">{{ store.state.goalLocal }}</span>
                  <a-button
                    type="primary"
                    size="large"
                    class="football-score-plus"
                    @click="markGoal('local')"
                  >
                    <span class="football-score-plus__inner">
                      <span class="football-score-plus__mark">+</span>
                      <span class="football-score-plus__text">Gol</span>
                    </span>
                  </a-button>
                </div>
                <p class="controls__meta">
                  A {{ cardCount(store.state, 'local', 'yellow') }}
                  · R {{ cardCount(store.state, 'local', 'red') }}
                </p>
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
                <div class="controls__score-controls">
                  <a-button size="large" @click="store.removeLastGoal('visit')">−</a-button>
                  <span class="controls__score">{{ store.state.goalVisit }}</span>
                  <a-button
                    type="primary"
                    size="large"
                    class="football-score-plus"
                    @click="markGoal('visit')"
                  >
                    <span class="football-score-plus__inner">
                      <span class="football-score-plus__mark">+</span>
                      <span class="football-score-plus__text">Gol</span>
                    </span>
                  </a-button>
                </div>
                <p class="controls__meta">
                  A {{ cardCount(store.state, 'visit', 'yellow') }}
                  · R {{ cardCount(store.state, 'visit', 'red') }}
                </p>
              </div>
            </div>
            <p class="controls__score-hint">
              El botón <strong>+</strong> marca el gol y captura el minuto del reloj.
              Cuando quieras, completa autor y asistencia en la pestaña <strong>Goles</strong>.
            </p>
          </a-card>

          <div ref="clockSectionEl" class="controls__clock-section football-match__clock">
            <a-card
              title="Reloj y periodo"
              class="controls__card controls__card--wide controls__card--clock"
            >
              <div class="controls__clock">
                <div class="controls__clock-main">
                  <div class="controls__clock-main-core">
                    <span
                      v-if="inStoppagePlay"
                      class="football-match__added"
                      :aria-label="`Descuento +${stoppageMinutes}`"
                    >
                      +{{ stoppageMinutes }}
                    </span>
                    <div ref="clockDisplayEl" class="controls__clock-display">
                      {{ dockClockTime }}
                    </div>
                    <p
                      class="controls__clock-status"
                      :class="{ 'is-stoppage': inStoppagePlay }"
                    >
                      <template v-if="store.state.intermissionActive">
                        {{ store.state.isPaused ? 'Descanso en pausa' : 'Descanso' }}
                      </template>
                      <template v-else-if="inStoppagePlay">
                        {{ store.state.isPaused ? 'Descuento en pausa' : 'Descuento' }}
                      </template>
                      <template v-else>
                        {{ store.state.isPaused ? 'En pausa' : 'En juego' }}
                      </template>
                    </p>
                    <a-button
                      class="controls__clock-toggle"
                      size="large"
                      :type="store.state.isPaused ? 'primary' : 'default'"
                      :disabled="showIntermissionControls"
                      @click="store.togglePause()"
                    >
                      {{ store.state.isPaused ? 'Reanudar' : 'Pausar' }}
                    </a-button>
                  </div>
                </div>

                <div class="controls__clock-panels">
                  <div class="controls__clock-field controls__clock-field--period">
                    <label>Periodo</label>
                    <div class="controls__clock-period">
                      <a-button
                        :disabled="store.state.gamePeriod <= 1"
                        @click="setGamePeriod(store.state.gamePeriod - 1)"
                      >
                        −
                      </a-button>
                      <span class="controls__clock-period-label">
                        {{ sport.periodLabel(store.state.gamePeriod) }}
                        · {{ periodIndexLabel }}
                      </span>
                      <a-button
                        :disabled="store.state.gamePeriod >= maxPeriods"
                        @click="setGamePeriod(store.state.gamePeriod + 1)"
                      >
                        +
                      </a-button>
                    </div>
                    <span class="controls__clock-hint">
                      Cada periodo: {{ periodLengthMinutes }}′ (Config).
                      El reloj se detiene al cumplir la duración más el descuento.
                      Prórroga: {{ extraTimeMinutes }}′.
                    </span>
                  </div>
                  <div
                    class="controls__clock-field controls__clock-field--adjust controls__clock-adjust"
                    :class="{ 'is-disabled': !canAdjustGameClock }"
                  >
                    <label>Ajustar reloj</label>
                    <TimeInput
                      compact
                      :value="clockDraft"
                      :disabled="!canAdjustGameClock"
                      @update:value="onClockDraftUpdate"
                      @focus="clockEditing = true"
                      @blur="commitClockDraft"
                      @enter="commitClockDraft"
                    />
                    <span class="controls__clock-hint">
                      {{
                        showIntermissionControls
                          ? 'Se desbloquea al terminar el descanso.'
                          : store.state.isPaused
                            ? 'Escribe minutos y segundos (solo números).'
                            : 'Pausa el reloj para ajustarlo.'
                      }}
                      <template v-if="lateGameWarningEnabled()">
                        Aviso a los {{ lateGameWarningMinutes() }} min (Perfil).
                      </template>
                    </span>
                  </div>
                </div>

                <div
                  v-if="!showIntermissionControls"
                  class="football-match__stoppage"
                  :class="{ 'is-active': inStoppagePlay }"
                >
                  <label>Descuento</label>
                  <div class="football-match__stoppage-stepper">
                    <a-button
                      :disabled="stoppageMinutes <= 0"
                      @click="adjustStoppage(-1)"
                    >
                      −
                    </a-button>
                    <span class="football-match__stoppage-value">
                      {{ stoppageMinutes > 0 ? `+${stoppageMinutes}` : '—' }}
                    </span>
                    <a-button
                      :disabled="stoppageMinutes >= FOOTBALL_MAX_STOPPAGE_MINUTES"
                      @click="adjustStoppage(1)"
                    >
                      +
                    </a-button>
                  </div>
                  <span class="controls__clock-hint">
                    Se puede corregir en cualquier momento. Si el reloj ya se detuvo y
                    sumas minutos, continúa solo.
                  </span>
                </div>

                <div v-if="showIntermissionControls" class="football-match__rest">
                  <div class="football-match__rest-time">
                    <label>Descanso</label>
                    <TimeInput
                      compact
                      :value="intermissionDraft"
                      :disabled="store.state.intermissionActive && !store.state.isPaused"
                      @update:value="onIntermissionDraftUpdate"
                      @blur="commitIntermissionDraft"
                      @enter="commitIntermissionDraft"
                    />
                  </div>
                  <div class="football-match__rest-actions">
                    <a-button type="primary" @click="startOrToggleIntermission">
                      <template v-if="!store.state.intermissionActive">
                        Iniciar
                      </template>
                      <template v-else-if="store.state.isPaused">
                        Reanudar
                      </template>
                      <template v-else>
                        Pausar
                      </template>
                    </a-button>
                    <a-button
                      v-if="store.state.intermissionActive"
                      @click="stopIntermission"
                    >
                      Terminar
                    </a-button>
                  </div>
                  <span class="controls__clock-hint">
                    El marcador TV muestra la cuenta de descanso.
                    Beep en los últimos {{ countdownBeepSeconds() }} s
                    (configurable en Perfil).
                    Al terminar (o al pulsar Terminar), pasa solo al siguiente periodo
                    (salvo el último). El reloj vuelve a 00:00.
                  </span>
                </div>
              </div>
            </a-card>
          </div>
        </div>
      </a-tab-pane>

      <a-tab-pane key="roster" tab="Nómina">
        <FootballRosterPanel v-model:side="mobileSide" />
      </a-tab-pane>

      <a-tab-pane key="goals">
        <template #tab>
          <span>
            Goles
            <a-badge
              v-if="pendingGoalsCount > 0"
              :count="pendingGoalsCount"
              class="controls__tab-badge"
            />
          </span>
        </template>
        <div class="football-goals" :data-side="mobileSide">
          <FootballSideSwitch
            v-model="mobileSide"
            :local-name="store.state.localTeam"
            :visit-name="store.state.visitTeam"
          />
          <HockeyGoalsPanel />
        </div>
      </a-tab-pane>

      <a-tab-pane key="cards" tab="Tarjetas">
        <div class="football-cards" :data-side="mobileSide">
          <FootballSideSwitch
            v-model="mobileSide"
            :local-name="store.state.localTeam"
            :visit-name="store.state.visitTeam"
          />
          <a-alert
            type="info"
            show-icon
            class="football-cards__alert"
            style="margin-bottom: 0.85rem"
            message="FIFA: amarilla (amonestación) y roja (expulsión). La segunda amarilla al mismo jugador genera roja automática."
          />
          <div class="controls__split">
            <a-card
              v-for="side in (['local', 'visit'] as const)"
              :key="side"
              :class="side === 'local' ? 'football-cards__local' : 'football-cards__visit'"
              :title="side === 'local' ? store.state.localTeam : store.state.visitTeam"
            >
              <p class="controls__meta" style="text-align: left; margin-top: 0">
                Amarillas {{ cardCount(store.state, side, 'yellow') }}
                · Rojas {{ cardCount(store.state, side, 'red') }}
              </p>
              <a-select
                :value="selectedCardPlayer[side]"
                allow-clear
                placeholder="Jugador (obligatorio en amarilla)"
                style="width: 100%; margin-bottom: 0.75rem"
                @update:value="(v: string) => (selectedCardPlayer[side] = v ?? '')"
              >
                <a-select-option
                  v-for="player in rosterFor(side)"
                  :key="player.id"
                  :value="player.id"
                  :disabled="isPlayerExpelled(store.state, side, player.id)"
                >
                  {{ playerLabel(player) }}
                  <template v-if="playerYellowCount(store.state, side, player.id) > 0">
                    · A{{ playerYellowCount(store.state, side, player.id) }}
                  </template>
                  <template v-if="isPlayerExpelled(store.state, side, player.id)">
                    · Expulsado
                  </template>
                </a-select-option>
              </a-select>
              <div class="controls__foul-actions">
                <a-button
                  v-for="[kind, label] in cardKinds"
                  :key="kind"
                  class="controls__card-btn"
                  @click="addCard(side, kind)"
                >
                  <span
                    class="controls__card-icon"
                    :class="
                      kind === 'red'
                        ? 'controls__card-icon--red'
                        : 'controls__card-icon--yellow'
                    "
                    aria-hidden="true"
                  />
                  {{ label }}
                </a-button>
                <a-button danger @click="undoCard(side)">Deshacer</a-button>
              </div>
            </a-card>
          </div>

          <a-card title="Últimas tarjetas" class="football-cards__log">
            <ul v-if="recentCards.length" class="controls__log">
              <li v-for="item in recentCards" :key="item.id">
                <strong>{{ item.team === 'local' ? store.state.localTeam : store.state.visitTeam }}</strong>
                · {{ cardLabel(item) }}
                · {{ item.player || playerName(item.team, item.playerId) }}
                · {{ sport.periodLabel(item.period) }} {{ item.gameMinute }}
              </li>
            </ul>
            <a-empty v-else description="Sin tarjetas" :image-style="{ height: '36px' }" />
          </a-card>
        </div>
      </a-tab-pane>

      <a-tab-pane key="config" tab="Config">
        <div class="football-config">
          <a-card title="Periodo" class="controls__card controls__card--wide">
            <div class="football-config__durations">
              <label class="football-config__duration">
                <span>Duración de cada periodo</span>
                <a-input
                  :value="periodLengthDraft"
                  :disabled="!canEditPeriodLength"
                  inputmode="numeric"
                  pattern="[0-9]*"
                  autocomplete="off"
                  spellcheck="false"
                  maxlength="2"
                  addon-after="min"
                  class="football-config__duration-input"
                  @update:value="onPeriodLengthInput"
                  @keydown="onPeriodLengthKeydown"
                  @blur="commitPeriodLengthMinutes"
                  @pressEnter="commitPeriodLengthMinutes"
                />
              </label>
              <label class="football-config__duration">
                <span>Duración de la prórroga</span>
                <a-input
                  :value="extraTimeDraft"
                  :disabled="!canEditExtraTime"
                  inputmode="numeric"
                  pattern="[0-9]*"
                  autocomplete="off"
                  spellcheck="false"
                  maxlength="2"
                  addon-after="min"
                  class="football-config__duration-input"
                  @update:value="onExtraTimeInput"
                  @keydown="onPeriodLengthKeydown"
                  @blur="commitExtraTimeMinutes"
                  @pressEnter="commitExtraTimeMinutes"
                />
              </label>
            </div>
            <p class="football-config__hint">
              {{
                canEditPeriodLength
                  ? 'Solo minutos enteros. El reloj parte de 00:00 y se detiene al cumplir el periodo o la prórroga, más el descuento.'
                  : `Cada periodo: ${periodLengthMinutes}′. Prórroga: ${extraTimeMinutes}′. El periodo se cambia en pausa en el 1.er tiempo; la prórroga, en cualquier pausa.`
              }}
            </p>
          </a-card>

          <a-card title="Equipos y logos" class="controls__card controls__card--wide">
            <div class="football-config__teams">
              <label class="football-config__team">
                <span>Logo local</span>
                <strong>{{ store.state.localTeam }}</strong>
                <a-input
                  :value="store.state.localLogo"
                  placeholder="URL logo local"
                  allow-clear
                  @update:value="(v: string) => store.setTeamLogos(v, store.state.visitLogo)"
                />
                <a-input
                  :value="store.state.localColor"
                  type="color"
                  size="small"
                  class="controls__color"
                  @update:value="(v: string) => store.setTeamColors(v, store.state.visitColor)"
                />
              </label>
              <label class="football-config__team">
                <span>Logo visita</span>
                <strong>{{ store.state.visitTeam }}</strong>
                <a-input
                  :value="store.state.visitLogo"
                  placeholder="URL logo visita"
                  allow-clear
                  @update:value="(v: string) => store.setTeamLogos(store.state.localLogo, v)"
                />
                <a-input
                  :value="store.state.visitColor"
                  type="color"
                  size="small"
                  class="controls__color"
                  @update:value="(v: string) => store.setTeamColors(store.state.localColor, v)"
                />
              </label>
            </div>
          </a-card>

          <a-card
            v-if="sport.features.officials"
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
            </div>
          </a-card>

          <a-card
            title="Enlaces de marcador"
            class="controls__card controls__card--wide football-config__links-card"
          >
            <p class="football-config__hint">
              Live es el marcador público. Overlay es para OBS. Copiá TV para
              pegarlo en otra pantalla; no lo abras en este teléfono.
            </p>
            <div class="football-config__links">
              <a-button :disabled="!matchId" @click="copyLink('live')">
                {{ copied === 'live' ? '¡Copiado!' : 'Copiar Live' }}
              </a-button>
              <a-button :disabled="!matchId" @click="copyLink('overlay')">
                {{ copied === 'overlay' ? '¡Copiado!' : 'Copiar overlay' }}
              </a-button>
              <a-button
                :disabled="!matchId"
                @click="copyLink(tournamentContext ? 'board-torneo' : 'board')"
              >
                {{
                  copied === 'board' || copied === 'board-torneo'
                    ? '¡Copiado!'
                    : 'Copiar TV'
                }}
              </a-button>
            </div>
          </a-card>

          <ControlsMatchEndCard
            :tournament-context="tournamentContext"
            :has-next-match="hasNextMatch"
            :advancing="advancing"
            :finishing="finishing"
            :advance-error="advanceError"
            @next="goToNextMatch"
            @finish="finishCurrentMatch"
          />
        </div>
      </a-tab-pane>
    </a-tabs>

    <template #dock>
      <ControlsClockDock
        :show="showDockClock"
        :label="footballDockLabel"
        :time="footballDockTime"
        :paused="store.state.isPaused"
        :intermission="store.state.intermissionActive"
        @scroll-to-clock="scrollToClock"
      />
    </template>
  </ControlsShell>
</template>

<style lang="scss" src="./football-controls.scss"></style>
