<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import type { GoalEvent, ScoreboardState, TeamPenalty } from '@/types/hockeyScoreboard'
import { isGoalPending, MAX_PERIODS } from '@/types/hockeyScoreboard'
import { penaltyTypeLabel } from '@/data/penaltyCatalog'
import { findPlayerById, findPlayerByNumber, playerLabel } from '@/utils/roster'

const props = defineProps<{
  state: ScoreboardState
  displayTime?: string
  displayIntermissionTime?: string
  displayPenaltiesLocal?: TeamPenalty[]
  displayPenaltiesVisit?: TeamPenalty[]
  overlay?: boolean
  /** Marcador grande para TV / cancha. Live usa el diseño responsivo. */
  tv?: boolean
  compact?: boolean
  /** Nombre del torneo (reemplaza “Hockey en línea” en el live). */
  eventTitle?: string | null
  /** Fecha del partido o torneo, junto al nombre. */
  eventDate?: string | null
}>()

const GOAL_BANNER_MS = 12_000
const PENALTY_BANNER_MS = 12_000
const activeGoalId = ref<string | null>(null)
const activePenaltyKey = ref<string | null>(null)
let goalHideTimer: number | null = null
let penaltyHideTimer: number | null = null

const clock = computed(() => {
  if (props.state.intermissionActive) {
    return props.displayIntermissionTime ?? props.state.intermissionTime
  }
  return props.displayTime ?? props.state.timeGame
})

const centerLabel = computed(() => {
  if (props.state.intermissionActive) return 'DESCANSO'
  return `Periodo ${props.state.gamePeriod}`
})

const liveStatus = computed(() => {
  if (props.state.intermissionActive) {
    return props.state.isPaused ? 'DESCANSO · PAUSA' : 'DESCANSO'
  }
  return props.state.isPaused ? 'PAUSA' : 'EN JUEGO'
})

const localPenalties = computed(
  () => props.displayPenaltiesLocal ?? props.state.penaltiesLocal,
)
const visitPenalties = computed(
  () => props.displayPenaltiesVisit ?? props.state.penaltiesVisit,
)

const periodLabel = computed(() => {
  const period = props.state.gamePeriod
  if (period > MAX_PERIODS) return 'OT'
  return `${period}º`
})

const localGoals = computed(() =>
  props.state.goals.filter((goal) => goal.team === 'local'),
)
const visitGoals = computed(() =>
  props.state.goals.filter((goal) => goal.team === 'visit'),
)

const TEAM_NAME_MAX = 18

function truncateTeamName(name: string): string {
  const cleaned = name.trim()
  if (cleaned.length <= TEAM_NAME_MAX) return cleaned
  return `${cleaned.slice(0, TEAM_NAME_MAX)}…`
}

function formatGoalPeriod(period: number): string {
  if (period > MAX_PERIODS) return 'OT'
  return `${period}'`
}

function formatGoalEntry(goal: GoalEvent, team: 'local' | 'visit'): string {
  const roster = team === 'local' ? props.state.rosterLocal : props.state.rosterVisit
  const period = formatGoalPeriod(goal.period)
  if (isGoalPending(goal)) {
    return `— · ${goal.gameMinute} · ${period}`
  }
  const scorer = findPlayerById(roster, goal.scorerPlayerId)
  const number = scorer?.number.trim() || '?'
  const name = scorer?.name.trim()
  const who = name ? `#${number} ${name}` : `#${number}`
  return `${who} · ${goal.gameMinute} · ${period}`
}

const confirmedGoalIds = computed(() =>
  props.state.goals
    .filter((goal) => !isGoalPending(goal) && goal.scorerPlayerId)
    .map((goal) => goal.id)
    .join(','),
)

const penaltyIdsSignature = computed(() => {
  const local = localPenalties.value.map((penalty) => `local:${penalty.id}`).join(',')
  const visit = visitPenalties.value.map((penalty) => `visit:${penalty.id}`).join(',')
  return `${local}|${visit}`
})

watch(
  confirmedGoalIds,
  (_next, prev) => {
    if (!props.overlay) return
    if (prev === undefined) return

    const prevIds = new Set(prev.split(',').filter(Boolean))
    const confirmed = props.state.goals.filter(
      (goal) => !isGoalPending(goal) && goal.scorerPlayerId,
    )
    const newest =
      [...confirmed].reverse().find((goal) => !prevIds.has(goal.id)) ?? null
    if (!newest) return

    activeGoalId.value = newest.id
    if (goalHideTimer) window.clearTimeout(goalHideTimer)
    goalHideTimer = window.setTimeout(() => {
      activeGoalId.value = null
      goalHideTimer = null
    }, GOAL_BANNER_MS)
  },
)

