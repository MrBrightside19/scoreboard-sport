<script setup lang="ts">
import { computed } from 'vue'
import type { ScoreboardState } from '@/sports/scoreboardState'
import { getSportModule } from '@/sports/registry'
import { isInBonus, teamFoulsInPeriod } from '@/sports/basketball/actions'

const props = defineProps<{
  state: ScoreboardState
  displayTime?: string
  displayIntermissionTime?: string
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
    ? 'DES'
    : sport.value.periodLabel(props.state.gamePeriod),
)
</script>

<template>
  <div
    class="bball-overlay"
    :style="{
      '--local': state.localColor || '#f77f00',
      '--visit': state.visitColor || '#c9a227',
    }"
  >
    <div class="bball-overlay__team">
      <span class="bball-overlay__name">{{ state.localTeam }}</span>
      <strong>{{ state.goalLocal }}</strong>
      <small>
        F {{ teamFoulsInPeriod(state, 'local') }}
        <em v-if="isInBonus(state, 'local')">B</em>
      </small>
    </div>
    <div class="bball-overlay__center">
      <span>{{ period }}</span>
      <span class="bball-overlay__clock" :class="{ 'is-paused': state.isPaused }">
        {{ clock }}
      </span>
    </div>
    <div class="bball-overlay__team bball-overlay__team--visit">
      <small>
        F {{ teamFoulsInPeriod(state, 'visit') }}
        <em v-if="isInBonus(state, 'visit')">B</em>
      </small>
      <strong>{{ state.goalVisit }}</strong>
      <span class="bball-overlay__name">{{ state.visitTeam }}</span>
    </div>
  </div>
</template>

<style scoped lang="scss">
.bball-overlay {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: stretch;
  min-height: 56px;
  max-width: 680px;
  margin: 0.75rem auto 0;
  overflow: hidden;
  border-radius: 10px;
  background: rgba(16, 10, 6, 0.86);
  color: #fff8ef;
  backdrop-filter: blur(10px);
}

.bball-overlay__team {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
  padding: 0 0.75rem;

  strong {
    font-family: 'Bebas Neue', sans-serif;
    font-size: 1.75rem;
    line-height: 1;
    color: var(--local);
  }

  small {
    font-size: 0.68rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    opacity: 0.72;
  }

  em {
    font-style: normal;
    font-weight: 800;
    color: #f77f00;
  }

  &--visit strong {
    color: var(--visit);
  }
}

.bball-overlay__name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.9rem;
  font-weight: 700;
}

.bball-overlay__center {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 0.3rem 0.9rem;
  background: rgba(247, 127, 0, 0.12);
  font-size: 0.68rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.bball-overlay__clock {
  font-variant-numeric: tabular-nums;
  font-size: 1.05rem;
  font-weight: 700;
  letter-spacing: 0;

  &.is-paused {
    opacity: 0.7;
  }
}
</style>
