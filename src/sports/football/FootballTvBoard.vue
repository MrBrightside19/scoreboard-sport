<script setup lang="ts">
import { computed } from 'vue'
import type { ScoreboardState } from '@/sports/scoreboardState'
import { getSportModule } from '@/sports/registry'
import { useScoreboardDisplayPrefs } from '@/composables/useScoreboardDisplayPrefs'
import { cardCount } from '@/sports/football/actions'
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

const sport = computed(() => getSportModule('football'))
const { tvStyle: prefStyle } = useScoreboardDisplayPrefs(() => 'football')
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
</script>

<template>
  <div
    class="football-tv"
    :class="{
      'football-tv--light': light,
      'football-tv--preview': preview,
    }"
    :style="{
      '--local': state.localColor || '#0b6e4f',
      '--visit': state.visitColor || '#c1121f',
    }"
  >
    <header class="football-tv__head">
      <span>{{ eventTitle || 'Fútbol FIFA' }}</span>
      <span v-if="eventDate">{{ eventDate }}</span>
      <span>{{ status }}</span>
    </header>

    <div class="football-tv__row">
      <section class="football-tv__team">
        <p class="football-tv__name">{{ state.localTeam }}</p>
        <p class="football-tv__score football-tv__score--local">{{ state.goalLocal }}</p>
        <div class="football-tv__meta">
          <span class="football-tv__yc">A {{ cardCount(state, 'local', 'yellow') }}</span>
          <span class="football-tv__rc">R {{ cardCount(state, 'local', 'red') }}</span>
        </div>
      </section>

      <section class="football-tv__center">
        <p class="football-tv__period">{{ period }}</p>
        <p class="football-tv__clock" :class="{ 'is-paused': state.isPaused }">{{ clock }}</p>
      </section>

      <section class="football-tv__team football-tv__team--visit">
        <p class="football-tv__name">{{ state.visitTeam }}</p>
        <p class="football-tv__score football-tv__score--visit">{{ state.goalVisit }}</p>
        <div class="football-tv__meta">
          <span class="football-tv__yc">A {{ cardCount(state, 'visit', 'yellow') }}</span>
          <span class="football-tv__rc">R {{ cardCount(state, 'visit', 'red') }}</span>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped lang="scss">
.football-tv {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: clamp(1.5rem, 4vw, 3.5rem);
  color: #eef6f0;
  background:
    radial-gradient(circle at 50% 0, rgba(11, 110, 79, 0.28), transparent 46%),
    linear-gradient(180deg, #06110c 0%, #0c1a12 100%);
}

.football-tv--preview {
  min-height: 100%;
  width: 100%;
  height: 100%;
  padding: 2.5rem 3rem;
}

.football-tv--light {
  color: #102016;
  background:
    radial-gradient(circle at 50% 0, rgba(11, 110, 79, 0.14), transparent 46%),
    #eef4f0;
}

.football-tv__head {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 2rem;
  font-size: 0.82rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  opacity: 0.62;
}

.football-tv__row {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: clamp(1rem, 4vw, 3rem);
  align-items: center;
}

.football-tv__name {
  margin: 0 0 0.4rem;
  font-size: clamp(1.4rem, 4vw, 2.6rem);
  font-weight: 700;
}

.football-tv__score {
  margin: 0;
  font-family: 'Bebas Neue', sans-serif;
  font-size: clamp(6rem, 16vw, 11rem);
  line-height: 0.85;

  &--local { color: var(--local); }
  &--visit { color: var(--visit); }
}

.football-tv__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
  align-items: center;
  margin-top: 0.65rem;
  font-size: 0.95rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  opacity: 0.88;
}

.football-tv__team--visit {
  text-align: right;

  .football-tv__meta {
    justify-content: flex-end;
  }
}

.football-tv__center {
  text-align: center;
  min-width: 10rem;
}

.football-tv__period {
  margin: 0 0 0.35rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  font-size: 0.9rem;
  opacity: 0.7;
}

.football-tv__clock {
  margin: 0;
  font-variant-numeric: tabular-nums;
  font-size: clamp(2.4rem, 7vw, 4.4rem);
  font-weight: 700;

  &.is-paused {
    opacity: 0.65;
  }
}
</style>
