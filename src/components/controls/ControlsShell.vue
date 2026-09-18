<script setup lang="ts">
withDefaults(
  defineProps<{
    sportLabel?: string
    matchId?: string
    empty?: boolean
    loading?: boolean
    emptyTitle?: string
    emptyDescription?: string
    loadingMessage?: string
  }>(),
  {
    emptyTitle: 'Sin partido activo',
    emptyDescription: 'Crea un partido desde la app para comenzar.',
    loadingMessage: 'Cargando partido…',
  },
)
</script>

<template>
  <div class="controls">
    <header class="controls__header">
      <div>
        <h1>Mesa de control</h1>
        <p v-if="sportLabel" class="controls__sport">{{ sportLabel }}</p>
        <p v-if="matchId" class="controls__match-id">Partido: {{ matchId }}</p>
      </div>
      <div class="controls__links">
        <slot name="links" />
      </div>
    </header>

    <a-alert
      v-if="empty"
      type="warning"
      :message="emptyTitle"
      :description="emptyDescription"
      show-icon
    />

    <a-alert
      v-else-if="loading"
      type="info"
      :message="loadingMessage"
      show-icon
    />

    <div v-else class="controls__body">
      <slot />
    </div>

    <slot name="dock" />
  </div>
</template>

<style lang="scss">
@use './controls-shared.scss';
</style>
