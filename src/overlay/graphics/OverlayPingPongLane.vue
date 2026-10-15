<script setup lang="ts">
import { computed, ref } from 'vue'
import { useAutoPingPong } from '@/overlay/graphics/autoPingPong'

const props = defineProps<{
  source: unknown
}>()

const viewport = ref<HTMLElement | null>(null)
const track = ref<HTMLElement | null>(null)
const sourceRef = computed(() => props.source)

useAutoPingPong(viewport, track, sourceRef)
</script>

<template>
  <div ref="viewport" class="og__lane">
    <div ref="track" class="og__lane-track">
      <slot />
    </div>
  </div>
</template>
