<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import { theme } from 'ant-design-vue'
import AppNavbar from '@/components/AppNavbar.vue'
import {
  applyAppTheme,
  getAppTheme,
  type AppTheme,
} from '@/utils/userPreferences'

const route = useRoute()
const showNavbar = computed(() => !route.meta.hideNav)
const isTransparent = computed(() => Boolean(route.meta.transparent))
const forceDarkShell = computed(
  () => Boolean(route.meta.bare || route.meta.transparent),
)

const currentTheme = ref<AppTheme>(getAppTheme())

function syncThemeFromPrefs(): void {
  const next = getAppTheme()
  currentTheme.value = next
  applyAppTheme(forceDarkShell.value ? 'dark' : next)
}

onMounted(() => {
  syncThemeFromPrefs()
  window.addEventListener('scoreboard:theme-change', syncThemeFromPrefs)
})

onUnmounted(() => {
  window.removeEventListener('scoreboard:theme-change', syncThemeFromPrefs)
})

watch(
  () => [route.meta.bare, route.meta.transparent] as const,
  () => {
    syncThemeFromPrefs()
  },
)

const appTheme = computed(() => {
  const light = currentTheme.value === 'light' && !forceDarkShell.value
  if (light) {
    return {
      token: {
        colorPrimary: '#0096c7',
        borderRadius: 10,
        fontFamily: 'Inter, system-ui, sans-serif',
        colorBgContainer: '#ffffff',
        colorBgElevated: '#ffffff',
        colorBorder: '#d0d7de',
        colorText: '#1a2332',
        colorTextSecondary: 'rgba(26, 35, 50, 0.65)',
      },
      algorithm: theme.defaultAlgorithm,
    }
  }
  return {
    token: {
      colorPrimary: '#00b4d8',
      borderRadius: 10,
      fontFamily: 'Inter, system-ui, sans-serif',
      colorBgContainer: '#161b22',
      colorBgElevated: '#1c2128',
      colorBorder: '#30363d',
      colorText: '#e8edf5',
      colorTextSecondary: 'rgba(232, 237, 245, 0.65)',
    },
    algorithm: theme.darkAlgorithm,
  }
})
</script>

<template>
  <a-config-provider :theme="appTheme">
    <div
      class="app-shell"
      :class="{
        'app-shell--bare': $route.meta.bare,
        'app-shell--transparent': isTransparent,
      }"
    >
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
  background: var(--app-bg);
  color: var(--app-text);
  -webkit-font-smoothing: antialiased;
}

.app-shell {
  min-height: 100vh;
  background: var(--app-bg);
  color: var(--app-text);

  &--bare {
    background: var(--app-bg-bare);
    color: #e8edf5;
  }

  &--transparent {
    min-height: 0;
    background: transparent !important;
  }
}

.app-main {
  min-height: calc(100vh - 57px);

  &--full {
    min-height: 100vh;
  }
}

.app-shell--transparent .app-main,
.app-shell--transparent .app-main--full {
  min-height: 0;
  background: transparent;
}

html:has(.app-shell--transparent),
html:has(.app-shell--transparent) body,
html:has(.app-shell--transparent) #app {
  background: transparent !important;
}

a {
  color: var(--app-link);
}
</style>
