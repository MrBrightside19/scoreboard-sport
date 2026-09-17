<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import AuthModal from '@/components/AuthModal.vue'
import { fetchActiveFreeMatch, fetchMatchState } from '@/services/matchSync'
import { isSupabaseConfigured } from '@/services/supabaseClient'
import { getStorageKey, writeMatchIdToStorage } from '@/utils/localSync'
import { parseMatchCode } from '@/utils/mobileMesa'
import { createOrResumeFreeMatch } from '@/utils/createFreeMatch'
import { listAvailableSports, getSportModule } from '@/sports/registry'
import { EntitlementError } from '@/types/billing'
import type { SportId } from '@/types/sport'

type CreateMode = 'match' | 'tournament'

const auth = useAuthStore()
const router = useRouter()

const code = ref('')
const joining = ref(false)
const creating = ref(false)
const error = ref<string | null>(null)
const activeMatch = ref<{ id: string; title: string } | null>(null)
const createMode = ref<CreateMode | null>(null)
const selectedSport = ref<SportId | null>(null)
const showOtherCode = ref(false)
const sports = listAvailableSports()

const canJoin = computed(() => parseMatchCode(code.value).length >= 4)
const canOperate = computed(() => !isSupabaseConfigured || auth.isStaff)
const canCreate = computed(() => !isSupabaseConfigured || auth.isOrganizer)
const canContinueCreate = computed(() => Boolean(createMode.value && selectedSport.value))
const selectedSportModule = computed(() =>
  selectedSport.value ? getSportModule(selectedSport.value) : null,
)
const showCodeCard = computed(() => !activeMatch.value || showOtherCode.value)

async function loadActive(): Promise<void> {
  if (!isSupabaseConfigured || !auth.profile) {
    activeMatch.value = null
    return
  }
  const row = await fetchActiveFreeMatch(auth.profile.id)
  if (!row || row.finished_at) {
    activeMatch.value = null
    return
  }
  activeMatch.value = {
    id: row.id,
    title: row.title || `${row.state.localTeam} vs ${row.state.visitTeam}`,
  }
}

async function openMatch(id: string): Promise<void> {
  joining.value = true
  error.value = null
  try {
    const matchId = parseMatchCode(id)
    if (!matchId) {
      error.value = 'Ingresa el código del partido.'
      return
    }

    if (isSupabaseConfigured) {
      const record = await fetchMatchState(matchId)
      if (!record) {
        error.value = 'No encontramos ese partido. Revisa el código.'
        return
      }
      if (record.finished_at) {
        error.value = 'Ese partido ya está finalizado.'
        return
      }
    } else if (!localStorage.getItem(getStorageKey(matchId))) {
      error.value = 'No encontramos ese partido en este dispositivo.'
      return
    }

    writeMatchIdToStorage(matchId)
    await router.replace({ name: 'controls', query: { matchId } })
  } catch (err) {
    error.value =
      err instanceof Error ? err.message : 'No se pudo abrir la mesa.'
  } finally {
    joining.value = false
  }
}

function submit(): void {
  void openMatch(code.value)
}

function selectCreateMode(next: CreateMode): void {
  createMode.value = next
  selectedSport.value = null
  error.value = null
}

function resetCreate(): void {
  if (selectedSport.value) {
    selectedSport.value = null
    return
  }
  createMode.value = null
}

async function continueCreate(): Promise<void> {
  if (!createMode.value || !selectedSport.value || !canCreate.value) return

  if (createMode.value === 'tournament') {
    await router.push({
      name: 'tournaments',
      query: { sport: selectedSport.value, create: '1' },
    })
    return
  }

  creating.value = true
  error.value = null
  try {
    const matchId = await createOrResumeFreeMatch(
      selectedSport.value,
      auth.profile?.id,
    )
    writeMatchIdToStorage(matchId)
    await router.replace({ name: 'controls', query: { matchId } })
  } catch (err) {
    error.value =
      err instanceof EntitlementError || err instanceof Error
        ? err.message
        : 'No se pudo crear el partido.'
  } finally {
    creating.value = false
  }
}

function onLoginSuccess(): void {
  void loadActive()
}

