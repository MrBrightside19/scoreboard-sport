<script setup lang="ts">
defineProps<{
  localName: string
  visitName: string
  modelValue: 'local' | 'visit'
}>()

const emit = defineEmits<{
  'update:modelValue': [value: 'local' | 'visit']
}>()
</script>

<template>
  <div class="football-side-switch" role="tablist" aria-label="Equipo">
    <button
      type="button"
      role="tab"
      :aria-selected="modelValue === 'local'"
      :class="{ 'is-active': modelValue === 'local' }"
      @click="emit('update:modelValue', 'local')"
    >
      {{ localName }}
    </button>
    <button
      type="button"
      role="tab"
      :aria-selected="modelValue === 'visit'"
      :class="{ 'is-active': modelValue === 'visit' }"
      @click="emit('update:modelValue', 'visit')"
    >
      {{ visitName }}
    </button>
  </div>
</template>
