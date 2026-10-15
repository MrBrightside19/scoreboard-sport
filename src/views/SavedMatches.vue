<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { message } from 'ant-design-vue'
import { useAuthStore } from '@/stores/auth'
import { isSupabaseConfigured } from '@/services/supabaseClient'
import { deleteSavedMatch, fetchSavedMatches } from '@/services/savedMatchesService'
import type { SavedMatchSummary } from '@/types/match'
import SavedMatchCard from '@/components/SavedMatchCard.vue'

const auth = useAuthStore()
const matches = ref<SavedMatchSummary[]>([])
const loading = ref(false)
const deletingId = ref<string | null>(null)
const error = ref<string | null>(null)

async function load(): Promise<void> {
  const organizerId = auth.profile?.id
  if (!organizerId) {
    matches.value = []
    return
  }
  loading.value = true
  error.value = null
  try {
    matches.value = await fetchSavedMatches(organizerId)
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'No se pudieron cargar los partidos.'
  } finally {
    loading.value = false
  }
}

async function removeMatch(id: string): Promise<void> {
  const organizerId = auth.profile?.id
  if (!organizerId || deletingId.value) return
  deletingId.value = id
  try {
    await deleteSavedMatch(organizerId, id)
    matches.value = matches.value.filter((match) => match.id !== id)
    message.success('Partido eliminado del registro.')
  } catch (err) {
    message.error(
      err instanceof Error ? err.message : 'No se pudo eliminar el partido.',
    )
  } finally {
    deletingId.value = null
  }
}

onMounted(() => {
  void load()
})
</script>

<template>
  <div class="saved-matches">
    <header class="saved-matches__hero">
      <div class="saved-matches__hero-content">
        <RouterLink :to="{ name: 'app-home' }" class="saved-matches__back">
          Volver al inicio
        </RouterLink>
        <p class="saved-matches__eyebrow">Registro</p>
        <h1>Partidos guardados</h1>
        <p class="saved-matches__subtitle">
          El historial de los partidos sueltos que guardaste desde Config.
          Ábrelos para ver el marcador como en Live.
        </p>
        <div v-if="!isSupabaseConfigured" class="saved-matches__warning">
          <a-alert
            type="warning"
            show-icon
            message="Supabase no configurado"
            description="Los partidos se guardan solo en este dispositivo hasta configurar el sync remoto."
          />
        </div>
      </div>
    </header>

    <section class="saved-matches__section">
      <div class="saved-matches__section-header">
        <h2>Tus partidos</h2>
        <a-button type="link" @click="load">Actualizar</a-button>
      </div>

      <a-alert
        v-if="error"
        type="warning"
        :message="error"
        show-icon
        style="margin-bottom: 1rem"
      />

      <a-spin :spinning="loading">
        <div v-if="matches.length" class="saved-matches__grid">
          <SavedMatchCard
            v-for="match in matches"
            :key="match.id"
            :match="match"
            :deleting="deletingId === match.id"
            @delete="removeMatch(match.id)"
          />
        </div>
        <a-empty
          v-else
          description="Todavía no hay partidos guardados. En Config usa «Guardar partido»."
        />
      </a-spin>
    </section>
  </div>
</template>

<style scoped lang="scss">
.saved-matches {
  max-width: 1100px;
  margin: 0 auto;
  padding: 2rem 1.5rem 3rem;
  min-height: calc(100vh - 57px);
}

.saved-matches__hero {
  margin-bottom: 2.5rem;
  padding: 2.5rem;
  border-radius: 20px;
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--app-primary) 14%, transparent), transparent 50%),
    var(--app-surface);
  border: 1px solid var(--app-border);
}

.saved-matches__back {
  display: inline-block;
  margin-bottom: 0.85rem;
  color: var(--app-link);
  text-decoration: none;
  font-size: 0.88rem;
  font-weight: 600;

  &:hover {
    text-decoration: underline;
  }
}

.saved-matches__eyebrow {
  margin: 0 0 0.5rem;
  font-size: 0.8rem;
  font-weight: 600;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: var(--app-link);
}

.saved-matches__hero h1 {
  margin: 0 0 0.75rem;
  font-family: 'Bebas Neue', sans-serif;
  font-size: clamp(2.5rem, 8vw, 4rem);
  letter-spacing: 0.04em;
  font-weight: 400;
}

.saved-matches__subtitle {
  margin: 0;
  max-width: 36rem;
  font-size: 1.05rem;
  line-height: 1.55;
  color: var(--app-text-muted);
}

.saved-matches__warning {
  margin-top: 1.25rem;
}

.saved-matches__section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;

  h2 {
    margin: 0;
    font-size: 1.25rem;
  }
}

.saved-matches__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1rem;
}
</style>
