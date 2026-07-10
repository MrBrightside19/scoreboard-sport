<script setup lang="ts">
import type { LiveMatchSummary } from '@/types/match'

defineProps<{
  match: LiveMatchSummary
}>()
</script>

<template>
  <router-link :to="`/live/${match.id}`" class="live-card">
    <div class="live-card__badge">
      <span class="live-card__dot" />
      En vivo
    </div>
    <h3 class="live-card__title">{{ match.title }}</h3>
    <div class="live-card__score">
      <span>{{ match.localTeam }}</span>
      <strong>{{ match.goalLocal }} — {{ match.goalVisit }}</strong>
      <span>{{ match.visitTeam }}</span>
    </div>
    <p v-if="match.court" class="live-card__meta">Cancha {{ match.court }}</p>
  </router-link>
</template>

<style scoped lang="scss">
.live-card {
  display: block;
  padding: 1.25rem;
  border-radius: 14px;
  background: linear-gradient(145deg, rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0.02));
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: inherit;
  text-decoration: none;
  transition: transform 0.2s, border-color 0.2s;

  &:hover {
    transform: translateY(-2px);
    border-color: rgba(0, 212, 255, 0.35);
  }
}

.live-card__badge {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #ff6b6b;
  margin-bottom: 0.75rem;
}

.live-card__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #ff6b6b;
  animation: blink 1.2s infinite;
}

.live-card__title {
  margin: 0 0 0.75rem;
  font-size: 1.1rem;
}

.live-card__score {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 0.5rem;
  align-items: center;
  font-size: 0.9rem;

  strong {
    font-family: 'Bebas Neue', sans-serif;
    font-size: 1.8rem;
    letter-spacing: 0.05em;
  }

  span:first-child { text-align: right; }
}

.live-card__meta {
  margin: 0.75rem 0 0;
  font-size: 0.8rem;
  opacity: 0.6;
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}
</style>