watch(
  penaltyIdsSignature,
  (_next, prev) => {
    if (!props.overlay) return
    if (prev === undefined) return

    const prevIds = new Set(
      prev
        .split('|')
        .flatMap((side) => side.split(','))
        .filter(Boolean),
    )
    const current = [
      ...localPenalties.value.map((penalty) => ({ team: 'local' as const, penalty })),
      ...visitPenalties.value.map((penalty) => ({ team: 'visit' as const, penalty })),
    ]
    const newest = [...current]
      .reverse()
      .find(({ team, penalty }) => !prevIds.has(`${team}:${penalty.id}`))
    if (!newest) return

    activePenaltyKey.value = `${newest.team}:${newest.penalty.id}`
    if (penaltyHideTimer) window.clearTimeout(penaltyHideTimer)
    penaltyHideTimer = window.setTimeout(() => {
      activePenaltyKey.value = null
      penaltyHideTimer = null
    }, PENALTY_BANNER_MS)
  },
)

onUnmounted(() => {
  if (goalHideTimer) window.clearTimeout(goalHideTimer)
  if (penaltyHideTimer) window.clearTimeout(penaltyHideTimer)
})

const goalBanner = computed(() => {
  if (!activeGoalId.value) return null
  const goal = props.state.goals.find((item) => item.id === activeGoalId.value)
  if (!goal || isGoalPending(goal) || !goal.scorerPlayerId) return null

  const roster = goal.team === 'local' ? props.state.rosterLocal : props.state.rosterVisit
  const teamName = goal.team === 'local' ? props.state.localTeam : props.state.visitTeam
  const scorer = findPlayerById(roster, goal.scorerPlayerId)
  const assist = goal.assistPlayerId
    ? findPlayerById(roster, goal.assistPlayerId)
    : undefined

  return {
    team: goal.team,
    teamName: truncateTeamName(teamName),
    scorer: scorer ? playerLabel(scorer) : 'Gol',
    assist: assist ? playerLabel(assist) : null,
    minute: goal.gameMinute,
  }
})

const penaltyBanner = computed(() => {
  if (!activePenaltyKey.value) return null
  const [team, penaltyId] = activePenaltyKey.value.split(':') as [
    'local' | 'visit',
    string,
  ]
  const list = team === 'local' ? localPenalties.value : visitPenalties.value
  const penalty = list.find((item) => item.id === penaltyId)
  if (!penalty) return null

  const roster = team === 'local' ? props.state.rosterLocal : props.state.rosterVisit
  const teamName = team === 'local' ? props.state.localTeam : props.state.visitTeam
  const player =
    findPlayerById(roster, penalty.playerId) ??
    findPlayerByNumber(roster, penalty.player)

  return {
    team,
    teamName: truncateTeamName(teamName),
    player: player
      ? playerLabel(player)
      : penalty.player.trim()
        ? `#${penalty.player}`
        : 'Falta',
    type: penaltyTypeLabel(penalty.penaltyTypeId),
    duration: penalty.time,
    infraction: penalty.infraction.trim() || null,
  }
})

function formatPenaltyShort(penalty: TeamPenalty, team: 'local' | 'visit'): string {
  const roster = team === 'local' ? props.state.rosterLocal : props.state.rosterVisit
  const player = findPlayerByNumber(roster, penalty.player)
  const number = penalty.player.trim() || player?.number || '?'
  return `#${number} ${penalty.time}`
}

function formatPenaltyLive(penalty: TeamPenalty, team: 'local' | 'visit'): string {
  const roster = team === 'local' ? props.state.rosterLocal : props.state.rosterVisit
  const player =
    findPlayerById(roster, penalty.playerId) ?? findPlayerByNumber(roster, penalty.player)
  const number = penalty.player.trim() || player?.number.trim() || '?'
  const name = player?.name.trim()
  const who = name ? `#${number} ${name}` : `#${number}`
  return `${who} · ${penalty.time}`
}
</script>

