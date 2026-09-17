<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import AuthModal from '@/components/AuthModal.vue'
import { fetchActiveFreeMatch, fetchMatchState } from '@/services/matchSync'
import { isSupabaseConfigured } from '@/services/supabaseClient'
import { getStorageKey, writeMatchIdToStorage } from '@/utils/localSync'
import { parseMatchCode } from '@/utils/mobileMesa'

const auth = useAuthStore()
const router = useRouter()

const code = ref('')
const joining = ref(false)
const error = ref<string | null>(null)
const activeMatch = ref<{ id: string; title: string } | null>(null)

const canJoin = computed(() => parseMatchCode(code.value).length >= 4)
const canOperate = computed(() => !isSupabaseConfigured || auth.isStaff)

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

function onLoginSuccess(): void {
  void loadActive()
}

async function signOut(): Promise<void> {
  await auth.logout()
}

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
      En el teléfono controlás el partido y copiás Live u overlay.
      El marcador TV se abre en otra pantalla.
    </p>

    <p class="mobile-mesa__install">
      Para usarla como app, instalá ScoreDesk desde esta pantalla (no desde el
      partido): menú del navegador → Añadir a inicio.
    </p>

    <section v-if="auth.loading" class="mobile-mesa__card">
      <p>Cargando cuenta…</p>
    </section>

    <section v-else-if="!auth.isAuthenticated" class="mobile-mesa__card">
      <h2>Iniciá sesión</h2>
      <p>Necesitás una cuenta de mesa para operar.</p>
      <AuthModal initial-mode="login" @success="onLoginSuccess" />
    </section>

    <template v-else>
      <a-alert
        v-if="!auth.isStaff"
        type="warning"
        message="Esta cuenta no es de mesa. Pedile al organizador que te sume como asistente."
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
        <span class="mobile-mesa__code">{{ activeMatch.id }}</span>
        <a-button
          type="primary"
          block
          :loading="joining"
          :disabled="!canOperate"
          @click="openMatch(activeMatch.id)"
        >
          Continuar partido
        </a-button>
      </section>

      <section class="mobile-mesa__card">
        <h2>Código del partido</h2>
        <p>
          Pegá el código o el enlace. Está en la mesa de PC, abajo del título
          (“Partido: partido-…” ).
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
</style>
