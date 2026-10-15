<script setup lang="ts">
import { Modal } from 'ant-design-vue'
import type { SavedMatchSummary } from '@/types/match'
import { formatSavedAt } from '@/utils/datetime'

const props = defineProps<{
  match: SavedMatchSummary
  deleting?: boolean
}>()

const emit = defineEmits<{
  delete: []
}>()

function confirmDelete(): void {
  if (props.deleting) return
  Modal.confirm({
    title: '¿Eliminar este partido guardado?',
    content: `Se eliminará «${props.match.title}» del registro. Esta acción no se puede deshacer.`,
    okText: 'Eliminar',
    okType: 'danger',
    cancelText: 'Cancelar',
    centered: true,
    onOk() {
      emit('delete')
    },
  })
}
</script>

<template>
  <article class="saved-card">
    <div class="saved-card__top">
      <span class="saved-card__sport">{{ match.sportLabel }}</span>
      <div class="saved-card__meta">
        <span class="saved-card__date">{{ formatSavedAt(match.savedAt) }}</span>
        <a-button
          type="text"
          danger
          class="saved-card__remove"
          :loading="deleting"
          :disabled="deleting"
          aria-label="Eliminar partido guardado"
          title="Eliminar"
          @click="confirmDelete"
        >
          ×
        </a-button>
      </div>
    </div>
    <router-link
      :to="{ name: 'saved-match', params: { id: match.id } }"
      class="saved-card__body"
    >
      <h3 class="saved-card__title">{{ match.title }}</h3>
      <div class="saved-card__score">
        <span>{{ match.localTeam }}</span>
        <strong>{{ match.goalLocal }} — {{ match.goalVisit }}</strong>
        <span>{{ match.visitTeam }}</span>
      </div>
    </router-link>
  </article>
</template>

<style scoped lang="scss">
.saved-card {
  display: flex;
  flex-direction: column;
  padding: 1.25rem;
  border-radius: 14px;
  background: linear-gradient(145deg, var(--app-surface-strong), var(--app-surface));
  border: 1px solid var(--app-border);
  color: var(--app-text);
  transition: transform 0.2s, border-color 0.2s;

  &:hover {
    transform: translateY(-2px);
    border-color: color-mix(in srgb, var(--app-link) 45%, transparent);
  }
}

.saved-card__top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

.saved-card__sport {
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--app-link);
}

.saved-card__meta {
  display: flex;
  align-items: center;
  gap: 0.15rem;
  flex-shrink: 0;
}

.saved-card__date {
  font-size: 0.78rem;
  color: var(--app-text-muted);
}

.saved-card__remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  padding: 0;
  font-size: 1.45rem;
  line-height: 1;
  color: #cf1322;
  opacity: 0.85;

  &:hover,
  &:focus {
    color: #a8071a;
    opacity: 1;
  }
}

.saved-card__body {
  color: inherit;
  text-decoration: none;
  min-width: 0;
}

.saved-card__title {
  margin: 0 0 0.75rem;
  font-size: 1.1rem;
  font-family: 'Bebas Neue', sans-serif;
  letter-spacing: 0.04em;
  line-height: 1.2;
}

.saved-card__score {
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

  span:first-child {
    text-align: right;
  }
}
</style>
