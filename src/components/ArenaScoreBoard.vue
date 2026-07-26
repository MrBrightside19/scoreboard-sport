<script setup lang="ts">
import { computed } from 'vue'
import type { ScoreboardState, TeamPenalty } from '@/types/hockeyScoreboard'
import { MAX_PENALTIES_PER_TEAM, MAX_PERIODS } from '@/types/hockeyScoreboard'
import { findPlayerById, findPlayerByNumber } from '@/utils/roster'

const props = defineProps<{
  state: ScoreboardState
  displayTime?: string
  displayIntermissionTime?: string
  displayPenaltiesLocal?: TeamPenalty[]
  displayPenaltiesVisit?: TeamPenalty[]
  /** Vista reducida para el selector de estilos (no pantalla completa). */
  preview?: boolean
}>()

const TEAM_NAME_MAX = 16
/** Bajo este largo el nombre siempre entra a tamaño completo. */
const TEAM_NAME_MIN_FIT = 10

const clock = computed(() => {
  if (props.state.intermissionActive) {
    return props.displayIntermissionTime ?? props.state.intermissionTime
  }
  return props.displayTime ?? props.state.timeGame
})

const arenaClock = computed(() => {
  const raw = clock.value.replace(/[^\d:]/g, '')
  return raw || '0:00'
})

const periodDigit = computed(() => {
  if (props.state.intermissionActive) return '-'
  if (props.state.gamePeriod > MAX_PERIODS) return '4'
  return String(Math.max(0, Math.min(9, props.state.gamePeriod)))
})

const localPenalties = computed(
  () => props.displayPenaltiesLocal ?? props.state.penaltiesLocal,
)
const visitPenalties = computed(
  () => props.displayPenaltiesVisit ?? props.state.penaltiesVisit,
)

function shotTotals(team: 'local' | 'visit'): { misses: number; saves: number } {
  const shots = props.state.shots ?? []
  return {
    misses: shots.filter((shot) => shot.team === team && shot.result === 'miss').length,
    saves: shots.filter((shot) => shot.team === team && shot.result === 'save').length,
  }
}

/**
 * Tiros a puerta del equipo:
 * - goles
 * - tiros registrados (miss = tiro al arco del equipo)
 * - atajadas del arquero rival (save del otro equipo)
 */
const localShotsOnGoal = computed(() => {
  const local = shotTotals('local')
  const visit = shotTotals('visit')
  return props.state.goalLocal + local.misses + visit.saves
})
const visitShotsOnGoal = computed(() => {
  const local = shotTotals('local')
  const visit = shotTotals('visit')
  return props.state.goalVisit + visit.misses + local.saves
})

function penaltySlots(team: 'local' | 'visit'): Array<TeamPenalty | null> {
  const source = team === 'local' ? localPenalties.value : visitPenalties.value
  const slots: Array<TeamPenalty | null> = source.slice(0, MAX_PENALTIES_PER_TEAM)
  while (slots.length < MAX_PENALTIES_PER_TEAM) slots.push(null)
  return slots
}

const localSlots = computed(() => penaltySlots('local'))
const visitSlots = computed(() => penaltySlots('visit'))

function formatTeamName(name: string): string {
  const cleaned = name.trim().replace(/\s+/g, ' ')
  if (!cleaned) return ''

  const parts = cleaned.split(' ')
  if (parts.length >= 2) {
    const initial = parts[0]!.charAt(0)
    const rest = parts.slice(1).join(' ')
    return `${initial}. ${rest}`
  }

  return cleaned
}

function displayTeamName(name: string): string {
  const formatted = formatTeamName(name)
  if (formatted.length <= TEAM_NAME_MAX) return formatted
  return `${formatted.slice(0, TEAM_NAME_MAX)}…`
}

/** Reduce la tipografía en nombres largos para que nunca se recorten. */
function teamNameStyle(name: string): Record<string, string> {
  const length = Math.max(displayTeamName(name).length, TEAM_NAME_MIN_FIT)
  return { '--arena-name-len': String(length) }
}

function playerNumber(penalty: TeamPenalty | null, team: 'local' | 'visit'): string {
  if (!penalty) return ''
  const roster = team === 'local' ? props.state.rosterLocal : props.state.rosterVisit
  const player =
    findPlayerById(roster, penalty.playerId) ?? findPlayerByNumber(roster, penalty.player)
  const number = (penalty.player.trim() || player?.number.trim() || '').replace(/\D/g, '')
  if (!number) return '--'
  return number.slice(0, 2)
}

function penaltyTime(penalty: TeamPenalty | null): string {
  if (!penalty) return ''
  return penalty.time.trim() || '0:00'
}
</script>