<template>
  <!-- NHL-style broadcast bug (OBS overlay) -->
  <div
    v-if="overlay"
    class="nhl-bug"
    :style="{
      '--local': state.localColor || '#3da5ff',
      '--visit': state.visitColor || '#ff5a36',
    }"
  >
    <div class="nhl-bug__row">
      <div class="nhl-bug__side nhl-bug__side--local">
        <div v-if="localPenalties.length" class="nhl-bug__timers">
          <span
            v-for="(penalty, index) in localPenalties"
            :key="`local-${index}`"
            class="nhl-bug__timer"
          >
            {{ formatPenaltyShort(penalty, 'local') }}
          </span>
        </div>
      </div>

      <div class="nhl-bug__bar">
        <div class="nhl-bug__team nhl-bug__team--local">
          <span class="nhl-bug__accent nhl-bug__accent--local" />
          <div class="nhl-bug__logo">
            <img
              v-if="state.localLogo"
              :src="state.localLogo"
              :alt="state.localTeam"
              class="nhl-bug__logo-img"
            />
          </div>
          <span class="nhl-bug__name">{{ truncateTeamName(state.localTeam) }}</span>
          <span
            class="nhl-bug__score"
            :class="{ 'nhl-bug__score--penalty': localPenalties.length > 0 }"
          >
            {{ state.goalLocal }}
          </span>
        </div>

        <div class="nhl-bug__center">
          <span class="nhl-bug__period">{{ state.intermissionActive ? 'DES' : periodLabel }}</span>
          <span class="nhl-bug__clock" :class="{ 'nhl-bug__clock--paused': state.isPaused }">
            {{ clock }}
          </span>
        </div>

        <div class="nhl-bug__team nhl-bug__team--visit">
          <span
            class="nhl-bug__score"
            :class="{ 'nhl-bug__score--penalty': visitPenalties.length > 0 }"
          >
            {{ state.goalVisit }}
          </span>
          <span class="nhl-bug__name nhl-bug__name--visit">{{ truncateTeamName(state.visitTeam) }}</span>
          <div class="nhl-bug__logo">
            <img
              v-if="state.visitLogo"
              :src="state.visitLogo"
              :alt="state.visitTeam"
              class="nhl-bug__logo-img"
            />
          </div>
          <span class="nhl-bug__accent nhl-bug__accent--visit" />
        </div>
      </div>

      <div class="nhl-bug__side nhl-bug__side--visit">
        <div v-if="visitPenalties.length" class="nhl-bug__timers">
          <span
            v-for="(penalty, index) in visitPenalties"
            :key="`visit-${index}`"
            class="nhl-bug__timer"
          >
            {{ formatPenaltyShort(penalty, 'visit') }}
          </span>
        </div>
      </div>
    </div>

    <Transition name="nhl-goal">
      <div
        v-if="goalBanner"
        class="nhl-bug__goal"
        :class="`nhl-bug__goal--${goalBanner.team}`"
      >
        <span class="nhl-bug__goal-tag">GOL</span>
        <span class="nhl-bug__goal-team">{{ goalBanner.teamName }}</span>
        <span class="nhl-bug__goal-scorer">{{ goalBanner.scorer }}</span>
        <span v-if="goalBanner.assist" class="nhl-bug__goal-assist">
          A {{ goalBanner.assist }}
        </span>
        <span class="nhl-bug__goal-minute">{{ goalBanner.minute }}</span>
      </div>
    </Transition>

    <Transition name="nhl-goal">
      <div
        v-if="penaltyBanner"
        class="nhl-bug__goal nhl-bug__goal--penalty"
        :class="`nhl-bug__goal--${penaltyBanner.team}`"
      >
        <span class="nhl-bug__goal-tag nhl-bug__goal-tag--penalty">FALTA</span>
        <span class="nhl-bug__goal-team">{{ penaltyBanner.teamName }}</span>
        <span class="nhl-bug__goal-scorer">{{ penaltyBanner.player }}</span>
        <span class="nhl-bug__goal-assist">{{ penaltyBanner.type }}</span>
        <span v-if="penaltyBanner.infraction" class="nhl-bug__goal-assist">
          · {{ penaltyBanner.infraction }}
        </span>
      </div>
    </Transition>
  </div>

  <!-- TV / cancha (pantalla grande) -->
  <div
    v-else-if="tv"
    class="scoreboard scoreboard--tv"
    :class="{ 'scoreboard--compact': compact }"
    :style="{
      '--local-color': state.localColor || '#00d4ff',
      '--visit-color': state.visitColor || '#ff6b35',
    }"
  >
    <div class="scoreboard__glow" />

    <div class="scoreboard__main">
      <div class="scoreboard__column">
        <section class="scoreboard__team scoreboard__team--local">
          <h2 class="scoreboard__team-name">{{ state.localTeam }}</h2>
          <div
            class="scoreboard__score"
            :class="{ 'scoreboard__score--penalty': localPenalties.length > 0 }"
          >
            {{ state.goalLocal }}
          </div>
        </section>
        <div v-if="localPenalties.length" class="scoreboard__penalties">
          <div
            v-for="(penalty, index) in localPenalties"
            :key="`local-${index}`"
            class="scoreboard__penalty-badge"
          >
            {{ formatPenaltyShort(penalty, 'local') }}
          </div>
        </div>
      </div>

      <section class="scoreboard__center">
        <div
          class="scoreboard__clock"
          :class="{
            'scoreboard__clock--paused': state.isPaused,
            'scoreboard__clock--intermission': state.intermissionActive,
          }"
        >
          {{ clock }}
        </div>
        <div
          class="scoreboard__period"
          :class="{ 'scoreboard__period--intermission': state.intermissionActive }"
        >
          {{ centerLabel }}
        </div>
      </section>

      <div class="scoreboard__column">
        <section class="scoreboard__team scoreboard__team--visit">
          <h2 class="scoreboard__team-name">{{ state.visitTeam }}</h2>
          <div
            class="scoreboard__score"
            :class="{ 'scoreboard__score--penalty': visitPenalties.length > 0 }"
          >
            {{ state.goalVisit }}
          </div>
        </section>
        <div v-if="visitPenalties.length" class="scoreboard__penalties">
          <div
            v-for="(penalty, index) in visitPenalties"
            :key="`visit-${index}`"
            class="scoreboard__penalty-badge"
          >
            {{ formatPenaltyShort(penalty, 'visit') }}
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Live / espectadores (responsivo) -->
  <div
    v-else
    class="scoreboard scoreboard--live"
    :class="{ 'scoreboard--compact': compact }"
    :style="{
      '--local-color': state.localColor || '#00d4ff',
      '--visit-color': state.visitColor || '#ff6b35',
    }"
  >
    <div class="scoreboard__glow" />

    <header class="scoreboard__header">
      <span
        class="scoreboard__sport"
        :class="{ 'scoreboard__sport--event': eventTitle }"
      >
        <template v-if="eventTitle">
          {{ eventTitle }}<template v-if="eventDate"> · {{ eventDate }}</template>
        </template>
        <template v-else>Hockey en línea</template>
      </span>
      <span class="scoreboard__period-pill">{{ centerLabel }}</span>
    </header>

    <div class="scoreboard__main scoreboard__main--live">
      <section class="scoreboard__team scoreboard__team--local scoreboard__team--live">
        <div class="scoreboard__team-top">
          <div class="scoreboard__team-meta">
            <span class="scoreboard__team-label">Local</span>
            <h2 class="scoreboard__team-name">{{ state.localTeam }}</h2>
          </div>
          <div
            class="scoreboard__score"
            :class="{ 'scoreboard__score--penalty': localPenalties.length > 0 }"
          >
            {{ state.goalLocal }}
          </div>
        </div>

        <div class="scoreboard__team-details">
          <div class="scoreboard__detail-block">
            <span class="scoreboard__detail-title">Goles</span>
            <div v-if="localGoals.length" class="scoreboard__goals">
              <div
                v-for="goal in localGoals"
                :key="goal.id"
                class="scoreboard__goal-entry"
                :class="{ 'scoreboard__goal-entry--pending': isGoalPending(goal) }"
              >
                {{ formatGoalEntry(goal, 'local') }}
              </div>
            </div>
            <span v-else class="scoreboard__detail-empty">Sin goles</span>
          </div>

          <div class="scoreboard__detail-block">
            <span class="scoreboard__detail-title">Penalidades</span>
            <div v-if="localPenalties.length" class="scoreboard__penalties scoreboard__penalties--live">
              <div
                v-for="(penalty, index) in localPenalties"
                :key="`local-${index}`"
                class="scoreboard__penalty-badge scoreboard__penalty-badge--live"
              >
                {{ formatPenaltyLive(penalty, 'local') }}
              </div>
            </div>
            <span v-else class="scoreboard__detail-empty">Sin faltas</span>
          </div>
        </div>
      </section>

      <section class="scoreboard__center scoreboard__center--live">
        <div class="scoreboard__clock" :class="{ 'scoreboard__clock--paused': state.isPaused }">
          {{ clock }}
        </div>
        <div class="scoreboard__status">
          {{ liveStatus }}
        </div>
      </section>

      <section class="scoreboard__team scoreboard__team--visit scoreboard__team--live">
        <div class="scoreboard__team-top scoreboard__team-top--visit">
          <div
            class="scoreboard__score"
            :class="{ 'scoreboard__score--penalty': visitPenalties.length > 0 }"
          >
            {{ state.goalVisit }}
          </div>
          <div class="scoreboard__team-meta scoreboard__team-meta--visit">
            <span class="scoreboard__team-label">Visita</span>
            <h2 class="scoreboard__team-name">{{ state.visitTeam }}</h2>
          </div>
        </div>

        <div class="scoreboard__team-details">
          <div class="scoreboard__detail-block">
            <span class="scoreboard__detail-title">Goles</span>
            <div v-if="visitGoals.length" class="scoreboard__goals">
              <div
                v-for="goal in visitGoals"
                :key="goal.id"
                class="scoreboard__goal-entry"
                :class="{ 'scoreboard__goal-entry--pending': isGoalPending(goal) }"
              >
                {{ formatGoalEntry(goal, 'visit') }}
              </div>
            </div>
            <span v-else class="scoreboard__detail-empty">Sin goles</span>
          </div>

          <div class="scoreboard__detail-block">
            <span class="scoreboard__detail-title">Penalidades</span>
            <div v-if="visitPenalties.length" class="scoreboard__penalties scoreboard__penalties--live">
              <div
                v-for="(penalty, index) in visitPenalties"
                :key="`visit-${index}`"
                class="scoreboard__penalty-badge scoreboard__penalty-badge--live"
              >
                {{ formatPenaltyLive(penalty, 'visit') }}
              </div>
            </div>
            <span v-else class="scoreboard__detail-empty">Sin faltas</span>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped lang="scss">
