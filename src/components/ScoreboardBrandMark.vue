<script setup lang="ts">
defineProps<{
  compact?: boolean
}>()
</script>

<template>
  <div class="brand-mark" :class="{ 'brand-mark--compact': compact }" aria-hidden="true">
    ScoreDesk
  </div>
</template>

<style scoped lang="scss">
.brand-mark {
  pointer-events: none;
  position: absolute;
  right: 0.75rem;
  bottom: 0.55rem;
  z-index: 4;
  font-family: 'Bebas Neue', sans-serif;
  font-size: 0.85rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.55);
  text-shadow: 0 1px 8px rgba(0, 0, 0, 0.45);
}

.brand-mark--compact {
  right: 0.45rem;
  bottom: 0.3rem;
  font-size: 0.7rem;
}
</style>
