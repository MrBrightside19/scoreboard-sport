<script setup lang="ts">
import { computed } from 'vue'
import type { ScoreboardState } from '@/types/hockeyScoreboard'

const props = defineProps<{
  state: ScoreboardState
  displayTime?: string
  displayPenalty?: string
  overlay?: boolean
  compact?: boolean
}>()

const clock = computed(() => props.displayTime ?? props.state.timeGame)
const penalty = computed(() => props.displayPenalty ?? props.state.penaltyGame)
</script>

<template>
  <div
    class="scoreboard"
    :class="{ 'scoreboard--overlay': overlay, 'scoreboard--compact': compact }"
  >
    <div class="scoreboard__glow" />

    <header class="scoreboard__header">
      <span class="scoreboard__sport">Hockey en línea</span>
      <span class="scoreboard__period">Periodo {{ state.gamePeriod }}</span>
    </header>

    <div class="scoreboard__main">
      <section class="scoreboard__team scoreboard__team--local">
        <div class="scoreboard__team-meta">
          <span class="scoreboard__team-label">Local</span>
          <h2 class="scoreboard__team-name">{{ state.localTeam }}</h2>
        </div>
        <div
          class="scoreboard__score"
          :class="{ 'scoreboard__score--penalty': state.penalizedLocal }"
        >
          {{ state.goalLocal }}
        </div>
        <div v-if="state.penalizedLocal" class="scoreboard__penalty-badge">
          Penalidad {{ penalty }}
        </div>
      </section>

      <section class="scoreboard__center">
        <div class="scoreboard__clock" :class="{ 'scoreboard__clock--paused': state.isPaused }">
          {{ clock }}
        </div>
        <div class="scoreboard__status">
          {{ state.isPaused ? 'PAUSA' : 'EN JUEGO' }}
        </div>
      </section>

      <section class="scoreboard__team scoreboard__team--visit">
        <div class="scoreboard__team-meta">
          <span class="scoreboard__team-label">Visita</span>
          <h2 class="scoreboard__team-name">{{ state.visitTeam }}</h2>
        </div>
        <div
          class="scoreboard__score"
          :class="{ 'scoreboard__score--penalty': state.penalizedVisit }"
        >
          {{ state.goalVisit }}
        </div>
        <div v-if="state.penalizedVisit" class="scoreboard__penalty-badge">
          Penalidad {{ penalty }}
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped lang="scss">
.scoreboard {
  --local-color: #00d4ff;
  --visit-color: #ff6b35;
  --bg: #0a0e17;
  --panel: rgba(255, 255, 255, 0.04);
  --text: #f0f4ff;
  --muted: rgba(240, 244, 255, 0.55);

  position: relative;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: clamp(1rem, 4vw, 3rem);
  background:
    radial-gradient(ellipse 80% 50% at 50% 0%, rgba(0, 212, 255, 0.08), transparent),
    radial-gradient(ellipse 60% 40% at 100% 100%, rgba(255, 107, 53, 0.06), transparent),
    var(--bg);
  color: var(--text);
  overflow: hidden;
  font-family: 'Inter', system-ui, sans-serif;
}

.scoreboard--overlay {
  min-height: 100vh;
  padding: 2rem;
}

.scoreboard--compact {
  min-height: auto;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.scoreboard__glow {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    180deg,
    transparent 0%,
    rgba(0, 212, 255, 0.03) 50%,
    transparent 100%
  );
  pointer-events: none;
}

.scoreboard__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: clamp(1.5rem, 4vw, 3rem);
  position: relative;
  z-index: 1;
}

.scoreboard__sport {
  font-size: 0.85rem;
  font-weight: 600;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--muted);
}

.scoreboard__period {
  font-family: 'Bebas Neue', sans-serif;
  font-size: clamp(1.2rem, 3vw, 1.8rem);
  letter-spacing: 0.08em;
  padding: 0.35rem 1rem;
  border-radius: 999px;
  background: var(--panel);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.scoreboard__main {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: clamp(1rem, 3vw, 2.5rem);
  align-items: center;
  position: relative;
  z-index: 1;
}

.scoreboard__team {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: clamp(1rem, 3vw, 2rem);
  border-radius: 20px;
  background: var(--panel);
  border: 1px solid rgba(255, 255, 255, 0.06);
  backdrop-filter: blur(12px);
}

.scoreboard__team--local {
  border-color: rgba(0, 212, 255, 0.2);
  box-shadow: inset 0 0 40px rgba(0, 212, 255, 0.05);
}

.scoreboard__team--visit {
  border-color: rgba(255, 107, 53, 0.2);
  box-shadow: inset 0 0 40px rgba(255, 107, 53, 0.05);
}

.scoreboard__team-label {
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: var(--muted);
}

.scoreboard__team-name {
  margin: 0;
  font-family: 'Bebas Neue', sans-serif;
  font-size: clamp(1.8rem, 5vw, 3.2rem);
  font-weight: 400;
  letter-spacing: 0.04em;
  text-align: center;
  line-height: 1.1;
}

.scoreboard__team--local .scoreboard__team-name {
  color: var(--local-color);
}

.scoreboard__team--visit .scoreboard__team-name {
  color: var(--visit-color);
}

.scoreboard__score {
  font-family: 'Bebas Neue', sans-serif;
  font-size: clamp(4rem, 12vw, 8rem);
  line-height: 1;
  font-weight: 400;
  text-shadow: 0 0 40px rgba(255, 255, 255, 0.15);
  transition: color 0.2s, transform 0.2s;
}

.scoreboard__score--penalty {
  color: #ff4757;
  animation: pulse 1.5s ease-in-out infinite;
}

.scoreboard__penalty-badge {
  font-size: 0.85rem;
  font-weight: 600;
  color: #ff4757;
  background: rgba(255, 71, 87, 0.15);
  padding: 0.35rem 0.85rem;
  border-radius: 8px;
  letter-spacing: 0.05em;
}

.scoreboard__center {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.scoreboard__clock {
  font-family: 'Bebas Neue', sans-serif;
  font-size: clamp(3rem, 10vw, 6.5rem);
  line-height: 1;
  letter-spacing: 0.06em;
  color: #fff;
  text-shadow: 0 0 60px rgba(0, 212, 255, 0.4);
}

.scoreboard__clock--paused {
  opacity: 0.65;
  text-shadow: none;
}

.scoreboard__status {
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.25em;
  color: var(--muted);
}

@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.02); }
}

@media (max-width: 768px) {
  .scoreboard__main {
    grid-template-columns: 1fr;
    grid-template-rows: auto auto auto;
  }

  .scoreboard__center {
    order: -1;
  }
}
</style>
