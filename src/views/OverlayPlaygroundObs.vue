<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import OverlayPlaygroundStage from '@/overlay/graphics/OverlayPlaygroundStage.vue'
import {
  readPlaygroundSession,
  subscribePlaygroundSession,
  type PlaygroundSession,
} from '@/overlay/graphics/session'

const session = ref<PlaygroundSession>(readPlaygroundSession())

let stop: (() => void) | null = null

onMounted(() => {
  session.value = readPlaygroundSession()
  stop = subscribePlaygroundSession((next) => {
    session.value = next
  })
})

onUnmounted(() => {
  stop?.()
})
</script>

<template>
  <div class="obs-root">
    <OverlayPlaygroundStage
      :key="`${session.sport}-${session.phase}`"
      :sport="session.sport"
      :phase="session.phase"
    />
  </div>
</template>

<style scoped>
.obs-root {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: transparent;
}
</style>
