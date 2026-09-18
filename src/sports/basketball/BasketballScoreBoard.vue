<script setup lang="ts">
import { computed } from 'vue'
import type { ScoreboardState } from '@/sports/scoreboardState'
import { getSportModule } from '@/sports/registry'
import { isInBonus, teamFoulsInPeriod } from '@/sports/basketball/actions'
import { basketballPointsLabel } from '@/sports/basketball/types'
import { findPlayerById, playerLabel } from '@/utils/roster'

const props = defineProps<{
  state: ScoreboardState
  displayTime?: string
  displayIntermissionTime?: string
  eventTitle?: string | null
  eventDate?: string | null
}>()

const sport = computed(() => getSportModule('basketball'))
const clock = computed(() => {
  if (props.state.intermissionActive) {
    return props.displayIntermissionTime ?? props.state.intermissionTime
  }
  return props.displayTime ?? props.state.timeGame
})
const period = computed(() =>
  props.state.intermissionActive
    ? 'Descanso'
    : sport.value.periodLabel(props.state.gamePeriod),
)
const status = computed(() =>
  props.state.intermissionActive
    ? 'DESCANSO'
    : props.state.isPaused
      ? 'PAUSA'
      : 'EN JUEGO',
)

const lastScore = computed(() => {
  const items = props.state.basketballScores ?? []
  return items[items.length - 1] ?? null
})

const lastScoreLabel = computed(() => {
  const event = lastScore.value
  if (!event) return ''
  const roster = event.team === 'local' ? props.state.rosterLocal : props.state.rosterVisit
  const player = findPlayerById(roster, event.scorerPlayerId)
  const who = player
    ? playerLabel(player)
    : event.team === 'local'
      ? props.state.localTeam
      : props.state.visitTeam
  return `+${event.points} ${basketballPointsLabel(event.points)} · ${who}`
})
</script>

<template>
  <div
    class="bball-live"
    :style="{
      '--local': state.localColor || '#f77f00',
      '--visit': state.visitColor || '#003049',
    }"
  >
    <header class="bball-live__head">
      <span>{{ eventTitle || sport.label }}</span>
      <span v-if="eventDate">{{ eventDate }}</span>
      <span>{{ period }}</span>
    </header>

    <div class="bball-live__row">
      <section class="bball-live__team">
        <p class="bball-live__name">{{ state.localTeam }}</p>
        <p class="bball-live__score bball-live__score--local">{{ state.goalLocal }}</p>
        <p class="bball-live__fouls">
          Faltas {{ teamFoulsInPeriod(state, 'local') }}
          <span v-if="isInBonus(state, 'local')" class="bball-live__bonus">BONUS</span>
        </p>
      </section>

      <section class="bball-live__center">
        <p class="bball-live__clock" :class="{ 'is-paused': state.isPaused }">{{ clock }}</p>
        <p class="bball-live__status">{{ status }}</p>
        <p v-if="lastScore" class="bball-live__last">{{ lastScoreLabel }}</p>
      </section>

      <section class="bball-live__team bball-live__team--visit">
        <p class="bball-live__name">{{ state.visitTeam }}</p>
        <p class="bball-live__score bball-live__score--visit">{{ state.goalVisit }}</p>
        <p class="bball-live__fouls">
          Faltas {{ teamFoulsInPeriod(state, 'visit') }}
          <span v-if="isInBonus(state, 'visit')" class="bball-live__bonus">BONUS</span>
        </p>
      </section>
    </div>
  </div>
</template>

<style scoped lang="scss">
.bball-live {
  min-height: 100%;
  padding: 1.25rem;
  color: #fff8ef;
  background:
    radial-gradient(circle at 20% 0, rgba(247, 127, 0, 0.28), transparent 38%),
    radial-gradient(circle at 80% 100%, rgba(0, 48, 73, 0.45), transparent 40%),
    #1a120b;
}

.bball-live__head {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.25rem;
  font-size: 0.82rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  opacity: 0.72;
}

.bball-live__row {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 1.25rem;
  align-items: center;
}

.bball-live__name {
  margin: 0 0 0.35rem;
  font-size: clamp(1.1rem, 3vw, 2rem);
  font-weight: 700;
}

.bball-live__score {
  margin: 0;
  font-family: 'Bebas Neue', sans-serif;
  font-size: clamp(4rem, 12vw, 8rem);
  line-height: 0.9;

  &--local { color: var(--local); }
  &--visit { color: var(--visit); }
}

.bball-live__team--visit {
  text-align: right;
}

.bball-live__fouls {
  margin: 0.4rem 0 0;
  font-size: 0.78rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  opacity: 0.78;
}

.bball-live__bonus {
  margin-left: 0.4rem;
  color: #f77f00;
  font-weight: 800;
}

.bball-live__center {
  text-align: center;
}

.bball-live__clock {
  margin: 0;
  font-variant-numeric: tabular-nums;
  font-size: clamp(1.8rem, 5vw, 3.2rem);
  font-weight: 700;

  &.is-paused {
    opacity: 0.7;
  }
}

.bball-live__status {
  margin: 0.35rem 0 0;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  font-size: 0.78rem;
  opacity: 0.7;
}

.bball-live__last {
  margin: 0.55rem 0 0;
  font-size: 0.78rem;
  opacity: 0.78;
}
</style>
