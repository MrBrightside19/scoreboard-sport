<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import type { ScoreboardState, TeamPenalty } from '@/types/hockeyScoreboard'
import { isGoalPending, MAX_PERIODS } from '@/types/hockeyScoreboard'
import { penaltyTypeLabel } from '@/data/penaltyCatalog'
import { findPlayerById, findPlayerByNumber, playerLabel } from '@/utils/roster'

const props = defineProps<{
  state: ScoreboardState
  displayTime?: string
  displayPenaltiesLocal?: TeamPenalty[]
  displayPenaltiesVisit?: TeamPenalty[]
  overlay?: boolean
  compact?: boolean
}>()

const GOAL_BANNER_MS = 12_000
const activeGoalId = ref<string | null>(null)
let goalHideTimer: number | null = null

const clock = computed(() => props.displayTime ?? props.state.timeGame)

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

const TEAM_NAME_MAX = 15

function truncateTeamName(name: string): string {
  const cleaned = name.trim()
  if (cleaned.length <= TEAM_NAME_MAX) return cleaned
  return `${cleaned.slice(0, TEAM_NAME_MAX)}…`
}

const confirmedGoalIds = computed(() =>
  props.state.goals
    .filter((goal) => !isGoalPending(goal) && goal.scorerPlayerId)
    .map((goal) => goal.id)
    .join(','),
)

