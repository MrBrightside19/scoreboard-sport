<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import { useAuthStore } from '@/stores/auth'
import {
  getUserPreferences,
  setUserPreferences,
  type UserPreferences,
} from '@/utils/userPreferences'

const auth = useAuthStore()
const router = useRouter()

const savingProfile = ref(false)
const loggingOut = ref(false)
const profileError = ref<string | null>(null)

const form = reactive({
  displayName: '',
})

const prefs = reactive<UserPreferences>({
  ...getUserPreferences(),
})

const roleLabel = computed(() => {
  if (auth.isOrganizer) return 'Organizador'
  if (auth.isAssistant) return 'Asistente'
  return 'Espectador'
})

const roleHint = computed(() => {
  if (auth.isOrganizer) {
    return 'Puedes crear y administrar torneos, y operar la mesa de control.'
  }
  if (auth.isAssistant) {
    return 'Puedes operar calendario y controles de los torneos donde te asignaron.'
  }
  return 'Puedes ver torneos públicos y marcadores en vivo. Para organizar, crea una cuenta de organizador.'
})

const displayNameDirty = computed(() => {
  const current = (auth.profile?.display_name ?? '').trim()
  return form.displayName.trim() !== current && form.displayName.trim().length > 0
})

watch(
  () => auth.profile,
  (profile) => {
    form.displayName = profile?.display_name ?? ''
  },
  { immediate: true },
)

onMounted(() => {
  if (!auth.loading && !auth.isAuthenticated) {
    void router.replace({ name: 'home', query: { auth: '1' } })
  }
})

watch(
  () => auth.loading,
  (loading) => {
    if (!loading && !auth.isAuthenticated) {
      void router.replace({ name: 'home', query: { auth: '1' } })
    }
  },
)

async function saveProfile(): Promise<void> {
  if (!displayNameDirty.value) return
  savingProfile.value = true
  profileError.value = null
  try {
    await auth.updateDisplayName(form.displayName)
    message.success('Perfil actualizado')
  } catch (err) {
    profileError.value = err instanceof Error ? err.message : 'No se pudo guardar'
  } finally {
    savingProfile.value = false
  }
}

function onBeepToggle(checked: boolean | string | number): void {
  const enabled = Boolean(checked)
  prefs.countdownBeepEnabled = enabled
  setUserPreferences({ countdownBeepEnabled: enabled })
  message.success(
    enabled
      ? 'Beep de cuenta regresiva activado'
      : 'Beep de cuenta regresiva desactivado',
  )
}

async function handleLogout(): Promise<void> {
  loggingOut.value = true
  try {
    await auth.logout()
    await router.push({ name: 'home' })
  } finally {
    loggingOut.value = false
  }
}
</script>

<template>
  <div class="profile">
    <a-spin :spinning="auth.loading">
      <header class="profile__header">
        <h1>Perfil</h1>
        <p>Tu cuenta y las preferencias del sistema en este navegador.</p>
      </header>

      <template v-if="auth.profile">
        <section class="profile__panel" aria-labelledby="profile-account">
          <div class="profile__panel-head">
            <div>
              <h2 id="profile-account">Cuenta</h2>
              <p class="profile__desc">
                Datos visibles en la app. El email no se puede cambiar desde aquí.
              </p>
            </div>
          </div>

          <a-form layout="vertical" class="profile__form" @submit.prevent="saveProfile">
            <a-form-item label="Nombre para mostrar">
              <a-input
                v-model:value="form.displayName"
                :maxlength="40"
                show-count
                placeholder="Tu nombre"
              />
            </a-form-item>

            <a-form-item label="Email">
              <a-input :value="auth.profile.email" disabled />
            </a-form-item>

            <a-form-item label="Rol">
              <div class="profile__role">
                <a-tag>{{ roleLabel }}</a-tag>
                <span class="profile__role-hint">{{ roleHint }}</span>
              </div>
            </a-form-item>

            <a-alert
              v-if="profileError"
              type="error"
              :message="profileError"
              show-icon
              class="profile__alert"
            />

            <div class="profile__actions">
              <a-button
                type="primary"
                html-type="submit"
                :loading="savingProfile"
                :disabled="!displayNameDirty"
              >
                Guardar cambios
              </a-button>
            </div>
          </a-form>
        </section>

        <section class="profile__panel" aria-labelledby="profile-system">
          <div class="profile__panel-head">
            <div>
              <h2 id="profile-system">Configuración del sistema</h2>
              <p class="profile__desc">
                Preferencias de este navegador. No se sincronizan entre dispositivos.
              </p>
            </div>
          </div>

          <div class="profile__pref-list">
            <div class="profile__pref-row">
              <div>
                <h3>Beep de cuenta regresiva</h3>
                <p>
                  Sonido corto en la mesa de control cuando el reloj llega a los últimos segundos.
                </p>
              </div>
              <a-switch
                :checked="prefs.countdownBeepEnabled"
                @update:checked="onBeepToggle"
              />
            </div>
          </div>
        </section>

        <section class="profile__panel profile__panel--danger" aria-labelledby="profile-session">
          <div class="profile__panel-head">
            <div>
              <h2 id="profile-session">Sesión</h2>
              <p class="profile__desc">
                Cierra la sesión en este dispositivo.
              </p>
            </div>
            <a-button danger :loading="loggingOut" @click="handleLogout">
              Cerrar sesión
            </a-button>
          </div>
        </section>
      </template>
    </a-spin>
  </div>
</template>

<style scoped lang="scss">
.profile {
  max-width: min(720px, 100%);
  width: 100%;
  margin: 0 auto;
  padding: 2rem 1.5rem 3rem;
  box-sizing: border-box;
}

.profile__header {
  margin-bottom: 1.75rem;

  h1 {
    margin: 0;
    font-family: 'Bebas Neue', sans-serif;
    font-size: 2.4rem;
    letter-spacing: 0.04em;
    line-height: 1;
  }

  p {
    margin: 0.5rem 0 0;
    font-size: 0.92rem;
    opacity: 0.55;
  }
}

.profile__panel {
  padding: 1.15rem 1.2rem;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.035);
  border: 1px solid rgba(255, 255, 255, 0.08);

  & + & {
    margin-top: 1rem;
  }

  &--danger {
    border-color: rgba(255, 77, 79, 0.28);
  }
}

.profile__panel-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;

  h2 {
    margin: 0;
    font-size: 1.05rem;
  }
}

.profile__desc {
  margin: 0.35rem 0 0;
  font-size: 0.85rem;
  opacity: 0.55;
  line-height: 1.45;
}

.profile__form {
  max-width: 28rem;
}

.profile__role {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.4rem;
}

.profile__role-hint {
  font-size: 0.8rem;
  opacity: 0.55;
  line-height: 1.4;
}

.profile__alert {
  margin-bottom: 0.85rem;
}

.profile__actions {
  display: flex;
  justify-content: flex-start;
}

.profile__pref-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.profile__pref-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.85rem 0.9rem;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.16);
  border: 1px solid rgba(255, 255, 255, 0.06);

  h3 {
    margin: 0;
    font-size: 0.92rem;
    font-weight: 650;
  }

  p {
    margin: 0.3rem 0 0;
    font-size: 0.8rem;
    opacity: 0.55;
    line-height: 1.4;
  }
}
</style>
