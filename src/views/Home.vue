<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { isSupabaseConfigured } from '@/services/supabaseClient'
import { fetchLiveMatches } from '@/services/liveMatchesService'
import type { LiveMatchSummary } from '@/types/match'
import LiveMatchCard from '@/components/LiveMatchCard.vue'
import AuthModal from '@/components/AuthModal.vue'
import { APP_VERSION } from '@/config/version'

const route = useRoute()

const liveMatches = ref<LiveMatchSummary[]>([])
const loadingLive = ref(false)
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
        <h1>ScoreDesk</h1>
        <p class="home__subtitle">
          Opera partidos desde la mesa de control, proyecta en pantalla TV y comparte enlaces públicos para espectadores.
        </p>

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
      <span>ScoreDesk</span>
      <span class="home__footer-sep" aria-hidden="true">·</span>
      <span>v{{ APP_VERSION }}</span>
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
  padding: 2rem 1.5rem 3rem;
  min-height: calc(100vh - 57px);
  display: flex;
  flex-direction: column;
}

.home__hero {
  margin-bottom: 3rem;
  padding: 2.5rem;
  border-radius: 20px;
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--app-primary) 14%, transparent), transparent 50%),
    var(--app-surface);
  border: 1px solid var(--app-border);
  color: var(--app-text);
}

.home__eyebrow {
  margin: 0 0 0.5rem;
  font-size: 0.8rem;
  font-weight: 600;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: var(--app-link);
}

.home__hero h1 {
  margin: 0 0 0.75rem;
  font-family: 'Bebas Neue', sans-serif;
  font-size: clamp(2.5rem, 8vw, 4rem);
  letter-spacing: 0.04em;
  font-weight: 400;
  color: var(--app-text);
}

.home__subtitle {
  margin: 0;
  max-width: 36rem;
  font-size: 1.05rem;
  line-height: 1.55;
  color: var(--app-text-muted);
}

.home__warning {
  margin-top: 1.25rem;
}

.home__section {
  flex: 1;
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
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  margin-top: 3rem;
  padding-top: 1.25rem;
  border-top: 1px solid var(--app-border);
  font-size: 0.78rem;
  letter-spacing: 0.04em;
  color: var(--app-text-muted);
}

.home__footer-sep {
  opacity: 0.7;
}
</style>
