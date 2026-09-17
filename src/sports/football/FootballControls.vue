<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import TimeInput from '@/components/controls/TimeInput.vue'
import ControlsShell from '@/components/controls/ControlsShell.vue'
import ControlsClockDock from '@/components/controls/ControlsClockDock.vue'
import ControlsMatchEndCard from '@/components/controls/ControlsMatchEndCard.vue'
import { getSportModule } from '@/sports/registry'
import { useMatchOperatorSession } from '@/composables/useMatchOperatorSession'
import { useControlsClockDock } from '@/composables/useControlsClockDock'
import { useMatchClockAlerts } from '@/composables/useMatchClockAlerts'
import FootballRosterPanel from '@/sports/football/controls/FootballRosterPanel.vue'
import HockeyGoalsPanel from '@/sports/hockey/controls/HockeyGoalsPanel.vue'
import {
  addFootballCard,
  cardCount,
  undoLastFootballCard,
} from '@/sports/football/actions'
import {
  FOOTBALL_CARD_LABELS,
  FOOTBALL_EXTRA_TIME,
  FOOTBALL_PERIODS,
  type FootballCardKind,
} from '@/sports/football/types'
import { DEFAULT_INTERMISSION_TIME, isGoalPending } from '@/sports/scoreboardState'
import { parseTimeToSeconds } from '@/utils/clock'
import { findPlayerById, playerLabel } from '@/utils/roster'

