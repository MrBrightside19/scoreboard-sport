<script setup lang="ts">
import { computed } from 'vue'
import type { ScoreboardState } from '@/sports/scoreboardState'
import { getSportModule } from '@/sports/registry'
import {
  accumulatedFoulsInPeriod,
  activeExclusions,
  isInDoublePenalty,
  timeoutsUsedInPeriod,
} from '@/sports/futsal/actions'
import { FUTSAL_ACCUMULATED_FOUL_LIMIT } from '@/sports/futsal/types'

const props = defineProps<{
  state: ScoreboardState
  displayTime?: string
  displayIntermissionTime?: string
  eventTitle?: string | null
  eventDate?: string | null
}>()

const sport = computed(() => getSportModule('futsal'))
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
    class="futsal-live"
    :style="{
      '--local': state.localColor || '#1b9aaa',
      '--visit': state.visitColor || '#e4572e',
    }"
  >
    <header class="futsal-live__head">
      <span>{{ eventTitle || sport.label }}</span>
      <span v-if="eventDate">{{ eventDate }}</span>
      <span>{{ period }}</span>
    </header>

    <div class="futsal-live__row">
      <section class="futsal-live__team">
        <p class="futsal-live__name">{{ state.localTeam }}</p>
        <p class="futsal-live__score futsal-live__score--local">{{ state.goalLocal }}</p>
        <p class="futsal-live__stats">
          FA {{ accumulatedFoulsInPeriod(state, 'local') }}/{{ FUTSAL_ACCUMULATED_FOUL_LIMIT }}
          <span v-if="isInDoublePenalty(state, 'local')" class="futsal-live__dp">DP</span>
          <span v-if="timeoutsUsedInPeriod(state, 'local')"> · TM</span>
          <span v-if="activeExclusions(state, 'local').length">
            · 2′×{{ activeExclusions(state, 'local').length }}
          </span>
        </p>
      </section>

      <section class="futsal-live__center">
        <p class="futsal-live__clock" :class="{ 'is-paused': state.isPaused }">{{ clock }}</p>
        <p class="futsal-live__status">{{ status }}</p>
      </section>

      <section class="futsal-live__team futsal-live__team--visit">
        <p class="futsal-live__name">{{ state.visitTeam }}</p>
        <p class="futsal-live__score futsal-live__score--visit">{{ state.goalVisit }}</p>
        <p class="futsal-live__stats">
          FA {{ accumulatedFoulsInPeriod(state, 'visit') }}/{{ FUTSAL_ACCUMULATED_FOUL_LIMIT }}
          <span v-if="isInDoublePenalty(state, 'visit')" class="futsal-live__dp">DP</span>
          <span v-if="timeoutsUsedInPeriod(state, 'visit')"> · TM</span>
          <span v-if="activeExclusions(state, 'visit').length">
            · 2′×{{ activeExclusions(state, 'visit').length }}
          </span>
        </p>
      </section>
    </div>
  </div>
</template>

<style scoped lang="scss">
.futsal-live {
  min-height: 100%;
  padding: 1.25rem;
  color: #f4f7fb;
  background:
    radial-gradient(circle at top, rgba(27, 154, 170, 0.18), transparent 42%),
    #0c1418;
}

.futsal-live__head {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.25rem;
  font-size: 0.82rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  opacity: 0.72;
}

.futsal-live__row {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 1.25rem;
  align-items: center;
}

.futsal-live__name {
  margin: 0 0 0.35rem;
  font-size: clamp(1.1rem, 3vw, 2rem);
  font-weight: 700;
}

.futsal-live__score {
  margin: 0;
  font-family: 'Bebas Neue', sans-serif;
  font-size: clamp(4rem, 12vw, 8rem);
  line-height: 0.9;

  &--local { color: var(--local); }
  &--visit { color: var(--visit); }
}

.futsal-live__stats {
  margin: 0.45rem 0 0;
  font-size: 0.78rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  opacity: 0.78;
}

.futsal-live__dp {
  margin-left: 0.35rem;
  color: #ff6b35;
  font-weight: 800;
}

.futsal-live__team--visit {
  text-align: right;
}

.futsal-live__center {
  text-align: center;
}

.futsal-live__clock {
  margin: 0;
  font-variant-numeric: tabular-nums;
  font-size: clamp(1.8rem, 5vw, 3.2rem);
  font-weight: 700;

  &.is-paused {
    opacity: 0.7;
  }
}

.futsal-live__status {
  margin: 0.35rem 0 0;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  font-size: 0.78rem;
  opacity: 0.7;
}
</style>
