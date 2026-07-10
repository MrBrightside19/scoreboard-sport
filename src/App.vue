<script setup lang="ts">
import { RouterView } from 'vue-router'
</script>

<template>
  <a-config-provider
    :theme="{
      token: {
        colorPrimary: '#00b4d8',
        borderRadius: 10,
        fontFamily: 'Inter, system-ui, sans-serif',
      },
      algorithm: undefined,
    }"
  >
    <div class="app-shell" :class="{ 'app-shell--bare': $route.meta.bare }">
      <RouterView />
    </div>
  </a-config-provider>
</template>

<style lang="scss">
*,
*::before,
*::after {
  box-sizing: border-box;
}

html,
body,
#app {
  margin: 0;
  min-height: 100%;
}

body {
  font-family: 'Inter', system-ui, sans-serif;
  background: #0f1419;
  color: #e8edf5;
  -webkit-font-smoothing: antialiased;
}

.app-shell {
  min-height: 100vh;

  &--bare {
    background: #0a0e17;
  }
}

a {
  color: #00d4ff;
}
</style>