/* ——— NHL broadcast score bug (transparent for OBS) ——— */
.nhl-bug {
  --bug-bg: rgba(12, 16, 24, 0.92);
  --bug-border: rgba(255, 255, 255, 0.12);
  --local: #3da5ff;
  --visit: #ff5a36;
  --text: #ffffff;
  --muted: rgba(255, 255, 255, 0.55);

  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 10;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0.85rem 1rem 0;
  pointer-events: none;
  background: transparent;
  font-family: 'Inter', system-ui, sans-serif;
}

.nhl-bug__row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  width: 100%;
  max-width: 1100px;
}

.nhl-bug__side {
  flex: 1 1 0;
  min-width: 0;
  display: flex;
  align-items: center;

  &--local {
    justify-content: flex-end;
  }

  &--visit {
    justify-content: flex-start;
  }
}

.nhl-bug__timers {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.nhl-bug__timer {
  font-family: 'Bebas Neue', sans-serif;
  font-size: 0.9rem;
  letter-spacing: 0.05em;
  color: #fff;
  background: rgba(255, 55, 70, 0.9);
  padding: 0.2rem 0.5rem;
  border-radius: 3px;
  line-height: 1.2;
  white-space: nowrap;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.35);
}

.nhl-bug__bar {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: stretch;
  flex: 0 0 auto;
  width: min(648px, 79vw);
  max-width: 738px;
  height: 48px;
  background: var(--bug-bg);
  border: 1px solid var(--bug-border);
  border-radius: 4px;
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.45);
  overflow: hidden;
}

