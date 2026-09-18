<script setup lang="ts">
defineProps<{
  show: boolean
  label: string
  time: string
  paused?: boolean
  intermission?: boolean
  wide?: boolean
}>()

const emit = defineEmits<{
  scrollToClock: []
}>()
</script>

<template>
  <Transition name="controls-dock">
    <div
      v-if="show"
      class="controls__dock"
      :class="{ 'controls__dock--wide': wide }"
    >
      <aside
        class="controls__dock-clock"
        :class="{
          'controls__dock-clock--paused': paused,
          'controls__dock-clock--intermission': intermission,
        }"
        role="status"
        aria-live="polite"
        title="Ir al reloj"
        tabindex="0"
        @click="emit('scrollToClock')"
        @keydown.enter="emit('scrollToClock')"
      >
        <span class="controls__dock-clock-label">{{ label }}</span>
        <span class="controls__dock-clock-time">{{ time }}</span>
      </aside>
      <slot />
    </div>
  </Transition>
</template>