async function signOut(): Promise<void> {
  await auth.logout()
  createMode.value = null
  selectedSport.value = null
}

watch(activeMatch, () => {
  showOtherCode.value = false
  code.value = ''
})

watch(
  () => [auth.loading, auth.isAuthenticated] as const,
  ([loading, ok]) => {
    if (!loading && ok) void loadActive()
  },
  { immediate: true },
)
</script>

<template>
  <div class="mobile-mesa">
    <header class="mobile-mesa__top">
      <div>
        <p class="mobile-mesa__eyebrow">Mesa móvil</p>
        <h1>Operar partido</h1>
      </div>
      <a-button v-if="auth.isAuthenticated" size="small" @click="signOut">
        Salir
      </a-button>
    </header>

    <p class="mobile-mesa__lead">
      Desde el teléfono puedes crear un partido o un torneo, operar la mesa y
      copiar Live u overlay. El marcador TV se abre en otra pantalla.
    </p>

    <p class="mobile-mesa__install">
      Para usarla como app, instala ScoreDesk desde esta pantalla (no desde el
      partido): menú del navegador → Añadir a inicio.
    </p>

    <section v-if="auth.loading" class="mobile-mesa__card">
      <p>Cargando cuenta…</p>
    </section>

    <section v-else-if="!auth.isAuthenticated" class="mobile-mesa__card">
      <h2>Inicia sesión</h2>
      <p>Necesitas una cuenta de mesa para operar.</p>
      <AuthModal initial-mode="login" @success="onLoginSuccess" />
    </section>

    <template v-else>
      <a-alert
        v-if="!auth.isStaff"
        type="warning"
        message="Esta cuenta no es de mesa. Pídele al organizador que te agregue como asistente."
        show-icon
        style="margin-bottom: 1rem"
      />
      <a-alert
        v-if="error"
        type="error"
        :message="error"
        show-icon
        closable
        style="margin-bottom: 1rem"
        @close="error = null"
      />

      <section v-if="activeMatch" class="mobile-mesa__card">
        <p class="mobile-mesa__kicker">En vivo</p>
        <strong>{{ activeMatch.title }}</strong>
        <a-button
          type="primary"
          block
          :loading="joining"
          :disabled="!canOperate"
          @click="openMatch(activeMatch.id)"
        >
          Continuar partido
        </a-button>
        <button
          v-if="!showOtherCode"
          type="button"
          class="mobile-mesa__other"
          @click="showOtherCode = true"
        >
          Abrir otro partido
        </button>
      </section>

      <section v-if="canCreate" class="mobile-mesa__card">
        <div class="mobile-mesa__card-head">
          <h2>Crear</h2>
          <button
            v-if="createMode"
            type="button"
            class="mobile-mesa__back"
            @click="resetCreate"
          >
            Volver
          </button>
        </div>

        <template v-if="!createMode">
          <p>Un partido ahora, o un torneo con calendario.</p>
          <div class="mobile-mesa__choices">
            <button
              type="button"
              class="mobile-mesa__choice"
              @click="selectCreateMode('match')"
            >
              <span>Marcador</span>
              <strong>Partido suelto</strong>
            </button>
            <button
              type="button"
              class="mobile-mesa__choice"
              @click="selectCreateMode('tournament')"
            >
              <span>Evento</span>
              <strong>Torneo</strong>
            </button>
          </div>
        </template>

        <template v-else>
          <p>
            {{
              createMode === 'match'
                ? 'Deporte del partido'
                : 'Deporte del torneo'
            }}
          </p>
          <div class="mobile-mesa__sports">
            <button
              v-for="sport in sports"
              :key="sport.id"
              type="button"
              class="mobile-mesa__sport"
              :class="{ 'mobile-mesa__sport--active': selectedSport === sport.id }"
              @click="selectedSport = sport.id"
            >
              {{ sport.label }}
            </button>
          </div>
          <a-button
            type="primary"
            block
            size="large"
            :disabled="!canContinueCreate"
            :loading="creating"
            style="margin-top: 0.65rem"
            @click="continueCreate"
          >
            {{ createMode === 'match' ? 'Crear partido' : 'Continuar al torneo' }}
          </a-button>
          <p v-if="selectedSportModule" class="mobile-mesa__selected">
            {{ selectedSportModule.label }} ·
            {{ createMode === 'match' ? 'partido suelto' : 'nuevo torneo' }}
          </p>
        </template>
      </section>

      <section v-if="showCodeCard" class="mobile-mesa__card">
        <h2>{{ activeMatch ? 'Otro partido' : 'Código del partido' }}</h2>
        <p v-if="activeMatch">
          Pega el código o el enlace de otro partido.
        </p>
        <p v-else>
          Pega el código o el enlace si te lo compartieron.
        </p>
        <a-input
          v-model:value="code"
          size="large"
          placeholder="partido-xxxxxxx"
          allow-clear
          @pressEnter="submit"
        />
        <a-button
          type="primary"
          block
          size="large"
          :disabled="!canJoin || !canOperate"
          :loading="joining"
          style="margin-top: 0.85rem"
          @click="submit"
        >
          Abrir mesa
        </a-button>
      </section>

      <p v-if="auth.isStaff" class="mobile-mesa__secondary">
        <router-link :to="{ name: 'tournaments' }">Mis torneos</router-link>
      </p>
    </template>
  </div>