.nhl-bug__team {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  min-width: 0;
  padding: 0 0.75rem;
}

.nhl-bug__team--local {
  justify-content: flex-start;
}

.nhl-bug__team--visit {
  justify-content: flex-end;
}

.nhl-bug__accent {
  width: 4px;
  align-self: stretch;
  flex-shrink: 0;
  border-radius: 1px;

  &--local {
    background: var(--local);
    margin-left: -0.75rem;
  }

  &--visit {
    background: var(--visit);
    margin-right: -0.75rem;
  }
}

.nhl-bug__logo {
  width: 36px;
  height: 36px;
  flex-shrink: 0;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.12);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.nhl-bug__logo-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
}

.nhl-bug__name {
  flex: 1;
  min-width: 0;
  font-family: 'Bebas Neue', sans-serif;
  font-size: 1.35rem;
  letter-spacing: 0.06em;
  line-height: 1;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;

  &--visit {
    text-align: right;
  }
}

.nhl-bug__score {
  font-family: 'Bebas Neue', sans-serif;
  font-size: 2.15rem;
  line-height: 1;
  color: var(--text);
  min-width: 1.4rem;
  text-align: center;
  flex-shrink: 0;

  &--penalty {
    color: #ff4d5e;
  }
}

.nhl-bug__center {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.05rem;
  padding: 0 1.1rem;
  background: rgba(0, 0, 0, 0.35);
  border-left: 1px solid var(--bug-border);
  border-right: 1px solid var(--bug-border);
  min-width: 7.5rem;
}

