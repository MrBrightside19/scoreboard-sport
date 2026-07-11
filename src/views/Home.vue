<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { isSupabaseConfigured } from '@/services/supabaseClient'
import { fetchLiveMatches } from '@/services/liveMatchesService'
import { createMatch } from '@/services/matchSync'
import { createDefaultScoreboardState } from '@/types/hockeyScoreboard'
import { generateMatchId } from '@/utils/matchId'
import { writeMatchIdToStorage, getStorageKey } from '@/utils/localSync'
import type { LiveMatchSummary } from '@/types/match'
import LiveMatchCard from '@/components/LiveMatchCard.vue'
import AuthModal from '@/components/AuthModal.vue'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()

const liveMatches = ref<LiveMatchSummary[]>([])
const loadingLive = ref(false)
const creating = ref(false)
const showAuth = ref(false)

async function loadLive(): Promise<void> {
  if (!isSupabaseConfigured) return
  loadingLive.value = true
  try {
    liveMatches.value = await fetchLiveMatches()
  } finally {
    loadingLive.value = false
  }
}

async function createMatchFlow(): Promise<void> {
  if (!auth.isStaff && isSupabaseConfigured) {
    showAuth.value = true
    return
  }

  creating.value = true
  try {
    const matchId = generateMatchId()
    const state = createDefaultScoreboardState()

    if (isSupabaseConfigured) {
      await createMatch(matchId, state, auth.profile?.id)
    } else {
      localStorage.setItem(getStorageKey(matchId), JSON.stringify(state))
    }

    writeMatchIdToStorage(matchId)

    const boardUrl = router.resolve({ name: 'board', query: { matchId } }).href
    const controlsUrl = router.resolve({ name: 'controls', query: { matchId } }).href
    window.open(boardUrl, '_blank')
    await router.push(controlsUrl)
  } finally {
    creating.value = false
  }
}

onMounted(() => {
  void loadLive()
  if (route.query.auth === 'organizer' || route.query.auth === 'staff') {
    showAuth.value = true
  }
})
</script>

<template>
  <div class="home">
    <header class="home__hero">
      <div class="home__hero-content">
        <p class="home__eyebrow">Marcador deportivo en vivo</p>
        <h1>Hockey en línea</h1>
        <p class="home__subtitle">
          Opera partidos desde la mesa de control, proyecta en pantalla TV y comparte enlaces públicos para espectadores.
        </p>

        <div class="home__actions">
          <a-button type="primary" size="large" :loading="creating" @click="createMatchFlow">
            Crear partido
          </a-button>
          <router-link v-if="auth.isStaff" to="/tournaments">
            <a-button size="large">Mis torneos</a-button>
          </router-link>
          <router-link to="/torneos-publicos">
            <a-button size="large" ghost>Torneos públicos</a-button>
          </router-link>
        </div>

        <div v-if="!isSupabaseConfigured" class="home__warning">
          <a-alert
            type="warning"
            show-icon
            message="Supabase no configurado"
            description="Copia .env.example a .env y completa VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY para habilitar sync remoto."
          />
        </div>
      </div>
    </header>

    <section class="home__section">
      <div class="home__section-header">
        <h2>En vivo ahora</h2>
        <a-button type="link" @click="loadLive">Actualizar</a-button>
      </div>

      <a-spin :spinning="loadingLive">
        <div v-if="liveMatches.length" class="home__grid">
          <LiveMatchCard v-for="match in liveMatches" :key="match.id" :match="match" />
        </div>
        <a-empty v-else description="No hay partidos en vivo en este momento" />
      </a-spin>
    </section>

    <footer class="home__footer">
      <template v-if="auth.isAuthenticated">
        <span>{{ auth.profile?.display_name ?? auth.profile?.email }}</span>
        <a-tag
          :color="auth.isOrganizer ? 'cyan' : auth.isAssistant ? 'purple' : 'default'"
        >
          {{
            auth.isOrganizer
              ? 'Organizador'
              : auth.isAssistant
                ? 'Asistente'
                : 'Espectador'
          }}
        </a-tag>
        <a-button type="link" @click="auth.logout()">Cerrar sesión</a-button>
      </template>
      <a-button v-else type="link" @click="showAuth = true">Iniciar sesión / Registrarse</a-button>
    </footer>

    <a-modal
      v-model:open="showAuth"
      title="Acceso"
      :footer="null"
      destroy-on-close
    >
      <AuthModal @success="showAuth = false" />
    </a-modal>
  </div>
</template>

<style scoped lang="scss">
.home {
  max-width: 1100px;
  margin: 0 auto;
  padding: 2rem 1.5rem 4rem;
}

.home__hero {
  margin-bottom: 3rem;
  padding: 2.5rem;
  border-radius: 20px;
  background:
    linear-gradient(135deg, rgba(0, 180, 216, 0.12), transparent 50%),
    rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.home__eyebrow {
  margin: 0 0 0.5rem;
  font-size: 0.8rem;
  font-weight: 600;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: #00d4ff;
}

.home__hero h1 {
  margin: 0 0 0.75rem;
  font-family: 'Bebas Neue', sans-serif;
  font-size: clamp(2.5rem, 8vw, 4rem);
  letter-spacing: 0.04em;
  font-weight: 400;
}

.home__subtitle {
  margin: 0 0 1.5rem;
  max-width: 560px;
  line-height: 1.6;
  color: rgba(232, 237, 245, 0.75);
}

.home__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.home__warning {
  margin-top: 1.5rem;
  max-width: 560px;
}

.home__section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;

  h2 {
    margin: 0;
    font-size: 1.25rem;
  }
}

.home__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1rem;
}

.home__footer {
  margin-top: 3rem;
  padding-top: 1.5rem;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}
</style>
