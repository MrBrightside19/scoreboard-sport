<script setup lang="ts">
import { computed } from 'vue'
import type { ScoreboardState } from '@/sports/scoreboardState'
import { getSportModule } from '@/sports/registry'
import { cardCount } from '@/sports/football/actions'

const props = defineProps<{
  state: ScoreboardState
  displayTime?: string
  displayIntermissionTime?: string
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
    ? 'DES'
    : sport.value.periodLabel(props.state.gamePeriod),
)
</script>

<template>
  <div
    class="football-overlay"
    :style="{
      '--local': state.localColor || '#0b6e4f',
      '--visit': state.visitColor || '#c1121f',
    }"
  >
    <div class="football-overlay__team">
      <span class="football-overlay__accent" />
      <span class="football-overlay__name">{{ state.localTeam }}</span>
      <strong>{{ state.goalLocal }}</strong>
      <small>
        A{{ cardCount(state, 'local', 'yellow') }}
        R{{ cardCount(state, 'local', 'red') }}
      </small>
    </div>
    <div class="football-overlay__center">
      <span>{{ period }}</span>
      <span class="football-overlay__clock" :class="{ 'is-paused': state.isPaused }">
        {{ clock }}
      </span>
    </div>
    <div class="football-overlay__team football-overlay__team--visit">
      <small>
        A{{ cardCount(state, 'visit', 'yellow') }}
        R{{ cardCount(state, 'visit', 'red') }}
      </small>
      <strong>{{ state.goalVisit }}</strong>
      <span class="football-overlay__name">{{ state.visitTeam }}</span>
      <span class="football-overlay__accent football-overlay__accent--visit" />
    </div>
  </div>
</template>

<style scoped lang="scss">
.football-overlay {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: stretch;
  min-height: 56px;
  max-width: 720px;
  margin: 0.75rem auto 0;
  overflow: hidden;
  border-radius: 10px;
  background: rgba(8, 18, 12, 0.86);
  color: #f4fbf6;
  backdrop-filter: blur(10px);
}

.football-overlay__team {
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
    letter-spacing: 0.04em;
    text-transform: uppercase;
    opacity: 0.75;
    white-space: nowrap;
  }

  &--visit strong {
    color: var(--visit);
  }
}

.football-overlay__name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.88rem;
  font-weight: 700;
}

.football-overlay__accent {
  width: 4px;
  align-self: stretch;
  background: var(--local);

  &--visit {
    background: var(--visit);
  }
}

.football-overlay__center {
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

.football-overlay__clock {
  font-variant-numeric: tabular-nums;
  font-size: 1.05rem;
  font-weight: 700;
  letter-spacing: 0;

  &.is-paused {
    opacity: 0.7;
  }
}
</style>
