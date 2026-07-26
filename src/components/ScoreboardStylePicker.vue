<script setup lang="ts">
import { computed } from 'vue'
import ScoreBoard from '@/components/ScoreBoard.vue'
import ArenaScoreBoard from '@/components/ArenaScoreBoard.vue'
import { createDefaultScoreboardState } from '@/types/hockeyScoreboard'
import type {
  OverlayScoreboardStyle,
  ScoreboardStyleOption,
  TvScoreboardStyle,
} from '@/config/scoreboardStyles'
import {
  OVERLAY_SCOREBOARD_STYLES,
  TV_SCOREBOARD_STYLES,
} from '@/config/scoreboardStyles'

const props = defineProps<{
  mode: 'tv' | 'overlay'
  modelValue: TvScoreboardStyle | OverlayScoreboardStyle
}>()

const emit = defineEmits<{
  'update:modelValue': [value: TvScoreboardStyle | OverlayScoreboardStyle]
}>()

const options = computed(() =>
  props.mode === 'tv' ? TV_SCOREBOARD_STYLES : OVERLAY_SCOREBOARD_STYLES,
)

const previewState = createDefaultScoreboardState('Tiburones', 'Halcones')
previewState.goalLocal = 3
previewState.goalVisit = 2
previewState.gamePeriod = 2
previewState.timeGame = '12:45'
previewState.matchCategory = 'U15'
previewState.localColor = '#3da5ff'
previewState.visitColor = '#ff5a36'
previewState.penaltiesLocal = [
  {
    id: 'preview-p1',
    playerId: '',
    player: '12',
    penaltyTypeId: 'minor',
    infraction: '',
    time: '1:42',
  },
]
previewState.shots = [
  {
    id: 'preview-s1',
    team: 'visit',
    result: 'save',
    goalkeeperPlayerId: '',
    gameMinute: '10:00',
    period: 2,
    createdAt: '',
  },
  {
    id: 'preview-s2',
    team: 'local',
    result: 'save',
    goalkeeperPlayerId: '',
    gameMinute: '11:00',
    period: 2,
    createdAt: '',
  },
]

function select(option: ScoreboardStyleOption<string>): void {
  if (option.id === props.modelValue) return
  emit('update:modelValue', option.id as TvScoreboardStyle | OverlayScoreboardStyle)
}

function isSelected(id: string): boolean {
  return props.modelValue === id
}
</script>

<template>
  <div class="style-picker" role="listbox" :aria-label="mode === 'tv' ? 'Estilo TV' : 'Estilo overlay'">
    <button
      v-for="option in options"
      :key="option.id"
      type="button"
      role="option"
      class="style-picker__card"
      :class="{ 'style-picker__card--selected': isSelected(option.id) }"
      :aria-selected="isSelected(option.id)"
      @click="select(option)"
    >
      <div
        class="style-picker__preview"
        :class="mode === 'tv' ? 'style-picker__preview--tv' : 'style-picker__preview--overlay'"
        aria-hidden="true"
      >
        <div class="style-picker__preview-stage">
          <div
            class="style-picker__preview-inner"
            :class="mode === 'tv' ? 'style-picker__preview-inner--tv' : 'style-picker__preview-inner--overlay'"
          >
            <ArenaScoreBoard
              v-if="mode === 'tv' && option.id === 'arena'"
              preview
              :state="previewState"
            />
            <ScoreBoard
              v-else-if="mode === 'tv'"
              tv
              class="style-picker__classic-tv"
              :state="previewState"
            />
            <ScoreBoard
              v-else
              overlay
              :overlay-style="option.id as OverlayScoreboardStyle"
              :state="previewState"
            />
          </div>
        </div>
      </div>

      <div class="style-picker__meta">
        <div class="style-picker__title-row">
          <strong>{{ option.label }}</strong>
          <span v-if="isSelected(option.id)" class="style-picker__badge">Activo</span>
        </div>
        <p>{{ option.description }}</p>
      </div>
    </button>
  </div>
</template>

<style scoped lang="scss">
.style-picker {
  display: grid;
  gap: 0.75rem;
  width: 100%;
}

.style-picker__card {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  width: 100%;
  padding: 0.85rem;
  border-radius: 12px;
  border: 1px solid var(--app-border);
  background: var(--app-bg-elevated);
  color: var(--app-text);
  text-align: center;
  cursor: pointer;
  transition: border-color 0.15s, box-shadow 0.15s;

  &:hover {
    border-color: color-mix(in srgb, var(--app-link) 40%, transparent);
  }

  &--selected {
    border-color: color-mix(in srgb, var(--app-link) 65%, transparent);
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--app-link) 35%, transparent);
  }
}

