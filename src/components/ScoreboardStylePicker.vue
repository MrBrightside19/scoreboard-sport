<script setup lang="ts">
import { computed } from 'vue'
import ScoreBoard from '@/components/ScoreBoard.vue'
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
          <ScoreBoard
            v-if="mode === 'tv'"
            tv
            :tv-style="option.id as TvScoreboardStyle"
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
  padding: 0.75rem;
  border-radius: 12px;
  border: 1px solid var(--app-border);
  background: var(--app-bg-elevated);
  color: var(--app-text);
  text-align: left;
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
  height: 148px;
}

.style-picker__preview--overlay {
  height: 120px;
}

.style-picker__preview-stage {
  position: absolute;
  inset: 0;
  transform-origin: top left;
}

.style-picker__preview--tv .style-picker__preview-stage {
  width: 1280px;
  height: 720px;
  transform: scale(0.22);
}

.style-picker__preview--overlay .style-picker__preview-stage {
  width: 100%;
  height: 100%;
  padding: 0.85rem;
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
