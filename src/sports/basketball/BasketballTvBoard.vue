<script setup lang="ts">
import { computed } from 'vue'
import type { ScoreboardState } from '@/sports/scoreboardState'
import { getSportModule } from '@/sports/registry'
import { isInBonus, teamFoulsInPeriod } from '@/sports/basketball/actions'
import { basketballPointsLabel } from '@/sports/basketball/types'
import { findPlayerById, playerLabel } from '@/utils/roster'
import { useScoreboardDisplayPrefs } from '@/composables/useScoreboardDisplayPrefs'
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

const sport = computed(() => getSportModule('basketball'))
const { tvStyle: prefStyle } = useScoreboardDisplayPrefs(() => 'basketball')
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
    class="bball-tv"
    :class="{
      'bball-tv--light': light,
      'bball-tv--preview': preview,
    }"
    :style="{
      '--local': state.localColor || '#f77f00',
      '--visit': state.visitColor || '#003049',
    }"
  >
    <header class="bball-tv__head">
      <span>{{ eventTitle || sport.label }}</span>
      <span v-if="eventDate">{{ eventDate }}</span>
      <span>{{ status }}</span>
    </header>

    <div class="bball-tv__row">
      <section class="bball-tv__team">
        <p class="bball-tv__name">{{ state.localTeam }}</p>
        <p class="bball-tv__score bball-tv__score--local">{{ state.goalLocal }}</p>
        <p class="bball-tv__fouls">
          Faltas {{ teamFoulsInPeriod(state, 'local') }}
          <span v-if="isInBonus(state, 'local')" class="bball-tv__bonus">BONUS</span>
        </p>
      </section>

      <section class="bball-tv__center">
        <p class="bball-tv__period">{{ period }}</p>
        <p class="bball-tv__clock" :class="{ 'is-paused': state.isPaused }">{{ clock }}</p>
        <p v-if="lastScore" class="bball-tv__last">{{ lastScoreLabel }}</p>
      </section>

      <section class="bball-tv__team bball-tv__team--visit">
        <p class="bball-tv__name">{{ state.visitTeam }}</p>
        <p class="bball-tv__score bball-tv__score--visit">{{ state.goalVisit }}</p>
        <p class="bball-tv__fouls">
          Faltas {{ teamFoulsInPeriod(state, 'visit') }}
          <span v-if="isInBonus(state, 'visit')" class="bball-tv__bonus">BONUS</span>
        </p>
      </section>
    </div>
  </div>
</template>

<style scoped lang="scss">
.bball-tv {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: clamp(1.5rem, 4vw, 3.5rem);
  color: #fff8ef;
  background:
    radial-gradient(circle at 18% 0, rgba(247, 127, 0, 0.32), transparent 40%),
    radial-gradient(circle at 82% 100%, rgba(0, 48, 73, 0.5), transparent 42%),
    #140e09;
}

.bball-tv--preview {
  min-height: 100%;
  width: 100%;
  height: 100%;
  padding: 2.5rem 3rem;
}

.bball-tv--light {
  color: #1a120b;
  background:
    radial-gradient(circle at 18% 0, rgba(247, 127, 0, 0.16), transparent 40%),
    #f4ece2;
}

.bball-tv__head {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 2rem;
  font-size: 0.82rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  opacity: 0.62;
}

.bball-tv__row {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: clamp(1rem, 4vw, 3rem);
  align-items: center;
}

.bball-tv__name {
  margin: 0 0 0.4rem;
  font-size: clamp(1.4rem, 4vw, 2.6rem);
  font-weight: 700;
}

.bball-tv__score {
  margin: 0;
  font-family: 'Bebas Neue', sans-serif;
  font-size: clamp(6rem, 16vw, 11rem);
  line-height: 0.85;

  &--local { color: var(--local); }
  &--visit { color: var(--visit); }
}

.bball-tv__team--visit {
  text-align: right;
}

.bball-tv__fouls {
  margin: 0.55rem 0 0;
  font-size: 0.86rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  opacity: 0.78;
}

.bball-tv__bonus {
  margin-left: 0.45rem;
  color: #f77f00;
  font-weight: 800;
}

.bball-tv__center {
  text-align: center;
  min-width: 10rem;
}

.bball-tv__period {
  margin: 0 0 0.35rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  font-size: 0.9rem;
  opacity: 0.7;
}

.bball-tv__clock {
  margin: 0;
  font-variant-numeric: tabular-nums;
  font-size: clamp(2.4rem, 7vw, 4.4rem);
  font-weight: 700;

  &.is-paused {
    opacity: 0.65;
  }
}

.bball-tv__last {
  margin: 0.7rem 0 0;
  font-size: 0.82rem;
  opacity: 0.78;
}
</style>
