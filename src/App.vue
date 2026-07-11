<script setup lang="ts">
import { computed } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import { theme } from 'ant-design-vue'
import AppNavbar from '@/components/AppNavbar.vue'

const route = useRoute()
const showNavbar = computed(() => !route.meta.hideNav)

const appTheme = {
  token: {
    colorPrimary: '#00b4d8',
    borderRadius: 10,
    fontFamily: 'Inter, system-ui, sans-serif',
    colorBgContainer: '#161b22',
    colorBgElevated: '#1c2128',
    colorBorder: '#30363d',
  },
  algorithm: theme.darkAlgorithm,
}
</script>

<template>
  <a-config-provider :theme="appTheme">
    <div class="app-shell" :class="{ 'app-shell--bare': $route.meta.bare }">
      <AppNavbar v-if="showNavbar" />
      <main class="app-main" :class="{ 'app-main--full': !showNavbar }">
        <RouterView />
      </main>
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

.app-main {
  min-height: calc(100vh - 57px);

  &--full {
    min-height: 100vh;
  }
}

a {
  color: #00d4ff;
}
</style>