<template>
  <div
    class="arena"
    :class="{
      'arena--preview': preview,
      'arena--paused': state.isPaused,
      'arena--intermission': state.intermissionActive,
    }"
  >
    <div class="arena__panel">
      <div class="arena__top">
        <div class="arena__side">
          <span class="arena__team" :style="teamNameStyle(state.localTeam)">
            {{ displayTeamName(state.localTeam) }}
          </span>
          <div class="arena__cell arena__cell--score">{{ state.goalLocal }}</div>
        </div>

        <div class="arena__center">
          <span class="arena__team arena__team--spacer" aria-hidden="true">&nbsp;</span>
          <div
            class="arena__cell arena__cell--clock"
            :class="{ 'arena__cell--blink': state.isPaused }"
          >
            <span class="arena__clock-value">{{ arenaClock }}</span>
          </div>
        </div>

        <div class="arena__side">
          <span class="arena__team" :style="teamNameStyle(state.visitTeam)">
            {{ displayTeamName(state.visitTeam) }}
          </span>
          <div class="arena__cell arena__cell--score">{{ state.goalVisit }}</div>
        </div>
      </div>

      <div class="arena__bottom">
        <div class="arena__penalties">
          <div class="arena__penalty-head">
            <span class="arena__label">#</span>
            <span class="arena__label">FALTA</span>
          </div>
          <div
            v-for="(penalty, index) in localSlots"
            :key="`local-${index}`"
            class="arena__penalty-row"
            :class="{ 'arena__penalty-row--empty': !penalty }"
          >
            <div class="arena__cell arena__cell--player">
              {{ playerNumber(penalty, 'local') || '!!' }}
            </div>
            <div class="arena__cell arena__cell--penalty">
              {{ penaltyTime(penalty) || '!:!!' }}
            </div>
          </div>
        </div>

        <div class="arena__bottom-center">
          <div class="arena__period">
            <span class="arena__label">
              {{ state.intermissionActive ? 'DESCANSO' : 'PERIODO' }}
            </span>
            <div class="arena__cell arena__cell--period">{{ periodDigit }}</div>
          </div>
          <div class="arena__shots">
            <span class="arena__label">TIROS A PUERTA</span>
            <div class="arena__shots-row">
              <div class="arena__cell arena__cell--shots">{{ localShotsOnGoal }}</div>
              <div class="arena__cell arena__cell--shots">{{ visitShotsOnGoal }}</div>
            </div>
          </div>
        </div>

        <div class="arena__penalties">
          <div class="arena__penalty-head">
            <span class="arena__label">#</span>
            <span class="arena__label">FALTA</span>
          </div>
          <div
            v-for="(penalty, index) in visitSlots"
            :key="`visit-${index}`"
            class="arena__penalty-row"
            :class="{ 'arena__penalty-row--empty': !penalty }"
          >
            <div class="arena__cell arena__cell--player">
              {{ playerNumber(penalty, 'visit') || '!!' }}
            </div>
            <div class="arena__cell arena__cell--penalty">
              {{ penaltyTime(penalty) || '!:!!' }}
            </div>
          </div>
        </div>
      </div>

 
    </div>
  </div>
</template>

<style scoped lang="scss">
.arena {
  --arena-bg: #3a4658;
  --arena-frame: rgba(255, 255, 255, 0.9);
  --arena-cell: #05070c;
  --arena-label: #f4f7fb;
  --arena-yellow: #ffb31a;
  --arena-red: #ff2d2d;
  --arena-green: #3cff4a;
  --arena-font: 'DSEG7 Classic', 'Courier New', monospace;

  box-sizing: border-box;
  width: 100vw;
  height: 100vh;
  height: 100dvh;
  margin: 0;
  padding: 1.5vh 1.5vw;
  display: flex;
  align-items: stretch;
  justify-content: stretch;
  background: #0a0e17;
  color: var(--arena-label);
  overflow: hidden;
}

.arena--preview {
  width: 100%;
  height: 100%;
  padding: 2.5%;
}

.arena__panel {
  flex: 1;
  min-height: 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 2.2vh;
  padding: 2.4vh 2vw;
  border: 0.35vh solid var(--arena-frame);
  border-radius: 0.6vh;
  background: linear-gradient(180deg, #465468 0%, var(--arena-bg) 45%, #313b4b 100%);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.18),
    0 1.5vh 4vh rgba(0, 0, 0, 0.45);
}

.arena__top {
  flex: 2.4;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 50vw minmax(0, 1fr);
  gap: 1vw;
  align-items: stretch;
}

.arena__side,
.arena__center {
  position: relative;
  min-width: 0;
  min-height: 0;
  height: 100%;
}

.arena__side {
  container-type: inline-size;
  container-name: arena-side;
}

.arena__team--spacer {
  visibility: hidden;
}

.arena__period {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.8vh;
}

.arena__period .arena__label,
.arena__shots .arena__label {
  font-size: clamp(1.33rem, 3.28vh, 2.42rem);
}

.arena__label {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: clamp(0.85rem, 2.1vh, 1.55rem);
  font-weight: 800;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--arena-label);
  line-height: 1;
  text-align: center;
}