.style-picker__preview {
  position: relative;
  overflow: hidden;
  border-radius: 8px;
  padding: 0.7rem;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  background:
    linear-gradient(145deg, rgba(8, 12, 20, 0.92), rgba(18, 24, 36, 0.88)),
    repeating-conic-gradient(
      from 0deg,
      rgba(255, 255, 255, 0.04) 0deg 10deg,
      transparent 10deg 20deg
    );
  pointer-events: none;
}

.style-picker__preview--tv {
  height: 176px;
}

.style-picker__preview--overlay {
  height: 128px;
}

.style-picker__preview-stage {
  position: relative;
  flex-shrink: 0;
  transform-origin: center center;
}

.style-picker__preview--tv .style-picker__preview-stage {
  /* Caja visual centrada; el stage grande se escala desde el centro. */
  width: calc(1280px * 0.2);
  height: calc(720px * 0.2);
}

.style-picker__preview-inner--tv {
  position: absolute;
  top: 0;
  left: 0;
  width: 1280px;
  height: 720px;
  transform: scale(0.2);
  transform-origin: top left;
}

.style-picker__preview--tv :deep(.arena--preview) {
  width: 1280px;
  height: 720px;
}

/* Clásico: en miniatura los vh/vw del viewport lo apelotonan; forzamos aire. */
.style-picker__preview--tv :deep(.style-picker__classic-tv.scoreboard--tv) {
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  padding: 2.75rem 3.25rem;
  display: flex;
  align-items: stretch;
}

.style-picker__preview--tv :deep(.style-picker__classic-tv .scoreboard__main) {
  flex: 1;
  min-height: 0;
  gap: 2.75rem 3.5rem;
  align-items: center;
}

.style-picker__preview--tv :deep(.style-picker__classic-tv .scoreboard__column) {
  gap: 1.75rem;
  height: 100%;
}

.style-picker__preview--tv :deep(.style-picker__classic-tv .scoreboard__team) {
  min-height: 0;
  height: 100%;
  gap: 2.25rem;
  padding: 2.5rem 2rem;
  justify-content: space-evenly;
}

.style-picker__preview--tv :deep(.style-picker__classic-tv .scoreboard__team-name) {
  font-size: 4.75rem;
  min-height: 1.1em;
  line-height: 1.05;
}

.style-picker__preview--tv :deep(.style-picker__classic-tv .scoreboard__score) {
  font-size: 14rem;
  margin-top: 0;
}

.style-picker__preview--tv :deep(.style-picker__classic-tv .scoreboard__center) {
  gap: 1.25rem;
  padding: 0 1.5rem;
}

.style-picker__preview--tv :deep(.style-picker__classic-tv .scoreboard__clock) {
  font-size: 11.5rem;
}

.style-picker__preview--tv :deep(.style-picker__classic-tv .scoreboard__period) {
  font-size: 3rem;
  letter-spacing: 0.14em;
}

.style-picker__preview--tv :deep(.style-picker__classic-tv .scoreboard__penalties) {
  gap: 1rem;
  padding-top: 0.25rem;
}

.style-picker__preview--tv :deep(.style-picker__classic-tv .scoreboard__penalty-badge) {
  font-size: 3.25rem;
  padding: 0.7rem 1.6rem;
  min-width: 10rem;
}

.style-picker__preview--overlay .style-picker__preview-stage {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.style-picker__preview-inner--overlay {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.35rem;
  box-sizing: border-box;
}

.style-picker__preview--overlay :deep(.nhl-bug) {
  position: relative;
  top: auto;
  left: auto;
  width: min(100%, 520px);
  --bug-width: min(100%, 520px);
  --bug-max-width: 520px;
  --bug-height: 52px;
  --bug-logo: 36px;
  --bug-name: 1.05rem;
  --bug-score: 1.7rem;
  --bug-clock: 1.2rem;
}

.style-picker__meta {
  text-align: center;

  strong {
    font-size: 0.92rem;
  }

  p {
    margin: 0.3rem 0 0;
    font-size: 0.8rem;
    line-height: 1.4;
    color: var(--app-text-muted);
  }
}

.style-picker__title-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.style-picker__badge {
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--app-link);
  background: color-mix(in srgb, var(--app-link) 14%, transparent);
  border: 1px solid color-mix(in srgb, var(--app-link) 35%, transparent);
  border-radius: 999px;
  padding: 0.12rem 0.45rem;
}
</style>