.nhl-bug__period {
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--muted);
}

.nhl-bug__clock {
  font-family: 'Bebas Neue', sans-serif;
  font-size: 1.55rem;
  letter-spacing: 0.06em;
  line-height: 1;
  color: var(--text);
  font-variant-numeric: tabular-nums;

  &--paused {
    opacity: 0.7;
  }
}

.nhl-bug__goal {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  width: min(448px, 55vw);
  max-width: 511px;
  margin-top: 0.35rem;
  padding: 0.4rem 0.65rem;
  background: rgba(12, 16, 24, 0.94);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 4px;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.4);
  overflow: hidden;
}

.nhl-bug__goal--local {
  border-left: 3px solid var(--local);
}

.nhl-bug__goal--visit {
  border-left: 3px solid var(--visit);
}

.nhl-bug__goal-tag {
  flex-shrink: 0;
  font-size: 0.62rem;
  font-weight: 800;
  letter-spacing: 0.16em;
  color: #0a0e17;
  background: #ffe566;
  padding: 0.2rem 0.4rem;
  border-radius: 2px;

  &--penalty {
    color: #fff;
    background: #ff3b4e;
  }
}

.nhl-bug__goal-team {
  flex-shrink: 0;
  font-family: 'Bebas Neue', sans-serif;
  font-size: 1rem;
  letter-spacing: 0.04em;
  color: var(--muted);
}