watch(
  confirmedGoalIds,
  (next, prev) => {
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

onUnmounted(() => {
  if (goalHideTimer) window.clearTimeout(goalHideTimer)
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

function formatPenaltyShort(penalty: TeamPenalty, team: 'local' | 'visit'): string {
  const roster = team === 'local' ? props.state.rosterLocal : props.state.rosterVisit
  const player = findPlayerByNumber(roster, penalty.player)
  const number = penalty.player.trim() || player?.number || '?'
  return `#${number} ${penalty.time}`
}

function formatPenaltyLabel(penalty: TeamPenalty, team: 'local' | 'visit'): string {
  const roster = team === 'local' ? props.state.rosterLocal : props.state.rosterVisit
  const player = findPlayerByNumber(roster, penalty.player)
  const playerText = player?.name
    ? `#${penalty.player} ${player.name}`
    : penalty.player.trim()
      ? `#${penalty.player}`
      : ''
  const typeText = penaltyTypeLabel(penalty.penaltyTypeId)
  const parts = [playerText, typeText, penalty.time].filter(Boolean)
  return parts.join(' · ')
}
</script>

<template>
  <!-- NHL-style broadcast bug (OBS overlay) -->
  <div v-if="overlay" class="nhl-bug">
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
        <span class="nhl-bug__period">{{ periodLabel }}</span>
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

    <div
      v-if="localPenalties.length || visitPenalties.length"
      class="nhl-bug__penalties"
    >
      <div class="nhl-bug__penalties-side nhl-bug__penalties-side--local">
        <span
          v-for="(penalty, index) in localPenalties"
          :key="`local-${index}`"
          class="nhl-bug__penalty"
        >
          {{ formatPenaltyShort(penalty, 'local') }}
        </span>
      </div>
      <div class="nhl-bug__penalties-side nhl-bug__penalties-side--visit">
        <span
          v-for="(penalty, index) in visitPenalties"
          :key="`visit-${index}`"
          class="nhl-bug__penalty"
        >
          {{ formatPenaltyShort(penalty, 'visit') }}
        </span>
      </div>
    </div>
  </div>

  <!-- Full / TV scoreboard -->
  <div
    v-else
    class="scoreboard"
    :class="{ 'scoreboard--compact': compact }"
  >
    <div class="scoreboard__glow" />

    <header class="scoreboard__header">
      <span class="scoreboard__sport">Hockey en línea</span>
      <span class="scoreboard__period">Periodo {{ state.gamePeriod }}</span>
    </header>

    <div class="scoreboard__main">
      <section class="scoreboard__team scoreboard__team--local">
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
        <div v-if="localPenalties.length" class="scoreboard__penalties">
          <div
            v-for="(penalty, index) in localPenalties"
            :key="`local-${index}`"
            class="scoreboard__penalty-badge"
          >
            {{ formatPenaltyLabel(penalty, 'local') }}
          </div>
        </div>
      </section>

      <section class="scoreboard__center">
        <div class="scoreboard__clock" :class="{ 'scoreboard__clock--paused': state.isPaused }">
          {{ clock }}
        </div>
        <div class="scoreboard__status">
          {{ state.isPaused ? 'PAUSA' : 'EN JUEGO' }}
        </div>
      </section>

      <section class="scoreboard__team scoreboard__team--visit">
        <div class="scoreboard__team-meta">
          <span class="scoreboard__team-label">Visita</span>
          <h2 class="scoreboard__team-name">{{ state.visitTeam }}</h2>
        </div>
        <div
          class="scoreboard__score"
          :class="{ 'scoreboard__score--penalty': visitPenalties.length > 0 }"
        >
          {{ state.goalVisit }}
        </div>
        <div v-if="visitPenalties.length" class="scoreboard__penalties">
          <div
            v-for="(penalty, index) in visitPenalties"
            :key="`visit-${index}`"
            class="scoreboard__penalty-badge"
          >
            {{ formatPenaltyLabel(penalty, 'visit') }}
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

.nhl-bug__bar {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: stretch;
  min-width: min(520px, 92vw);
  max-width: 640px;
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

.nhl-bug__penalties {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.35rem 1.5rem;
  width: min(520px, 92vw);
  max-width: 640px;
  margin-top: 0.35rem;
  padding: 0 0.25rem;
}

.nhl-bug__penalties-side {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;

  &--visit {
    justify-content: flex-end;
  }
}

.nhl-bug__penalty {
  font-family: 'Bebas Neue', sans-serif;
  font-size: 0.85rem;
  letter-spacing: 0.05em;
  color: #fff;
  background: rgba(255, 55, 70, 0.88);
  padding: 0.15rem 0.45rem;
  border-radius: 2px;
  line-height: 1.2;
}

.nhl-bug__goal {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  width: min(520px, 92vw);
  max-width: 640px;
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

/* ——— Full / TV scoreboard ——— */
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

.scoreboard__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: clamp(1.5rem, 4vw, 3rem);
  position: relative;
  z-index: 1;
}

.scoreboard__sport {
  font-size: 0.85rem;
  font-weight: 600;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--muted);
}

.scoreboard__period {
  font-family: 'Bebas Neue', sans-serif;
  font-size: clamp(1.2rem, 3vw, 1.8rem);
  letter-spacing: 0.08em;
  padding: 0.35rem 1rem;
  border-radius: 999px;
  background: var(--panel);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.scoreboard__main {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: clamp(1rem, 3vw, 2.5rem);
  align-items: center;
  position: relative;
  z-index: 1;
}

.scoreboard__team {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
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

.scoreboard__team-label {
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: var(--muted);
}

.scoreboard__team-name {
  margin: 0;
  font-family: 'Bebas Neue', sans-serif;
  font-size: clamp(1.8rem, 5vw, 3.2rem);
  font-weight: 400;
  letter-spacing: 0.04em;
  text-align: center;
  line-height: 1.1;
}

.scoreboard__team--local .scoreboard__team-name {
  color: var(--local-color);
}

.scoreboard__team--visit .scoreboard__team-name {
  color: var(--visit-color);
}

.scoreboard__score {
  font-family: 'Bebas Neue', sans-serif;
  font-size: clamp(4rem, 12vw, 8rem);
  line-height: 1;
  font-weight: 400;
  text-shadow: 0 0 40px rgba(255, 255, 255, 0.15);
  transition: color 0.2s, transform 0.2s;
}

.scoreboard__score--penalty {
  color: #ff4757;
  animation: pulse 1.5s ease-in-out infinite;
}

.scoreboard__penalties {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  width: 100%;
  align-items: center;
}

.scoreboard__penalty-badge {
  font-family: 'Bebas Neue', sans-serif;
  font-size: clamp(0.95rem, 2.5vw, 1.2rem);
  font-weight: 400;
  letter-spacing: 0.06em;
  color: #ff4757;
  background: rgba(255, 71, 87, 0.15);
  padding: 0.35rem 0.85rem;
  border-radius: 8px;
  min-width: 5.5rem;
  text-align: center;
}

.scoreboard__center {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.scoreboard__clock {
  font-family: 'Bebas Neue', sans-serif;
  font-size: clamp(3rem, 10vw, 6.5rem);
  line-height: 1;
  letter-spacing: 0.06em;
  color: #fff;
  text-shadow: 0 0 60px rgba(0, 212, 255, 0.4);
}

.scoreboard__clock--paused {
  opacity: 0.65;
  text-shadow: none;
}

.scoreboard__status {
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.25em;
  color: var(--muted);
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

  .nhl-bug__bar {
    height: 46px;
  }

  .nhl-bug__name {
    font-size: 1.1rem;
  }
}
</style>
