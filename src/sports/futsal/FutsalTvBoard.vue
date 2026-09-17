<script setup lang="ts">
import { computed } from 'vue'
import type { ScoreboardState } from '@/sports/scoreboardState'
import { getSportModule } from '@/sports/registry'
import { useScoreboardDisplayPrefs } from '@/composables/useScoreboardDisplayPrefs'
import {
  accumulatedFoulsInPeriod,
  activeExclusions,
  isInDoublePenalty,
  timeoutsUsedInPeriod,
} from '@/sports/futsal/actions'
import { FUTSAL_ACCUMULATED_FOUL_LIMIT } from '@/sports/futsal/types'
import {
  isClassicLightTvStyle,
  type TvScoreboardStyle,
} from '@/config/scoreboardStyles'

const props = defineProps<{
  state: ScoreboardState
  displayTime?: string
  displayIntermissionTime?: string
  preview?: boolean
  tvStyle?: TvScoreboardStyle
  eventTitle?: string | null
  eventDate?: string | null
}>()

const sport = computed(() => getSportModule('futsal'))
const { tvStyle: prefStyle } = useScoreboardDisplayPrefs(() => 'futsal')
const style = computed(() => props.tvStyle ?? prefStyle.value)
const light = computed(() => isClassicLightTvStyle(style.value))

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

const localExclusions = computed(() => activeExclusions(props.state, 'local'))
const visitExclusions = computed(() => activeExclusions(props.state, 'visit'))
</script>

<template>
  <div
    class="futsal-tv"
    :class="{
      'futsal-tv--light': light,
      'futsal-tv--preview': preview,
    }"
    :style="{
      '--local': state.localColor || '#1b9aaa',
      '--visit': state.visitColor || '#e4572e',
    }"
  >
    <header class="futsal-tv__head">
      <span>{{ eventTitle || 'Futsal FIFA' }}</span>
      <span v-if="eventDate">{{ eventDate }}</span>
      <span>{{ status }}</span>
    </header>

    <div class="futsal-tv__row">
      <section class="futsal-tv__team">
        <p class="futsal-tv__name">{{ state.localTeam }}</p>
        <p class="futsal-tv__score futsal-tv__score--local">{{ state.goalLocal }}</p>
        <div class="futsal-tv__meta">
          <span>
            FA {{ accumulatedFoulsInPeriod(state, 'local') }}/{{ FUTSAL_ACCUMULATED_FOUL_LIMIT }}
          </span>
          <span v-if="isInDoublePenalty(state, 'local')" class="futsal-tv__dp">DP</span>
          <span v-if="timeoutsUsedInPeriod(state, 'local')" class="futsal-tv__tm">TM</span>
        </div>
        <ul v-if="localExclusions.length" class="futsal-tv__excl">
          <li v-for="item in localExclusions" :key="item.id">
            {{ item.player || '#' }} · {{ item.time }}
          </li>
        </ul>
      </section>

      <section class="futsal-tv__center">
        <p class="futsal-tv__period">{{ period }}</p>
        <p class="futsal-tv__clock" :class="{ 'is-paused': state.isPaused }">{{ clock }}</p>
      </section>

      <section class="futsal-tv__team futsal-tv__team--visit">
        <p class="futsal-tv__name">{{ state.visitTeam }}</p>
        <p class="futsal-tv__score futsal-tv__score--visit">{{ state.goalVisit }}</p>
        <div class="futsal-tv__meta">
          <span>
            FA {{ accumulatedFoulsInPeriod(state, 'visit') }}/{{ FUTSAL_ACCUMULATED_FOUL_LIMIT }}
          </span>
          <span v-if="isInDoublePenalty(state, 'visit')" class="futsal-tv__dp">DP</span>
          <span v-if="timeoutsUsedInPeriod(state, 'visit')" class="futsal-tv__tm">TM</span>
        </div>
        <ul v-if="visitExclusions.length" class="futsal-tv__excl">
          <li v-for="item in visitExclusions" :key="item.id">
            {{ item.player || '#' }} · {{ item.time }}
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>

<style scoped lang="scss">
.futsal-tv {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: clamp(1.5rem, 4vw, 3.5rem);
  color: #eef8f8;
  background:
    radial-gradient(circle at 50% 0, rgba(27, 154, 170, 0.22), transparent 46%),
    linear-gradient(180deg, #071216 0%, #0c181c 100%);
}

.futsal-tv--preview {
  min-height: 100%;
  width: 100%;
  height: 100%;
  padding: 2.5rem 3rem;
}

.futsal-tv--light {
  color: #102026;
  background:
    radial-gradient(circle at 50% 0, rgba(27, 154, 170, 0.14), transparent 46%),
    #eef4f4;
}

.futsal-tv__head {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 2rem;
  font-size: 0.82rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  opacity: 0.62;
}

.futsal-tv__row {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: clamp(1rem, 4vw, 3rem);
  align-items: center;
}

.futsal-tv__name {
  margin: 0 0 0.4rem;
  font-size: clamp(1.4rem, 4vw, 2.6rem);
  font-weight: 700;
}

.futsal-tv__score {
  margin: 0;
  font-family: 'Bebas Neue', sans-serif;
  font-size: clamp(6rem, 16vw, 11rem);
  line-height: 0.85;

  &--local { color: var(--local); }
  &--visit { color: var(--visit); }
}

.futsal-tv__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  align-items: center;
  margin-top: 0.65rem;
  font-size: 0.9rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  opacity: 0.82;
}

.futsal-tv__dp {
  color: #ff6b35;
  font-weight: 800;
}

.futsal-tv__tm {
  padding: 0.1rem 0.4rem;
  border-radius: 4px;
  border: 1px solid currentColor;
  font-size: 0.72rem;
  font-weight: 700;
}

.futsal-tv__excl {
  margin: 0.55rem 0 0;
  padding: 0;
  list-style: none;
  font-variant-numeric: tabular-nums;
  font-size: 0.86rem;
  opacity: 0.85;
}

.futsal-tv__team--visit {
  text-align: right;

  .futsal-tv__meta,
  .futsal-tv__excl {
    justify-content: flex-end;
  }
}

.futsal-tv__center {
  text-align: center;
  min-width: 10rem;
}

.futsal-tv__period {
  margin: 0 0 0.35rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  font-size: 0.9rem;
  opacity: 0.7;
}

.futsal-tv__clock {
  margin: 0;
  font-variant-numeric: tabular-nums;
  font-size: clamp(2.4rem, 7vw, 4.4rem);
  font-weight: 700;

  &.is-paused {
    opacity: 0.65;
  }
}
</style>
