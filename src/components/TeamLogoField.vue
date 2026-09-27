<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useSavedTeamLogos } from '@/composables/useSavedTeamLogos'

const props = withDefaults(
  defineProps<{
    modelValue: string
    placeholder?: string
    size?: 'small' | 'middle'
    alt?: string
    previewSide?: 'left' | 'right'
  }>(),
  { placeholder: 'URL del logo', size: 'small', alt: 'Logo del equipo', previewSide: 'right' },
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const { logos } = useSavedTeamLogos()
const previewBroken = ref(false)

const selectedId = computed(
  () => logos.value.find((logo) => logo.url === props.modelValue)?.id,
)

watch(
  () => props.modelValue,
  () => {
    previewBroken.value = false
  },
)

function onPick(id: string | undefined): void {
  if (!id) {
    emit('update:modelValue', '')
    return
  }
  const logo = logos.value.find((item) => item.id === id)
  if (logo) emit('update:modelValue', logo.url)
}

function onUrl(value: string): void {
  emit('update:modelValue', value)
}
</script>

<template>
  <div
    class="team-logo-field"
    :class="{ 'team-logo-field--preview-left': previewSide === 'left' }"
  >
    <div class="team-logo-field__controls">
      <a-select
        v-if="logos.length"
        :value="selectedId"
        :size="size"
        allow-clear
        placeholder="Logo guardado"
        class="team-logo-field__select"
        @update:value="onPick"
      >
        <a-select-option v-for="logo in logos" :key="logo.id" :value="logo.id">
          {{ logo.name }}
        </a-select-option>
      </a-select>
      <a-input
        :value="modelValue"
        :size="size"
        :placeholder="placeholder"
        allow-clear
        @update:value="onUrl"
      />
    </div>
    <div class="team-logo-field__preview" aria-hidden="true">
      <img
        v-if="modelValue && !previewBroken"
        :src="modelValue"
        :alt="alt"
        @error="previewBroken = true"
      />
      <span v-else-if="modelValue">Sin imagen</span>
      <span v-else>Logo</span>
    </div>
  </div>
</template>

<style scoped lang="scss">
.team-logo-field {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 4.5rem;
  grid-template-areas: 'controls preview';
  gap: 0.5rem;
  align-items: center;
  width: 100%;
  min-width: 0;
}

.team-logo-field--preview-left {
  grid-template-columns: 4.5rem minmax(0, 1fr);
  grid-template-areas: 'preview controls';
}

.team-logo-field__controls {
  grid-area: controls;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  min-width: 0;
}

.team-logo-field__select {
  width: 100%;
}

.team-logo-field__preview {
  grid-area: preview;
  width: 4.5rem;
  height: 4.5rem;
  border-radius: 10px;
  border: 1px solid var(--app-border);
  background:
    repeating-conic-gradient(
        rgba(128, 128, 128, 0.18) 0% 25%,
        transparent 0% 50%
      )
      50% / 10px 10px;
  display: grid;
  place-items: center;
  overflow: hidden;

  img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    background: #fff;
  }

  span {
    font-size: 0.62rem;
    font-weight: 650;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--app-text-muted);
    text-align: center;
    padding: 0.2rem;
    line-height: 1.2;
  }
}

@media (max-width: 900px) {
  .team-logo-field {
    grid-template-columns: minmax(0, 1fr) 2.85rem;
    gap: 0.4rem;
  }

  .team-logo-field--preview-left {
    grid-template-columns: 2.85rem minmax(0, 1fr);
  }

  .team-logo-field__controls {
    gap: 0.28rem;
  }

  .team-logo-field__preview {
    width: 2.85rem;
    height: 2.85rem;
    border-radius: 8px;
  }

  .team-logo-field__select {
    :deep(.ant-select-selector) {
      min-height: 28px !important;
      padding-inline: 0.45rem !important;
    }

    :deep(.ant-select-selection-item),
    :deep(.ant-select-selection-placeholder) {
      font-size: 0.75rem;
      line-height: 26px;
    }
  }
}
</style>
