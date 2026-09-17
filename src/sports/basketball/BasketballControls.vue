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
import BasketballRosterPanel from '@/sports/basketball/controls/BasketballRosterPanel.vue'
import {
  addBasketballFoul,
  addBasketballScore,
  addRebound,
  isInBonus,
  playerFoulCount,
  playerFoulLimitReached,
  reboundCount,
  teamFoulsInPeriod,
  undoLastBasketballScore,
  undoLastFoul,
  undoLastRebound,
} from '@/sports/basketball/actions'
import {
  BASKETBALL_FOUL_LABELS,
  BASKETBALL_PLAYER_FOUL_LIMIT,
  BASKETBALL_QUARTER_TIME,
  basketballPointsLabel,
  type BasketballFoulKind,
  type BasketballPoints,
  type ReboundKind,
} from '@/sports/basketball/types'
import { DEFAULT_INTERMISSION_TIME } from '@/sports/scoreboardState'
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

const sport = computed(() => getSportModule('basketball'))
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
useMatchClockAlerts()

const clockDraft = ref(store.state.timeGame)
const clockEditing = ref(false)
const intermissionDraft = ref(
  store.state.intermissionDuration || sport.value.clock.intermissionDefault,
)
const maxPeriods = computed(() => sport.value.clock.periods)

const selectedScorer = ref<{ local: string; visit: string }>({ local: '', visit: '' })
const selectedAssist = ref<{ local: string; visit: string }>({ local: '', visit: '' })
const selectedRebound = ref<{ local: string; visit: string }>({ local: '', visit: '' })
const selectedFoul = ref<{ local: string; visit: string }>({ local: '', visit: '' })

const canAdvancePeriod = computed(
  () =>
    store.state.intermissionActive ||
    store.state.isPaused ||
    parseTimeToSeconds(store.state.timeGame) <= 0,
)

const teams = computed(() => [
  { key: 'local' as const, name: store.state.localTeam, score: store.state.goalLocal },
  { key: 'visit' as const, name: store.state.visitTeam, score: store.state.goalVisit },
])

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
  store.advanceToNextPeriod(sport.value.clock.defaultPeriodTime)
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

function score(team: 'local' | 'visit', points: BasketballPoints): void {
  const assist = selectedAssist.value[team] || null
  store.patch(
    addBasketballScore(store.state, team, points, selectedScorer.value[team], assist),
  )
}

function undoScore(team: 'local' | 'visit'): void {
  const next = undoLastBasketballScore(store.state, team)
  if (next) store.patch(next)
}

function rebound(team: 'local' | 'visit', kind: ReboundKind): void {
  store.patch(addRebound(store.state, team, kind, selectedRebound.value[team]))
}

function undoRebound(team: 'local' | 'visit'): void {
  const next = undoLastRebound(store.state, team)
  if (next) store.patch(next)
}

function foul(team: 'local' | 'visit', kind: BasketballFoulKind): void {
  const playerId = selectedFoul.value[team]
  store.patch(addBasketballFoul(store.state, team, kind, playerId))
}

function undoFoul(team: 'local' | 'visit'): void {
  const next = undoLastFoul(store.state, team)
  if (next) store.patch(next)
}

function playerName(team: 'local' | 'visit', playerId: string): string {
  const player = findPlayerById(rosterFor(team), playerId)
  return player ? playerLabel(player) : 'Sin asignar'
}

const recentScores = computed(() =>
  [...(store.state.basketballScores ?? [])].slice(-8).reverse(),
)
const recentRebounds = computed(() =>
  [...(store.state.rebounds ?? [])].slice(-8).reverse(),
)
const recentFouls = computed(() =>
  [...(store.state.basketballFouls ?? [])].slice(-8).reverse(),
)

const foulKinds = Object.entries(BASKETBALL_FOUL_LABELS) as Array<
  [BasketballFoulKind, string]