</template>

<style scoped lang="scss">
.mobile-mesa {
  max-width: 460px;
  margin: 0 auto;
  padding: 1.5rem 1.15rem 2.5rem;
}

.mobile-mesa__top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  margin-bottom: 0.75rem;
}

.mobile-mesa__eyebrow {
  margin: 0 0 0.3rem;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--app-link);
}

.mobile-mesa h1 {
  margin: 0;
  font-size: 1.55rem;
}

.mobile-mesa__lead {
  margin: 0 0 0.65rem;
  color: var(--app-text-muted);
  line-height: 1.45;
}

.mobile-mesa__install {
  margin: 0 0 1.25rem;
  color: var(--app-text-muted);
  font-size: 0.82rem;
  line-height: 1.4;
}

.mobile-mesa__card {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  margin-bottom: 1rem;
  padding: 1.25rem 1.15rem 1.35rem;
  border-radius: 16px;
  border: 1px solid var(--app-border);
  background: var(--app-bg-elevated);

  h2 {
    margin: 0;
    font-size: 1.05rem;
  }

  p {
    margin: 0 0 0.55rem;
    color: var(--app-text-muted);
    font-size: 0.88rem;
    line-height: 1.4;
  }
}

.mobile-mesa__card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.mobile-mesa__back {
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

.mobile-mesa__choices {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.55rem;
}

.mobile-mesa__choice,
.mobile-mesa__sport {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.2rem;
  width: 100%;
  padding: 0.85rem 0.9rem;
  border-radius: 12px;
  border: 1px solid var(--app-border);
  background: var(--app-bg);
  color: var(--app-text);
  text-align: left;
  cursor: pointer;

  span {
    font-size: 0.65rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--app-link);
  }

  strong {
    font-size: 0.95rem;
  }
}

.mobile-mesa__sports {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.45rem;
}

.mobile-mesa__sport {
  align-items: center;
  font-size: 0.88rem;
  font-weight: 650;
}

.mobile-mesa__sport--active {
  border-color: color-mix(in srgb, var(--app-link) 65%, transparent);
  background: color-mix(in srgb, var(--app-link) 10%, var(--app-bg-elevated));
}

.mobile-mesa__selected {
  margin: 0.45rem 0 0 !important;
  font-size: 0.8rem !important;
}

.mobile-mesa__kicker {
  margin: 0;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--app-link);
}

.mobile-mesa__code {
  margin: 0 0 0.65rem;
  font-size: 0.82rem;
  color: var(--app-text-muted);
  word-break: break-all;
}

.mobile-mesa__other {
  margin-top: 0.35rem;
  border: 0;
  background: transparent;
  color: var(--app-link);
  font-size: 0.86rem;
  font-weight: 600;
  cursor: pointer;
  padding: 0.35rem 0;
}

.mobile-mesa__secondary {
  margin: 0.25rem 0 0;
  text-align: center;
  font-size: 0.88rem;

  a {
    color: var(--app-link);
    font-weight: 600;
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }
}
</style>