.arena__team {
  --arena-name-len: 10;

  position: absolute;
  inset: 0 0 auto;
  box-sizing: border-box;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  height: 10vh;
  max-height: 10vh;
  padding-inline: 0.4vw;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'Inter', system-ui, sans-serif;
  /* Escala al ancho real de la columna lateral para no cortar el nombre. */
  font-size: min(
    clamp(3.59rem, 8.81vh, 6.55rem),
    calc(92cqi / (var(--arena-name-len) * 0.62))
  );
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--arena-label);
  text-align: center;
  line-height: 1.1;
  white-space: nowrap;
  overflow: hidden;
}

.arena__cell {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 0;
  padding: 0.8vh 1vw;
  border-radius: 0.45vh;
  background: var(--arena-cell);
  box-shadow:
    inset 0 0 0 1px rgba(255, 255, 255, 0.06),
    inset 0 1.2vh 2.2vh rgba(0, 0, 0, 0.55);
  font-family: var(--arena-font);
  font-weight: 700;
  line-height: 1;
  letter-spacing: 0.06em;
  text-shadow: 0 0 1.2vh currentColor;
}

.arena__cell--score {
  position: absolute;
  top: 11.4vh;
  bottom: 0;
  left: 6%;
  width: 88%;
  min-width: 0;
  min-height: 0;
  height: auto;
  font-size: clamp(6.4rem, 25vh, 20rem);
  color: var(--arena-red);
}

.arena__cell--clock {
  position: absolute;
  inset: 11.4vh 0 0;
  width: 100%;
  min-height: 0;
  height: auto;
  font-size: clamp(4.55rem, 14.57vw, 19.67rem);
  line-height: 1.15;
  letter-spacing: 0;
  color: var(--arena-yellow);
  /* Más aire a ambos lados; DSEG sigue necesitando menos padding izq. */
  padding: 3vh 5.8vw 3vh 3.4vw;
  box-sizing: border-box;
  overflow: hidden;
  white-space: nowrap;
  justify-content: center;
  text-align: center;
}

.arena__clock-value {
  display: block;
  transform: translateX(-2.4vw);
}

.arena__cell--period {
  width: min(16.56vw, 12.42rem);
  min-height: 13.8vh;
  font-size: clamp(2.76rem, 11.04vh, 7.6rem);
  color: var(--arena-green);
}

.arena__cell--player,
.arena__cell--penalty {
  min-height: 13.65vh;
  font-size: clamp(2.21rem, 7.54vh, 5.33rem);
  padding: 1.56vh 0.72vw;
}

.arena__cell--player {
  color: var(--arena-yellow);
}

.arena__cell--penalty,
.arena__cell--shots {
  color: var(--arena-red);
}

.arena__cell--shots {
  min-height: 11.4vh;
  font-size: clamp(2.16rem, 6.6vh, 4.8rem);
}

.arena__cell--blink {
  animation: arena-blink 1.1s steps(1, end) infinite;
}

.arena__bottom {
  flex: 0 0 auto;
  display: grid;
  grid-template-columns: 1fr minmax(18vw, 26vw) 1fr;
  gap: 2.5vw;
  align-items: end;
  padding-inline: 2vw;
}

.arena__bottom-center {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  gap: 1.4vh;
  min-width: 0;
  padding-bottom: 0.15vh;
}

.arena__penalties {
  display: flex;
  flex-direction: column;
  gap: 1.25vh;
  min-width: 0;
  width: min(100%, 34vw);
}

.arena__penalties:first-child {
  justify-self: start;
}

.arena__penalties:last-child {
  justify-self: end;
}

.arena__penalty-head,
.arena__penalty-row {
  display: grid;
  grid-template-columns: 0.72fr 1.28fr;
  gap: 0.55vw;
}

.arena__penalty-head .arena__label {
  font-size: clamp(1.91rem, 4.73vh, 3.47rem);
}

.arena__penalty-row--empty .arena__cell {
  color: rgba(255, 179, 26, 0.18);
  text-shadow: none;
}

.arena__penalty-row--empty .arena__cell--penalty {
  color: rgba(255, 45, 45, 0.18);
}

.arena__shots {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.85vh;
  width: 100%;
  margin-top: 0;
}

.arena__shots-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.85vw;
  width: 100%;
}


@keyframes arena-blink {
  0%,
  49% {
    opacity: 1;
  }
  50%,
  100% {
    opacity: 0.28;
  }
}
</style>
