<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter, type RouteLocationRaw } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { isSupabaseConfigured } from '@/services/supabaseClient'
import { createMatch, fetchActiveFreeMatch } from '@/services/matchSync'
import { createDefaultScoreboardState } from '@/types/hockeyScoreboard'
import { generateMatchId } from '@/utils/matchId'
import {
  getStorageKey,
  readMatchIdFromStorage,
  writeMatchIdToStorage,
} from '@/utils/localSync'
import AuthModal from '@/components/AuthModal.vue'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const showAuth = ref(false)
const mobileOpen = ref(false)
const creating = ref(false)
const activeFreeMatchId = ref<string | null>(null)

const activeMatchId = computed(
  () => (route.query.matchId as string) || readMatchIdFromStorage() || '',
)

const createButtonLabel = computed(() => {
  if (creating.value) {
    return activeFreeMatchId.value ? 'Abriendo…' : 'Creando…'
  }
  return activeFreeMatchId.value ? 'Continuar partido' : 'Crear partido'
})

const navLinks = computed(() => {
  const links: { name: string; label: string; to: RouteLocationRaw }[] = [
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

const userLabel = computed(
  () => auth.profile?.display_name || auth.profile?.email || 'Usuario',
)

const userInitials = computed(() => {
  const label = userLabel.value.trim()
  const parts = label.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase()
  }
  return label.slice(0, 2).toUpperCase() || '?'
})

const roleLabel = computed(() => {
  if (auth.isOrganizer) return 'Organizador'
  if (auth.isAssistant) return 'Asistente'
  return 'Espectador'
})

function isActive(linkName: string): boolean {
  if (route.name === linkName) return true
  if (linkName === 'tournaments' && route.name === 'tournament-detail') return true
  return false
}

function closeMobile(): void {
  mobileOpen.value = false
}

function openAuth(): void {
  closeMobile()
  showAuth.value = true
}

async function handleLogout(): Promise<void> {
  closeMobile()
  await auth.logout()
}

async function refreshActiveFreeMatch(): Promise<void> {
  if (!isSupabaseConfigured) {
    const localId = readMatchIdFromStorage()
    activeFreeMatchId.value =
      localId && localStorage.getItem(getStorageKey(localId)) ? localId : null
    return
  }

  if (!auth.profile?.id) {
    activeFreeMatchId.value = null
    return
  }

  try {
    const active = await fetchActiveFreeMatch(auth.profile.id)
    activeFreeMatchId.value = active?.id ?? null
    if (active) writeMatchIdToStorage(active.id)
  } catch {
    activeFreeMatchId.value = null
  }
}

async function createMatchFlow(): Promise<void> {
  if (!auth.isStaff && isSupabaseConfigured) {
    openAuth()
    return
  }

  // Abrir pestañas en el gesto del click (antes del await) evita el bloqueo de popups.
  const boardWin = window.open('about:blank', '_blank')
  const controlsWin = window.open('about:blank', '_blank')

  creating.value = true
  closeMobile()
  try {
    await refreshActiveFreeMatch()

    let matchId = activeFreeMatchId.value
    if (!matchId) {
      matchId = generateMatchId()
      const state = createDefaultScoreboardState()

      if (isSupabaseConfigured) {
        await createMatch(matchId, state, auth.profile?.id)
      } else {
        localStorage.setItem(getStorageKey(matchId), JSON.stringify(state))
      }

      activeFreeMatchId.value = matchId
    }

    writeMatchIdToStorage(matchId)

    const boardUrl = router.resolve({ name: 'board', query: { matchId } }).href
    const controlsUrl = router.resolve({ name: 'controls', query: { matchId } }).href

    if (boardWin) boardWin.location.href = boardUrl
    else window.open(boardUrl, '_blank')

    if (controlsWin) controlsWin.location.href = controlsUrl
    else window.open(controlsUrl, '_blank')
  } catch (err) {
    boardWin?.close()
    controlsWin?.close()
    throw err
  } finally {
    creating.value = false
  }
}

onMounted(() => {
  void refreshActiveFreeMatch()
  window.addEventListener('focus', refreshActiveFreeMatch)
})

onUnmounted(() => {
  window.removeEventListener('focus', refreshActiveFreeMatch)
})

watch(
  () => auth.profile?.id,
  () => {
    void refreshActiveFreeMatch()
  },
)

watch(
  () => route.name,
  () => {
    void refreshActiveFreeMatch()
  },
)
</script>

<template>
  <header class="app-nav">
    <div class="app-nav__inner">
      <RouterLink to="/" class="app-nav__brand" @click="closeMobile">
        <span class="app-nav__brand-mark">SD</span>
        <span class="app-nav__brand-text">ScoreDesk</span>
      </RouterLink>

      <nav class="app-nav__links app-nav__links--desktop">
        <a-button
          type="primary"
          size="small"
          class="app-nav__create"
          :loading="creating"
          @click="createMatchFlow"
        >
          {{ createButtonLabel }}
        </a-button>
        <RouterLink
          v-for="link in navLinks"
          :key="link.name"
          :to="link.to"
          class="app-nav__link"
          :class="{ 'app-nav__link--active': isActive(link.name) }"
        >
          {{ link.label }}
        </RouterLink>
      </nav>

      <div class="app-nav__trailing">
        <div v-if="isSupabaseConfigured" class="app-nav__desktop-auth">
          <a-dropdown v-if="auth.isAuthenticated" placement="bottomRight" :trigger="['click']">
            <button type="button" class="app-nav__profile-btn" aria-label="Menú de usuario">
              <span class="app-nav__avatar">{{ userInitials }}</span>
              <span class="app-nav__profile-name">{{ userLabel }}</span>
            </button>
            <template #overlay>
              <div class="app-nav__dropdown">
                <div class="app-nav__dropdown-meta">
                  <div class="app-nav__menu-user">{{ userLabel }}</div>
                  <div class="app-nav__menu-role">{{ roleLabel }}</div>
                </div>
                <button
                  type="button"
                  class="app-nav__dropdown-logout"
                  @click="handleLogout"
                >
                  Cerrar sesión
                </button>
              </div>
            </template>
          </a-dropdown>
          <a-button v-else size="small" type="primary" @click="openAuth">
            Iniciar sesión
          </a-button>
        </div>

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
      </div>
    </div>

    <nav
      class="app-nav__mobile"
      :class="{ 'app-nav__mobile--open': mobileOpen }"
      aria-label="Menú móvil"
    >
      <button
        type="button"
        class="app-nav__mobile-create"
        :disabled="creating"
        @click="createMatchFlow"
      >
        {{ createButtonLabel }}
      </button>
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

      <template v-if="isSupabaseConfigured">
        <div class="app-nav__mobile-divider" />
        <template v-if="auth.isAuthenticated">
          <div class="app-nav__mobile-profile">
            <span class="app-nav__avatar">{{ userInitials }}</span>
            <div>
              <div class="app-nav__menu-user">{{ userLabel }}</div>
              <div class="app-nav__menu-role">{{ roleLabel }}</div>
            </div>
          </div>
          <button type="button" class="app-nav__mobile-logout" @click="handleLogout">
            Cerrar sesión
          </button>
        </template>
        <button
          v-else
          type="button"
          class="app-nav__mobile-login"
          @click="openAuth"
        >
          Iniciar sesión
        </button>
      </template>
    </nav>

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

.app-nav__links--desktop {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  flex: 1;
  min-width: 0;
}

.app-nav__create {
  margin-right: 0.35rem;
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

.app-nav__trailing {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-left: auto;
  flex-shrink: 0;
}

.app-nav__desktop-auth {
  display: flex;
  align-items: center;
}

.app-nav__profile-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  max-width: 220px;
  padding: 0.25rem 0.55rem 0.25rem 0.25rem;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.04);
  color: #e8edf5;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;

  &:hover {
    border-color: rgba(0, 212, 255, 0.35);
    background: rgba(255, 255, 255, 0.07);
  }
}

.app-nav__avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.85rem;
  height: 1.85rem;
  border-radius: 50%;
  background: linear-gradient(135deg, #00b4d8, #0077b6);
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  flex-shrink: 0;
}

.app-nav__profile-name {
  font-size: 0.82rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  padding-right: 0.25rem;
}

.app-nav__menu-user {
  font-size: 0.85rem;
  font-weight: 600;
  color: #e8edf5;
  line-height: 1.2;
}

.app-nav__menu-role {
  font-size: 0.75rem;
  color: rgba(0, 212, 255, 0.9);
  margin-top: 0.2rem;
}

.app-nav__dropdown {
  min-width: 200px;
  padding: 0.35rem;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: #1a222c;
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.45);
}

