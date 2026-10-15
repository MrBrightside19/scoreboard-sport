<script setup lang="ts">
import { computed, ref, watch } from 'vue'

const props = defineProps<{
  src?: string
  name: string
  color: string
}>()

const failed = ref(false)

watch(
  () => props.src,
  () => {
    failed.value = false
  },
)

const initial = computed(() => (props.name.trim()[0] ?? '?').toUpperCase())
</script>

<template>
  <div class="og__logo" :style="{ '--team-color': color }">
    <img
      v-if="src && !failed"
      :src="src"
      :alt="name"
      @error="failed = true"
    />
    <span v-else>{{ initial }}</span>
  </div>
</template>
