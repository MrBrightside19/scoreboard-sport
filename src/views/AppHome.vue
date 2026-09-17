<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { isSupabaseConfigured } from '@/services/supabaseClient'
import { fetchEntitlement, resolvePlan } from '@/services/entitlementsService'
import { getPlanDefinition } from '@/config/plans'
import { listAvailableSports, getSportModule } from '@/sports/registry'
import { writeMatchIdToStorage } from '@/utils/localSync'
import { createOrResumeFreeMatch } from '@/utils/createFreeMatch'
import type { Entitlement } from '@/types/billing'
import type { SportId } from '@/types/sport'
import { EntitlementError } from '@/types/billing'

type CreateMode = 'match' | 'tournament'

const auth = useAuthStore()
const router = useRouter()
const entitlement = ref<Entitlement | null>(null)
const creating = ref(false)
const mode = ref<CreateMode | null>(null)
const selectedSport = ref<SportId | null>(null)
const error = ref<string | null>(null)
const sports = listAvailableSports()

const plan = computed(() => getPlanDefinition(resolvePlan(entitlement.value)))
const selectedSportModule = computed(() =>
  selectedSport.value ? getSportModule(selectedSport.value) : null,
)
const canContinue = computed(() => Boolean(mode.value && selectedSport.value))

async function loadPlan(): Promise<void> {
  if (!auth.profile || !isSupabaseConfigured) return
  entitlement.value = await fetchEntitlement(auth.profile.id)
}

function selectMode(next: CreateMode): void {
  mode.value = next
  error.value = null
}

function selectSport(id: SportId): void {
  selectedSport.value = id
  error.value = null
}

function resetStep(): void {
  if (selectedSport.value) {
    selectedSport.value = null
    return
  }
  mode.value = null
}

async function continueFlow(): Promise<void> {
  if (!mode.value || !selectedSport.value) return

  if (mode.value === 'tournament') {
    await router.push({
      name: 'tournaments',
      query: { sport: selectedSport.value, create: '1' },
    })
    return
  }

  await createMatchFlow(selectedSport.value)
}

async function createMatchFlow(sportId: SportId): Promise<void> {
  if (!auth.isAuthenticated) {
    await router.push({ name: 'access', query: { redirect: '/app' } })
    return
  }

  creating.value = true
  error.value = null
  try {
    const matchId = await createOrResumeFreeMatch(sportId, auth.profile?.id)
    writeMatchIdToStorage(matchId)
    const boardUrl = router.resolve({ name: 'board', query: { matchId } }).href
    const controlsUrl = router.resolve({ name: 'controls', query: { matchId } }).href
    window.open(boardUrl, '_blank')
    window.open(controlsUrl, '_blank')
  } catch (err) {
    error.value =
      err instanceof EntitlementError || err instanceof Error
        ? err.message
        : 'No se pudo crear el partido.'
  } finally {
    creating.value = false
  }
}

onMounted(() => {
  void loadPlan()
})
</script>

<template>
  <div class="app-home">
    <header class="app-home__header">
      <div>
        <p class="app-home__eyebrow">ScoreDesk</p>
        <h1>Hola{{ auth.profile?.display_name ? `, ${auth.profile.display_name}` : '' }}</h1>
        <p>Elige qué quieres operar. El público ve el live sin cuenta.</p>
      </div>
      <RouterLink :to="{ name: 'plans' }" class="app-home__plan">
        Plan {{ plan.name }}
      </RouterLink>
    </header>

    <a-alert
      v-if="error"
      type="warning"
      :message="error"
      show-icon
      closable
      style="margin-bottom: 1.25rem"
      @close="error = null"
    />

    <section class="app-home__stage" aria-labelledby="app-home-step">
      <div class="app-home__step-meta">
        <p id="app-home-step" class="app-home__step">
          {{ mode ? 'Paso 2 · Deporte' : 'Paso 1 · Qué crear' }}
        </p>
        <button
          v-if="mode"
          type="button"
          class="app-home__back"
          @click="resetStep"
        >
          Volver
        </button>
      </div>

      <template v-if="!mode">
        <h2 class="app-home__question">¿Qué quieres crear?</h2>
        <div class="app-home__choices" role="list">
          <button
            type="button"
            class="app-home__choice"
            role="listitem"
            @click="selectMode('match')"
          >
            <span class="app-home__choice-kicker">Marcador</span>
            <strong>Partido suelto</strong>
            <span>Un partido ahora: mesa + TV + live, sin calendario.</span>
          </button>
          <button
            type="button"
            class="app-home__choice"
            role="listitem"
            @click="selectMode('tournament')"
          >
            <span class="app-home__choice-kicker">Evento</span>
            <strong>Torneo</strong>
            <span>Calendario, canchas, plantillas y mesa por partido.</span>
          </button>
        </div>
      </template>

      <template v-else>
        <h2 class="app-home__question">
          {{ mode === 'match' ? 'Deporte del partido' : 'Deporte del torneo' }}
        </h2>
        <p class="app-home__hint">
          La mesa y el marcador TV usan las reglas de ese deporte.
        </p>
        <div class="app-home__sports" role="listbox" aria-label="Deportes disponibles">
          <button
            v-for="sport in sports"
            :key="sport.id"
            type="button"
            role="option"
            class="app-home__sport"
            :class="{ 'app-home__sport--active': selectedSport === sport.id }"
            :aria-selected="selectedSport === sport.id"
            @click="selectSport(sport.id)"
          >
            <strong>{{ sport.label }}</strong>
            <span>{{ sport.description }}</span>
          </button>
        </div>

        <div class="app-home__footer">
          <p v-if="selectedSportModule" class="app-home__selected">
            {{ selectedSportModule.label }} ·
            {{ mode === 'match' ? 'partido suelto' : 'nuevo torneo' }}
          </p>
          <a-button
            type="primary"
            size="large"
            :disabled="!canContinue"
            :loading="creating"
            @click="continueFlow"
          >
            {{ mode === 'match' ? 'Crear partido' : 'Continuar al torneo' }}
          </a-button>
        </div>
      </template>
    </section>

    <p class="app-home__secondary">
      <RouterLink :to="{ name: 'live-now' }">Ver partidos en vivo</RouterLink>
      <span aria-hidden="true">·</span>
      <RouterLink :to="{ name: 'tournaments' }">Mis torneos</RouterLink>
    </p>
  </div>