>
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
                <span class="controls__score">{{ store.state.goalLocal }}</span>
                <div class="controls__score-actions">
                  <a-button @click="score('local', 1)">+1</a-button>
                  <a-button type="primary" @click="score('local', 2)">+2</a-button>
                  <a-button @click="score('local', 3)">+3</a-button>
                  <a-button @click="undoScore('local')">−</a-button>
                </div>
                <p class="controls__meta">
                  Faltas {{ sport.periodLabel(store.state.gamePeriod) }}:
                  {{ teamFoulsInPeriod(store.state, 'local') }}
                  <a-tag v-if="isInBonus(store.state, 'local')" color="orange">Bonus</a-tag>
                </p>
                <p class="controls__score-hint">1 TL · 2 canasta · 3 triple</p>
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
                <span class="controls__score">{{ store.state.goalVisit }}</span>
                <div class="controls__score-actions">
                  <a-button @click="score('visit', 1)">+1</a-button>
                  <a-button type="primary" @click="score('visit', 2)">+2</a-button>
                  <a-button @click="score('visit', 3)">+3</a-button>
                  <a-button @click="undoScore('visit')">−</a-button>
                </div>
                <p class="controls__meta">
                  Faltas {{ sport.periodLabel(store.state.gamePeriod) }}:
                  {{ teamFoulsInPeriod(store.state, 'visit') }}
                  <a-tag v-if="isInBonus(store.state, 'visit')" color="orange">Bonus</a-tag>
                </p>
                <p class="controls__score-hint">1 TL · 2 canasta · 3 triple</p>
              </div>
            </div>
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
                    </span>
                  </div>

                  <div class="controls__clock-field controls__clock-field--period">
                    <label>Cuarto</label>
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
                      Siguiente cuarto
                    </a-button>
                    <span class="controls__clock-hint">
                      FIBA: 4 × {{ BASKETBALL_QUARTER_TIME }}.
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

      <a-tab-pane key="points" tab="Puntos">
        <div class="controls__split">
          <a-card v-for="team in teams" :key="team.key" :title="team.name">
            <span class="controls__field-label">Anotador</span>
            <a-select
              :value="selectedScorer[team.key]"
              allow-clear
              placeholder="Jugador"
              style="width: 100%; margin-bottom: 0.65rem"
              @update:value="(v: string) => (selectedScorer[team.key] = v ?? '')"
            >
              <a-select-option
                v-for="player in rosterFor(team.key)"
                :key="player.id"
                :value="player.id"
              >
                {{ playerLabel(player) }}
              </a-select-option>
            </a-select>
            <span class="controls__field-label">Asistencia</span>
            <a-select
              :value="selectedAssist[team.key]"
              allow-clear
              placeholder="Opcional"
              style="width: 100%; margin-bottom: 0.85rem"
              @update:value="(v: string) => (selectedAssist[team.key] = v ?? '')"
            >
              <a-select-option
                v-for="player in rosterFor(team.key).filter((item) => item.id !== selectedScorer[team.key])"
                :key="player.id"
                :value="player.id"
              >
                {{ playerLabel(player) }}
              </a-select-option>
            </a-select>
            <div class="controls__score-actions">
              <a-button @click="score(team.key, 1)">+1 TL</a-button>
              <a-button type="primary" @click="score(team.key, 2)">+2</a-button>
              <a-button @click="score(team.key, 3)">+3</a-button>
              <a-button @click="undoScore(team.key)">Deshacer</a-button>
            </div>
          </a-card>
        </div>
        <a-card title="Últimas anotaciones" style="margin-top: 0.85rem">
          <ul v-if="recentScores.length" class="controls__log">
            <li v-for="item in recentScores" :key="item.id">
              <strong>{{ item.team === 'local' ? store.state.localTeam : store.state.visitTeam }}</strong>
              · +{{ item.points }} {{ basketballPointsLabel(item.points) }}
              · {{ playerName(item.team, item.scorerPlayerId) }}
              <span v-if="item.assistPlayerId">
                (ast. {{ playerName(item.team, item.assistPlayerId) }})
              </span>
              · {{ sport.periodLabel(item.period) }} {{ item.gameMinute }}
            </li>
          </ul>
          <a-empty v-else description="Sin anotaciones" :image-style="{ height: '36px' }" />
        </a-card>
      </a-tab-pane>

      <a-tab-pane key="rebounds" tab="Rebotes">
        <div class="controls__split">
          <a-card v-for="team in teams" :key="team.key" :title="team.name">
            <p class="controls__meta">
              Def. {{ reboundCount(store.state, team.key, 'defensive') }}
              · Of. {{ reboundCount(store.state, team.key, 'offensive') }}
              · Total {{ reboundCount(store.state, team.key) }}
            </p>
            <a-select
              :value="selectedRebound[team.key]"
              allow-clear
              placeholder="Jugador"
              style="width: 100%; margin-bottom: 0.75rem"
              @update:value="(v: string) => (selectedRebound[team.key] = v ?? '')"
            >
              <a-select-option
                v-for="player in rosterFor(team.key)"
                :key="player.id"
                :value="player.id"
              >
                {{ playerLabel(player) }}
              </a-select-option>
            </a-select>
            <div class="controls__score-actions">
              <a-button type="primary" @click="rebound(team.key, 'defensive')">
                Rebote def.
              </a-button>
              <a-button @click="rebound(team.key, 'offensive')">Rebote of.</a-button>
              <a-button @click="undoRebound(team.key)">Deshacer</a-button>
            </div>
          </a-card>
        </div>
        <a-card title="Últimos rebotes" style="margin-top: 0.85rem">
          <ul v-if="recentRebounds.length" class="controls__log">
            <li v-for="item in recentRebounds" :key="item.id">
              <strong>{{ item.team === 'local' ? store.state.localTeam : store.state.visitTeam }}</strong>
              · {{ item.kind === 'offensive' ? 'Ofensivo' : 'Defensivo' }}
              · {{ playerName(item.team, item.playerId) }}
              · {{ sport.periodLabel(item.period) }} {{ item.gameMinute }}
            </li>
          </ul>
          <a-empty v-else description="Sin rebotes" :image-style="{ height: '36px' }" />
        </a-card>
      </a-tab-pane>

      <a-tab-pane key="fouls" tab="Faltas">
        <div class="controls__split">
          <a-card v-for="team in teams" :key="team.key" :title="team.name">
            <p class="controls__meta">
              Faltas de equipo {{ sport.periodLabel(store.state.gamePeriod) }}:
              {{ teamFoulsInPeriod(store.state, team.key) }}
              · sin tiempo de penalización
              <a-tag v-if="isInBonus(store.state, team.key)" color="orange">Rival en bonus</a-tag>
            </p>
            <a-select
              :value="selectedFoul[team.key]"
              allow-clear
              placeholder="Jugador"
              style="width: 100%; margin-bottom: 0.75rem"
              @update:value="(v: string) => (selectedFoul[team.key] = v ?? '')"
            >
              <a-select-option
                v-for="player in rosterFor(team.key)"
                :key="player.id"
                :value="player.id"
              >
                {{ playerLabel(player) }}
                ({{ playerFoulCount(store.state, player.id) }}/{{ BASKETBALL_PLAYER_FOUL_LIMIT }})
              </a-select-option>
            </a-select>
            <a-alert
              v-if="selectedFoul[team.key] && playerFoulLimitReached(store.state, selectedFoul[team.key])"
              type="warning"
              message="Este jugador ya está eliminado por faltas."
              show-icon
              style="margin-bottom: 0.75rem"
            />
            <div class="controls__foul-actions">
              <a-button
                v-for="[kind, label] in foulKinds"
                :key="kind"
                @click="foul(team.key, kind)"
              >
                {{ label }}
              </a-button>
              <a-button danger @click="undoFoul(team.key)">Deshacer</a-button>
            </div>
          </a-card>
        </div>
        <a-card title="Últimas faltas" style="margin-top: 0.85rem">
          <ul v-if="recentFouls.length" class="controls__log">
            <li v-for="item in recentFouls" :key="item.id">
              <strong>{{ item.team === 'local' ? store.state.localTeam : store.state.visitTeam }}</strong>
              · {{ BASKETBALL_FOUL_LABELS[item.kind] }}
              · {{ item.player || playerName(item.team, item.playerId) }}
              · {{ sport.periodLabel(item.period) }} {{ item.gameMinute }}
            </li>
          </ul>
          <a-empty v-else description="Sin faltas" :image-style="{ height: '36px' }" />
        </a-card>
      </a-tab-pane>

      <a-tab-pane key="roster" tab="Nómina">
        <BasketballRosterPanel />
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
