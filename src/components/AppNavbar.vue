<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink, useRoute, type RouteLocationRaw } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { isSupabaseConfigured } from '@/services/supabaseClient'
import { readMatchIdFromStorage } from '@/utils/localSync'
import AuthModal from '@/components/AuthModal.vue'

const route = useRoute()
const auth = useAuthStore()
const showAuth = ref(false)
const mobileOpen = ref(false)

const activeMatchId = computed(
  () => (route.query.matchId as string) || readMatchIdFromStorage() || '',
)

const navLinks = computed(() => {
  const links: { name: string; label: string; to: RouteLocationRaw }[] = [
    { name: 'home', label: 'Inicio', to: { name: 'home' } },
    {
      name: 'public-tournaments',
      label: 'Torneos públicos',
      to: { name: 'public-tournaments' },
    },
  ]

  if (auth.isStaff) {
    links.push({
      name: 'tournaments',
      label: 'Mis torneos',
      to: { name: 'tournaments' },
    })

    if (activeMatchId.value) {
      links.push({
        name: 'controls',
        label: 'Mesa de control',
        to: {
          name: 'controls',
          query: { matchId: activeMatchId.value },
        },
      })
    }
  }

  return links
})

function isActive(linkName: string): boolean {
  if (route.name === linkName) return true
  if (linkName === 'tournaments' && route.name === 'tournament-detail') return true
  return false
}

function closeMobile(): void {
  mobileOpen.value = false
}

async function handleLogout(): Promise<void> {
  await auth.logout()
  closeMobile()
}
</script>

<template>
  <header class="app-nav">
    <div class="app-nav__inner">
      <RouterLink to="/" class="app-nav__brand" @click="closeMobile">
        <span class="app-nav__brand-mark">HL</span>
        <span class="app-nav__brand-text">Marcador Hockey</span>
      </RouterLink>

      <button
        type="button"
        class="app-nav__toggle"
        :aria-expanded="mobileOpen"
        aria-label="Menú de navegación"
        @click="mobileOpen = !mobileOpen"
      >
        <span />
        <span />
        <span />
      </button>

      <nav class="app-nav__links" :class="{ 'app-nav__links--open': mobileOpen }">
        <RouterLink
          v-for="link in navLinks"
          :key="link.name"
          :to="link.to"
          class="app-nav__link"
          :class="{ 'app-nav__link--active': isActive(link.name) }"
          @click="closeMobile"
        >
          {{ link.label }}
        </RouterLink>
      </nav>

      <div class="app-nav__actions">
        <template v-if="isSupabaseConfigured">
          <template v-if="auth.isAuthenticated">
            <span v-if="auth.profile?.display_name" class="app-nav__user">
              {{ auth.profile.display_name }}
            </span>
            <a-button size="small" @click="handleLogout">Salir</a-button>
          </template>
          <a-button v-else size="small" type="primary" @click="showAuth = true">
            Iniciar sesión
          </a-button>
        </template>
      </div>
    </div>

    <a-modal
      v-model:open="showAuth"
      title="Acceso staff"
      :footer="null"
      destroy-on-close
    >
      <AuthModal @success="showAuth = false" />
    </a-modal>
  </header>
</template>

<style scoped lang="scss">
.app-nav {
  position: sticky;
  top: 0;
  z-index: 100;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(15, 20, 25, 0.92);
  backdrop-filter: blur(10px);
}

.app-nav__inner {
  max-width: 1100px;
  margin: 0 auto;
  padding: 0.65rem 1.5rem;
  display: flex;
  align-items: center;
  gap: 1rem;
}

.app-nav__brand {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  text-decoration: none;
  color: #e8edf5;
  flex-shrink: 0;

  &:hover {
    color: #fff;
  }
}

.app-nav__brand-mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border-radius: 8px;
  background: linear-gradient(135deg, #00b4d8, #0077b6);
  font-family: 'Bebas Neue', sans-serif;
  font-size: 1rem;
  letter-spacing: 0.04em;
}

.app-nav__brand-text {
  font-weight: 600;
  font-size: 0.95rem;
}

.app-nav__toggle {
  display: none;
  flex-direction: column;
  justify-content: center;
  gap: 4px;
  width: 2.25rem;
  height: 2.25rem;
  margin-left: auto;
  padding: 0;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 8px;
  background: transparent;
  cursor: pointer;

  span {
    display: block;
    width: 1.1rem;
    height: 2px;
    margin: 0 auto;
    background: #e8edf5;
    border-radius: 1px;
  }
}

.app-nav__links {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  flex: 1;
}

.app-nav__link {
  padding: 0.45rem 0.75rem;
  border-radius: 8px;
  text-decoration: none;
  color: rgba(232, 237, 245, 0.72);
  font-size: 0.88rem;
  transition: color 0.15s, background 0.15s;

  &:hover {
    color: #e8edf5;
    background: rgba(255, 255, 255, 0.06);
  }

  &--active {
    color: #00d4ff;
    background: rgba(0, 212, 255, 0.1);
  }
}

.app-nav__actions {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  flex-shrink: 0;
}

.app-nav__user {
  font-size: 0.82rem;
  opacity: 0.65;
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 768px) {
  .app-nav__toggle {
    display: flex;
  }

  .app-nav__links {
    display: none;
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    flex-direction: column;
    align-items: stretch;
    gap: 0.15rem;
    padding: 0.75rem 1rem 1rem;
    background: rgba(15, 20, 25, 0.98);
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);

    &--open {
      display: flex;
    }
  }

  .app-nav__link {
    padding: 0.65rem 0.75rem;
  }

  .app-nav__actions {
    margin-left: auto;
  }

  .app-nav__user {
    display: none;
  }

  .app-nav__inner {
    position: relative;
    flex-wrap: wrap;
  }
}
</style>