.app-nav__dropdown-meta {
  padding: 0.65rem 0.75rem 0.55rem;
}

.app-nav__dropdown-logout {
  display: block;
  width: 100%;
  margin-top: 0.15rem;
  padding: 0.6rem 0.75rem;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: #ff8f8f;
  font-size: 0.88rem;
  text-align: left;
  cursor: pointer;

  &:hover {
    background: rgba(255, 107, 107, 0.12);
    color: #ffb0b0;
  }
}

.app-nav__toggle {
  display: none;
  flex-direction: column;
  justify-content: center;
  gap: 4px;
  width: 2.25rem;
  height: 2.25rem;
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

.app-nav__mobile {
  display: none;
}

@media (max-width: 768px) {
  .app-nav__links--desktop,
  .app-nav__desktop-auth {
    display: none;
  }

  .app-nav__toggle {
    display: flex;
  }

  .app-nav__brand-text {
    font-size: 0.88rem;
  }

  .app-nav__mobile {
    display: none;
    flex-direction: column;
    align-items: stretch;
    gap: 0.15rem;
    padding: 0.5rem 1rem 1rem;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
    background: rgba(15, 20, 25, 0.98);

    &--open {
      display: flex;
    }
  }

  .app-nav__link {
    padding: 0.7rem 0.75rem;
  }

  .app-nav__mobile-create {
    width: 100%;
    margin-bottom: 0.25rem;
    padding: 0.7rem 0.75rem;
    border: none;
    border-radius: 8px;
    background: rgba(0, 212, 255, 0.16);
    color: #00d4ff;
    font-size: 0.88rem;
    font-weight: 600;
    text-align: left;
    cursor: pointer;

    &:hover:not(:disabled) {
      background: rgba(0, 212, 255, 0.24);
    }

    &:disabled {
      opacity: 0.6;
      cursor: wait;
    }
  }

  .app-nav__mobile-divider {
    height: 1px;
    margin: 0.45rem 0.5rem;
    background: rgba(255, 255, 255, 0.1);
  }

  .app-nav__mobile-profile {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.55rem 0.75rem;
  }

  .app-nav__mobile-logout,
  .app-nav__mobile-login {
    width: 100%;
    margin-top: 0.15rem;
    padding: 0.7rem 0.75rem;
    border: none;
    border-radius: 8px;
    background: transparent;
    color: rgba(232, 237, 245, 0.85);
    font-size: 0.88rem;
    text-align: left;
    cursor: pointer;

    &:hover {
      background: rgba(255, 255, 255, 0.06);
      color: #fff;
    }
  }

  .app-nav__mobile-logout {
    color: #ff8f8f;

    &:hover {
      background: rgba(255, 107, 107, 0.12);
      color: #ffb0b0;
    }
  }

  .app-nav__mobile-login {
    color: #00d4ff;
  }
}
</style>