.nhl-bug__goal-scorer {
  font-family: 'Bebas Neue', sans-serif;
  font-size: 1.15rem;
  letter-spacing: 0.04em;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.nhl-bug__goal-assist {
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.nhl-bug__goal-minute {
  margin-left: auto;
  flex-shrink: 0;
  font-family: 'Bebas Neue', sans-serif;
  font-size: 0.95rem;
  letter-spacing: 0.04em;
  color: var(--muted);
}

.nhl-goal-enter-active,
.nhl-goal-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}

.nhl-goal-enter-from,
.nhl-goal-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

/* ——— Shared scoreboard shell ——— */
.scoreboard {
  --local-color: #00d4ff;
  --visit-color: #ff6b35;
  --bg: #0a0e17;
  --panel: rgba(255, 255, 255, 0.04);
  --text: #f0f4ff;
  --muted: rgba(240, 244, 255, 0.55);

  position: relative;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: clamp(1rem, 4vw, 3rem);
  background:
    radial-gradient(ellipse 80% 50% at 50% 0%, rgba(0, 212, 255, 0.08), transparent),
    radial-gradient(ellipse 60% 40% at 100% 100%, rgba(255, 107, 53, 0.06), transparent),
    var(--bg);
  color: var(--text);
  overflow: hidden;
  font-family: 'Inter', system-ui, sans-serif;
}

.scoreboard--compact {
  min-height: auto;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.scoreboard__glow {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    180deg,
    transparent 0%,
    rgba(0, 212, 255, 0.03) 50%,
    transparent 100%
  );
  pointer-events: none;
}

.scoreboard__main {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: clamp(1rem, 3vw, 2.5rem);
  align-items: center;
  position: relative;
  z-index: 1;
  width: 100%;
}

.scoreboard__team {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  padding: clamp(1rem, 3vw, 2rem);
  border-radius: 20px;
  background: var(--panel);
  border: 1px solid rgba(255, 255, 255, 0.06);
  backdrop-filter: blur(12px);
}

.scoreboard__team--local {
  border-color: rgba(0, 212, 255, 0.2);
  box-shadow: inset 0 0 40px rgba(0, 212, 255, 0.05);
}

.scoreboard__team--visit {
  border-color: rgba(255, 107, 53, 0.2);
  box-shadow: inset 0 0 40px rgba(255, 107, 53, 0.05);
}

.scoreboard__team-name {
  margin: 0;
  font-family: 'Bebas Neue', sans-serif;
  font-weight: 400;
  letter-spacing: 0.04em;
  text-align: center;
  line-height: 1.1;
  max-width: 100%;
  word-break: break-word;
}

.scoreboard__team--local .scoreboard__team-name {
  color: var(--local-color);
}

.scoreboard__team--visit .scoreboard__team-name {
  color: var(--visit-color);
}

.scoreboard__score {
  font-family: 'Bebas Neue', sans-serif;
  font-weight: 400;
  line-height: 1;
  text-shadow: 0 0 40px rgba(255, 255, 255, 0.15);
  transition: color 0.2s, transform 0.2s;
}

.scoreboard__score--penalty {
  color: #ff4757;
  animation: pulse 1.5s ease-in-out infinite;
}

.scoreboard__center {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.scoreboard__clock {
  font-family: 'Bebas Neue', sans-serif;
  line-height: 1;
  letter-spacing: 0.06em;
  color: #fff;
  text-shadow: 0 0 60px rgba(0, 212, 255, 0.4);
}

.scoreboard__clock--paused {
  opacity: 0.65;
  text-shadow: none;
}

/* ——— Live responsivo (espectadores) ——— */
.scoreboard--live {
  padding: clamp(1rem, 3vw, 2rem);
  justify-content: flex-start;
  min-height: calc(100vh - 57px);
}

.scoreboard__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: clamp(1rem, 3vw, 1.75rem);
  position: relative;
  z-index: 1;
}

.scoreboard__sport {
  font-size: 0.85rem;
  font-weight: 600;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--muted);
  max-width: min(70%, 28rem);
  line-height: 1.3;
}

.scoreboard__sport--event {
  letter-spacing: 0.04em;
  text-transform: none;
  font-size: clamp(0.85rem, 2.4vw, 1.05rem);
}

.scoreboard__period-pill {
  font-family: 'Bebas Neue', sans-serif;
  font-size: clamp(1.2rem, 3vw, 1.8rem);
  letter-spacing: 0.08em;
  padding: 0.35rem 1rem;
  border-radius: 999px;
  background: var(--panel);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.scoreboard__main--live {
  align-items: stretch;
  gap: clamp(0.75rem, 2vw, 1.5rem);
}

.scoreboard__team--live {
  align-items: stretch;
  gap: 1rem;
  padding: clamp(0.85rem, 2vw, 1.35rem);
}

.scoreboard__team-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  min-width: 0;

  &--visit {
    flex-direction: row;
  }
}

.scoreboard__team-meta {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  min-width: 0;
  flex: 1;

  &--visit {
    align-items: flex-end;
    text-align: right;
  }
}

.scoreboard__team-label {
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: var(--muted);
}

.scoreboard--live .scoreboard__team-name {
  font-size: clamp(1.6rem, 4vw, 2.8rem);
  line-height: 1;
}

.scoreboard--live .scoreboard__score {
  font-size: clamp(3.5rem, 10vw, 6.5rem);
  flex-shrink: 0;
  line-height: 0.9;
}

.scoreboard--live .scoreboard__clock {
  font-size: clamp(2.8rem, 8vw, 5.5rem);
}

.scoreboard__center--live {
  justify-content: center;
  min-width: min(180px, 28vw);
  padding: 0 0.5rem;
}

.scoreboard__status {
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.25em;
  color: var(--muted);
}

.scoreboard__team-details {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
  width: 100%;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  padding-top: 0.85rem;
}

.scoreboard__detail-block {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  min-width: 0;
}

.scoreboard__detail-title {
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--muted);
}

.scoreboard__detail-empty {
  font-size: 0.78rem;
  opacity: 0.4;
}

.scoreboard__goals {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 0.3rem;
  width: 100%;
}