const {
  route,
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
const clockSectionEl = ref<HTMLElement | null>(null)
const clockDisplayEl = ref<HTMLElement | null>(null)
const {
  dockClockTime,
  dockClockLabel,
  showDockClock,
  scrollToClock,
  setupClockObserver,
} = useControlsClockDock({ activeTab, matchId, clockSectionEl, clockDisplayEl })
const { lateGameWarningMinutes, lateGameWarningEnabled } = useMatchClockAlerts()

const clockDraft = ref(store.state.timeGame)
const clockEditing = ref(false)
const intermissionDraft = ref(
  store.state.intermissionDuration || sport.value.clock.intermissionDefault,
)
const maxPeriods = computed(() => sport.value.clock.periods)

const selectedCardPlayer = ref<{ local: string; visit: string }>({ local: '', visit: '' })

const pendingGoalsCount = computed(
  () => store.state.goals.filter((goal) => isGoalPending(goal)).length,
)

const canAdvancePeriod = computed(
  () =>
    store.state.intermissionActive ||
    store.state.isPaused ||
    parseTimeToSeconds(store.state.timeGame) <= 0,
)

watch(
  () => store.state.timeGame,
  (time) => {
    if (!clockEditing.value) clockDraft.value = time
  },
)

watch(
  () => store.state.intermissionDuration,
  (value) => {
    if (!store.state.intermissionActive) {
      intermissionDraft.value = value || sport.value.clock.intermissionDefault
    }
  },
)

watch(hydrated, (ready) => {
  if (ready) void nextTick(setupClockObserver)
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
  if (!store.state.isPaused || store.state.intermissionActive) {
    clockDraft.value = store.state.timeGame
    return
  }
  store.setGameTime(clockDraft.value)
  clockDraft.value = store.state.timeGame
}

function onIntermissionDraftUpdate(value: string): void {
  intermissionDraft.value = value
}

function commitIntermissionDraft(): void {
  const next = intermissionDraft.value || DEFAULT_INTERMISSION_TIME
  if (store.state.intermissionActive) {
    if (store.state.isPaused) store.setIntermissionTime(next)
  } else {
    store.patch({
      intermissionDuration: next,
      intermissionTime: next,
    })
  }
  intermissionDraft.value = store.state.intermissionActive
    ? store.state.intermissionTime
    : store.state.intermissionDuration || next
}

function nextPeriod(): void {
  if (!canAdvancePeriod.value) return
  const nextLength =
    store.state.gamePeriod >= FOOTBALL_PERIODS
      ? FOOTBALL_EXTRA_TIME
      : sport.value.clock.defaultPeriodTime
  store.advanceToNextPeriod(nextLength)
  clockDraft.value = store.state.timeGame
}

function startOrToggleIntermission(): void {
  if (!store.state.intermissionActive) {
    store.startIntermission(
      intermissionDraft.value ||
        store.state.intermissionDuration ||
        sport.value.clock.intermissionDefault,
    )
    return
  }
  store.togglePause()
}

function markGoal(team: 'local' | 'visit'): void {
  store.markGoal(team)
  activeTab.value = 'goals'
}

function addCard(team: 'local' | 'visit', kind: FootballCardKind): void {
  store.patch(addFootballCard(store.state, team, kind, selectedCardPlayer.value[team]))
}

function undoCard(team: 'local' | 'visit'): void {
  const next = undoLastFootballCard(store.state, team)
  if (next) store.patch(next)
}

function playerName(team: 'local' | 'visit', playerId: string): string {
  const player = findPlayerById(rosterFor(team), playerId)
  return player ? playerLabel(player) : 'Sin asignar'
}

const cardKinds = Object.entries(FOOTBALL_CARD_LABELS) as Array<[FootballCardKind, string]>
const recentCards = computed(() =>
  [...(store.state.footballCards ?? [])].slice(-10).reverse(),
)
</script>

<template>
  <ControlsShell
    :sport-label="sport.label"
    :match-id="matchId || undefined"
    :empty="!matchId"
    :loading="Boolean(matchId) && !hydrated"
  >
    <template #links>
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
        <a-button @click="copyLink('live')">
          {{ copied === 'live' ? '¡Copiado!' : 'Copiar Live' }}
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
    </template>

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
                <p class="controls__meta">
                  A {{ cardCount(store.state, 'visit', 'yellow') }}
                  · R {{ cardCount(store.state, 'visit', 'red') }}
                </p>
              </div>
            </div>
            <p class="controls__score-hint">
              El botón <strong>+</strong> marca el gol y captura el minuto del reloj.
              Completa autor y asistencia en <strong>Goles</strong>.
            </p>
          </a-card>

          <div ref="clockSectionEl" class="controls__clock-section">
            <a-card
              title="Reloj y tiempo"
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
                      <label>Ajustar tiempo</label>
                      <TimeInput
                        compact
                        :value="clockDraft"
                        :disabled="!store.state.isPaused || store.state.intermissionActive"
                        @update:value="onClockDraftUpdate"
                        @focus="clockEditing = true"
                        @blur="commitClockDraft"
                        @enter="commitClockDraft"
                      />
                    </div>
                    <span class="controls__clock-hint">
                      {{
                        store.state.intermissionActive
                          ? 'Durante el descanso usa el campo de abajo.'
                          : store.state.isPaused
                            ? 'Escribe minutos y segundos (solo números).'
                            : 'Pausa el reloj para ajustarlo.'
                      }}
                      <template v-if="lateGameWarningEnabled() && !store.state.intermissionActive">
                        Aviso a los {{ lateGameWarningMinutes() }} min (Perfil).
                      </template>
                    </span>
                  </div>

                  <div class="controls__clock-field controls__clock-field--period">
                    <label>Tiempo</label>
                    <div class="controls__clock-period">
                      <a-button @click="store.setPeriod(store.state.gamePeriod - 1)">−</a-button>
                      <span class="controls__clock-period-label">
                        {{ sport.periodLabel(store.state.gamePeriod) }}
                        · {{ store.state.gamePeriod }}/{{ maxPeriods }}
                      </span>
                      <a-button @click="store.setPeriod(store.state.gamePeriod + 1)">+</a-button>
                    </div>
                    <a-button
                      block
                      class="controls__next-period"
                      :disabled="!canAdvancePeriod"
                      @click="nextPeriod"
                    >
                      Siguiente tiempo
                    </a-button>
                    <span class="controls__clock-hint">
                      FIFA: 2 × 45′. La prórroga usa 15′ por tiempo.
                    </span>
                  </div>
                </div>

                <div class="controls__intermission">
                  <div class="controls__clock-field controls__clock-field--time">
                    <div class="controls__clock-field-head">
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
                  </div>
                  <div class="controls__intermission-actions">
                    <a-button type="primary" @click="startOrToggleIntermission">
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
                      @click="store.stopIntermission()"
                    >
                      Terminar descanso
                    </a-button>
                  </div>
                </div>
              </div>
            </a-card>
          </div>

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

      <a-tab-pane key="roster" tab="Nómina">
        <FootballRosterPanel />
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
        <HockeyGoalsPanel />
      </a-tab-pane>

      <a-tab-pane key="cards" tab="Tarjetas">
        <a-alert
          type="info"
          show-icon
          style="margin-bottom: 0.85rem"
          message="FIFA campo: amarilla (amonestación) y roja (expulsión)."
        />
        <div class="controls__split">
          <a-card
            v-for="side in (['local', 'visit'] as const)"
            :key="side"
            :title="side === 'local' ? store.state.localTeam : store.state.visitTeam"
          >
            <p class="controls__meta" style="text-align: left; margin-top: 0">
              Amarillas {{ cardCount(store.state, side, 'yellow') }}
              · Rojas {{ cardCount(store.state, side, 'red') }}
            </p>
            <a-select
              :value="selectedCardPlayer[side]"
              allow-clear
              placeholder="Jugador"
              style="width: 100%; margin-bottom: 0.75rem"
              @update:value="(v: string) => (selectedCardPlayer[side] = v ?? '')"
            >
              <a-select-option
                v-for="player in rosterFor(side)"
                :key="player.id"
                :value="player.id"
              >
                {{ playerLabel(player) }}
              </a-select-option>
            </a-select>
            <div class="controls__foul-actions">
              <a-button
                v-for="[kind, label] in cardKinds"
                :key="kind"
                @click="addCard(side, kind)"
              >
                {{ label }}
              </a-button>
              <a-button danger @click="undoCard(side)">Deshacer</a-button>
            </div>
          </a-card>
        </div>

        <a-card title="Últimas tarjetas" style="margin-top: 0.85rem">
          <ul v-if="recentCards.length" class="controls__log">
            <li v-for="item in recentCards" :key="item.id">
              <strong>{{ item.team === 'local' ? store.state.localTeam : store.state.visitTeam }}</strong>
              · {{ FOOTBALL_CARD_LABELS[item.kind] }}
              · {{ item.player || playerName(item.team, item.playerId) }}
              · {{ sport.periodLabel(item.period) }} {{ item.gameMinute }}
            </li>
          </ul>
          <a-empty v-else description="Sin tarjetas" :image-style="{ height: '36px' }" />
        </a-card>
      </a-tab-pane>
    </a-tabs>

    <template #dock>
      <ControlsClockDock
        :show="showDockClock"
        :label="dockClockLabel"
        :time="dockClockTime"
        :paused="store.state.isPaused"
        :intermission="store.state.intermissionActive"
        @scroll-to-clock="scrollToClock"
      />
    </template>
  </ControlsShell>
</template>
