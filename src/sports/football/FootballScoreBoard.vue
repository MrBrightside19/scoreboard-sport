<script setup lang="ts">
import { computed } from 'vue'
import type { ScoreboardState } from '@/sports/scoreboardState'
import { getSportModule } from '@/sports/registry'
import { cardCount } from '@/sports/football/actions'

const props = defineProps<{
  state: ScoreboardState
  displayTime?: string
  displayIntermissionTime?: string
  eventTitle?: string | null
  eventDate?: string | null
}>()

const sport = computed(() => getSportModule('football'))
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
</script>

<template>
  <div
    class="football-live"
    :style="{
      '--local': state.localColor || '#0b6e4f',
      '--visit': state.visitColor || '#c1121f',
    }"
  >
    <header class="football-live__head">
      <span>{{ eventTitle || sport.label }}</span>
      <span v-if="eventDate">{{ eventDate }}</span>
      <span>{{ period }}</span>
    </header>

    <div class="football-live__row">
      <section class="football-live__team">
        <p class="football-live__name">{{ state.localTeam }}</p>
        <p class="football-live__score football-live__score--local">{{ state.goalLocal }}</p>
        <p class="football-live__stats">
          A {{ cardCount(state, 'local', 'yellow') }}
          · R {{ cardCount(state, 'local', 'red') }}
        </p>
      </section>

      <section class="football-live__center">
        <p class="football-live__clock" :class="{ 'is-paused': state.isPaused }">{{ clock }}</p>
        <p class="football-live__status">{{ status }}</p>
      </section>

      <section class="football-live__team football-live__team--visit">
        <p class="football-live__name">{{ state.visitTeam }}</p>
        <p class="football-live__score football-live__score--visit">{{ state.goalVisit }}</p>
        <p class="football-live__stats">
          A {{ cardCount(state, 'visit', 'yellow') }}
          · R {{ cardCount(state, 'visit', 'red') }}
        </p>
      </section>
    </div>
  </div>
</template>

<style scoped lang="scss">
.football-live {
  min-height: 100%;
  padding: 1.25rem;
  color: #f3f8f4;
  background:
    radial-gradient(circle at top, rgba(11, 110, 79, 0.22), transparent 42%),
    #0a120e;
}

.football-live__head {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.25rem;
  font-size: 0.82rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  opacity: 0.72;
}

.football-live__row {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 1.25rem;
  align-items: center;
}

.football-live__name {
  margin: 0 0 0.35rem;
  font-size: clamp(1.1rem, 3vw, 2rem);
  font-weight: 700;
}

.football-live__score {
  margin: 0;
  font-family: 'Bebas Neue', sans-serif;
  font-size: clamp(4rem, 12vw, 8rem);
  line-height: 0.9;

  &--local { color: var(--local); }
  &--visit { color: var(--visit); }
}

.football-live__stats {
  margin: 0.45rem 0 0;
  font-size: 0.78rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  opacity: 0.78;
}

.football-live__team--visit {
  text-align: right;
}

.football-live__center {
  text-align: center;
}

.football-live__clock {
  margin: 0;
  font-variant-numeric: tabular-nums;
  font-size: clamp(1.8rem, 5vw, 3.2rem);
  font-weight: 700;

  &.is-paused {
    opacity: 0.7;
  }
}

.football-live__status {
  margin: 0.35rem 0 0;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  font-size: 0.78rem;
  opacity: 0.7;
}
</style>
