<script setup lang="ts">
import { computed } from 'vue'
import type { ScoreboardState } from '@/sports/scoreboardState'
import { getSportModule } from '@/sports/registry'
import {
  accumulatedFoulsInPeriod,
  isInDoublePenalty,
  timeoutsUsedInPeriod,
} from '@/sports/futsal/actions'
import { FUTSAL_ACCUMULATED_FOUL_LIMIT } from '@/sports/futsal/types'

const props = defineProps<{
  state: ScoreboardState
  displayTime?: string
  displayIntermissionTime?: string
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
    ? 'DES'
    : sport.value.periodLabel(props.state.gamePeriod),
)
</script>

<template>
  <div
    class="futsal-overlay"
    :style="{
      '--local': state.localColor || '#1b9aaa',
      '--visit': state.visitColor || '#e4572e',
    }"
  >
    <div class="futsal-overlay__team">
      <span class="futsal-overlay__accent" />
      <span class="futsal-overlay__name">{{ state.localTeam }}</span>
      <strong>{{ state.goalLocal }}</strong>
      <small>
        FA {{ accumulatedFoulsInPeriod(state, 'local') }}/{{ FUTSAL_ACCUMULATED_FOUL_LIMIT }}
        <em v-if="isInDoublePenalty(state, 'local')">DP</em>
        <em v-if="timeoutsUsedInPeriod(state, 'local')">TM</em>
      </small>
    </div>
    <div class="futsal-overlay__center">
      <span>{{ period }}</span>
      <span class="futsal-overlay__clock" :class="{ 'is-paused': state.isPaused }">
        {{ clock }}
      </span>
    </div>
    <div class="futsal-overlay__team futsal-overlay__team--visit">
      <small>
        FA {{ accumulatedFoulsInPeriod(state, 'visit') }}/{{ FUTSAL_ACCUMULATED_FOUL_LIMIT }}
        <em v-if="isInDoublePenalty(state, 'visit')">DP</em>
        <em v-if="timeoutsUsedInPeriod(state, 'visit')">TM</em>
      </small>
      <strong>{{ state.goalVisit }}</strong>
      <span class="futsal-overlay__name">{{ state.visitTeam }}</span>
      <span class="futsal-overlay__accent futsal-overlay__accent--visit" />
    </div>
  </div>
</template>

<style scoped lang="scss">
.futsal-overlay {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: stretch;
  min-height: 56px;
  max-width: 720px;
  margin: 0.75rem auto 0;
  overflow: hidden;
  border-radius: 10px;
  background: rgba(8, 16, 18, 0.86);
  color: #f4fbfb;
  backdrop-filter: blur(10px);
}

.futsal-overlay__team {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  min-width: 0;
  padding: 0 0.65rem;

  strong {
    font-family: 'Bebas Neue', sans-serif;
    font-size: 1.7rem;
    line-height: 1;
    color: var(--local);
  }

  small {
    font-size: 0.62rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    opacity: 0.75;
    white-space: nowrap;
  }

  em {
    margin-left: 0.25rem;
    font-style: normal;
    font-weight: 800;
    color: #ff6b35;
  }

  &--visit strong {
    color: var(--visit);
  }
}

.futsal-overlay__name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.88rem;
  font-weight: 700;
}

.futsal-overlay__accent {
  width: 4px;
  align-self: stretch;
  background: var(--local);

  &--visit {
    background: var(--visit);
  }
}

.futsal-overlay__center {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 0.3rem 0.85rem;
  background: rgba(255, 255, 255, 0.05);
  font-size: 0.68rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.futsal-overlay__clock {
  font-variant-numeric: tabular-nums;
  font-size: 1.05rem;
  font-weight: 700;
  letter-spacing: 0;

  &.is-paused {
    opacity: 0.7;
  }
}
</style>