</template>

<style scoped lang="scss">
.app-home {
  max-width: 820px;
  margin: 0 auto;
  padding: 1.75rem 1.5rem 3rem;
}

.app-home__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  margin-bottom: 1.75rem;

  h1 {
    margin: 0 0 0.35rem;
    font-family: 'Bebas Neue', sans-serif;
    font-weight: 400;
    font-size: clamp(2.2rem, 6vw, 3rem);
    letter-spacing: 0.03em;
  }

  p {
    margin: 0;
    color: var(--app-text-muted);
    max-width: 28rem;
    line-height: 1.45;
  }
}

.app-home__eyebrow {
  margin: 0 0 0.3rem !important;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--app-link);
}

.app-home__plan {
  flex-shrink: 0;
  padding: 0.4rem 0.75rem;
  border-radius: 10px;
  border: 1px solid color-mix(in srgb, var(--app-primary) 40%, transparent);
  background: color-mix(in srgb, var(--app-primary) 12%, transparent);
  color: var(--app-link);
  text-decoration: none;
  font-size: 0.82rem;
  font-weight: 650;
}

.app-home__stage {
  padding: 1.5rem 1.35rem 1.6rem;
  border-radius: 18px;
  border: 1px solid var(--app-border);
  background:
    linear-gradient(
      155deg,
      color-mix(in srgb, var(--app-primary) 14%, transparent),
      transparent 48%
    ),
    var(--app-surface);
}

.app-home__step-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.85rem;
}

.app-home__step {
  margin: 0;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--app-link);
}

.app-home__back {
  border: 0;
  background: transparent;
  color: var(--app-text-muted);
  font-size: 0.86rem;
  font-weight: 600;
  cursor: pointer;
  padding: 0.2rem 0;

  &:hover {
    color: var(--app-text);
  }
}

.app-home__question {
  margin: 0 0 0.35rem;
  font-size: clamp(1.35rem, 3vw, 1.7rem);
}

.app-home__hint {
  margin: 0 0 1rem;
  color: var(--app-text-muted);
  font-size: 0.92rem;
}

.app-home__choices,
.app-home__sports {
  display: grid;
  gap: 0.75rem;
}

.app-home__choices {
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  margin-top: 1rem;
}

.app-home__choice,
.app-home__sport {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.35rem;
  width: 100%;
  padding: 1.1rem 1.15rem;
  border-radius: 14px;
  border: 1px solid var(--app-border);
  background: var(--app-bg-elevated);
  color: var(--app-text);
  text-align: left;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;

  strong {
    font-size: 1.12rem;
  }

  span:last-child {
    color: var(--app-text-muted);
    font-size: 0.88rem;
    line-height: 1.4;
  }

  &:hover {
    border-color: color-mix(in srgb, var(--app-link) 45%, transparent);
  }
}

.app-home__choice-kicker {
  font-size: 0.68rem !important;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--app-link) !important;
}

.app-home__sport--active {
  border-color: color-mix(in srgb, var(--app-link) 65%, transparent);
  background: color-mix(in srgb, var(--app-link) 10%, var(--app-bg-elevated));
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--app-link) 30%, transparent);
}

.app-home__footer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.85rem;
  margin-top: 1.25rem;
  padding-top: 1rem;
  border-top: 1px solid var(--app-border);
}

.app-home__selected {
  margin: 0;
  color: var(--app-text-muted);
  font-size: 0.88rem;
}

.app-home__secondary {
  display: flex;
  flex-wrap: wrap;
  gap: 0.55rem;
  align-items: center;
  margin: 1.25rem 0 0;
  color: var(--app-text-muted);
  font-size: 0.88rem;

  a {
    color: var(--app-link);
    text-decoration: none;
    font-weight: 600;

    &:hover {
      text-decoration: underline;
    }
  }
}
</style>