.scoreboard__goal-entry {
  font-family: 'Bebas Neue', sans-serif;
  font-size: clamp(0.95rem, 2.2vw, 1.2rem);
  letter-spacing: 0.05em;
  color: rgba(240, 244, 255, 0.9);
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.08);
  padding: 0.3rem 0.55rem;
  border-radius: 8px;
  line-height: 1.2;

  &--pending {
    opacity: 0.55;
  }
}

.scoreboard__penalties--live {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  align-items: stretch;
  width: 100%;
}

.scoreboard__penalty-badge--live {
  font-size: clamp(0.95rem, 2.2vw, 1.2rem);
  color: #fff;
  background: rgba(255, 71, 87, 0.85);
  padding: 0.3rem 0.55rem;
  border-radius: 8px;
  min-width: 0;
  text-align: left;
}

/* ——— TV / cancha (pantalla grande) ——— */
.scoreboard--tv {
  padding: clamp(0.5rem, 1.5vw, 1.25rem);
}

.scoreboard--tv .scoreboard__main {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  grid-template-rows: auto auto;
  gap: clamp(0.75rem, 2vw, 2rem);
  align-items: stretch;
}

.scoreboard--tv .scoreboard__column {
  display: grid;
  grid-template-rows: subgrid;
  grid-row: 1 / span 2;
  gap: 1rem;
  min-width: 0;
  align-items: stretch;
  height: auto;
}

.scoreboard--tv .scoreboard__team {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1.75rem;
  width: 100%;
  min-height: min(58vh, 620px);
  padding: clamp(1rem, 2.5vw, 2rem);
  border-radius: 24px;
  box-sizing: border-box;
}

.scoreboard--tv .scoreboard__team-name {
  font-size: clamp(3.5rem, 9vw, 7.5rem);
  line-height: 0.95;
  /* Reserva siempre 2 líneas para alinear nombres cortos y largos */
  min-height: calc(2 * 0.95em);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
}

.scoreboard--tv .scoreboard__score {
  font-size: clamp(11rem, 28vw, 22rem);
  line-height: 0.85;
  margin-top: 0.35rem;
  text-shadow: 0 0 50px rgba(255, 255, 255, 0.18);
}

.scoreboard--tv .scoreboard__center {
  grid-row: 1 / span 2;
  gap: 0.5rem;
  align-self: center;
  padding: 0 0.5rem;
}

.scoreboard--tv .scoreboard__period {
  font-family: 'Bebas Neue', sans-serif;
  font-size: clamp(2.2rem, 5vw, 4rem);
  letter-spacing: 0.12em;
  color: var(--muted);
  text-transform: uppercase;
}

.scoreboard--tv .scoreboard__period--intermission {
  color: #f0c14d;
  letter-spacing: 0.18em;
}

.scoreboard--tv .scoreboard__clock--intermission {
  text-shadow: 0 0 70px rgba(240, 193, 77, 0.4);
  color: #ffe9a8;
}

.scoreboard--tv .scoreboard__clock {
  font-size: clamp(9rem, 26vw, 18rem);
  line-height: 0.9;
  letter-spacing: 0.05em;
  text-shadow: 0 0 70px rgba(0, 212, 255, 0.45);
}

.scoreboard--tv .scoreboard__penalties {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.65rem;
  width: 100%;
}

.scoreboard--tv .scoreboard__penalty-badge {
  font-family: 'Bebas Neue', sans-serif;
  font-size: clamp(2.8rem, 7vw, 5rem);
  font-weight: 400;
  letter-spacing: 0.06em;
  color: #fff;
  background: rgba(255, 71, 87, 0.92);
  padding: 0.65rem 1.5rem;
  border-radius: 14px;
  text-align: center;
  line-height: 1.1;
  min-width: 9.5rem;
}

@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.02); }
}

@media (max-width: 768px) {
  .scoreboard__main {
    grid-template-columns: 1fr;
    grid-template-rows: auto auto auto;
  }

  .scoreboard__center {
    order: -1;
  }

  .scoreboard__team-top--visit {
    flex-direction: row-reverse;
  }

  .scoreboard__team-meta--visit {
    align-items: flex-start;
    text-align: left;
  }

  .scoreboard__team-details {
    grid-template-columns: 1fr;
  }

  .nhl-bug__bar {
    height: 46px;
    width: min(504px, 81vw);
  }

  .nhl-bug__name {
    font-size: 1.1rem;
  }
}
</style>
