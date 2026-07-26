<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import { useAuthStore } from '@/stores/auth'
import {
  getUserPreferences,
  setUserPreferences,
  type AppTheme,
  type UserPreferences,
  MIN_COUNTDOWN_BEEP_SECONDS,
  MAX_COUNTDOWN_BEEP_SECONDS,
} from '@/utils/userPreferences'

const auth = useAuthStore()
const router = useRouter()

const savingProfile = ref(false)
const savingPassword = ref(false)
const loggingOut = ref(false)
const profileError = ref<string | null>(null)
const passwordError = ref<string | null>(null)

const form = reactive({
  displayName: '',
})

const passwordForm = reactive({
  current: '',
  next: '',
  confirm: '',
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

const canSubmitPassword = computed(
  () =>
    passwordForm.current.length > 0 &&
    passwordForm.next.length >= 6 &&
    passwordForm.next === passwordForm.confirm,
)

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

async function savePassword(): Promise<void> {
  passwordError.value = null
  if (passwordForm.next.length < 6) {
    passwordError.value = 'La nueva contraseña debe tener al menos 6 caracteres.'
    return
  }
  if (passwordForm.next !== passwordForm.confirm) {
    passwordError.value = 'La confirmación no coincide.'
    return
  }

  savingPassword.value = true
  try {
    await auth.updatePassword(passwordForm.current, passwordForm.next)
    passwordForm.current = ''
    passwordForm.next = ''
    passwordForm.confirm = ''
    message.success('Contraseña actualizada')
  } catch (err) {
    passwordError.value =
      err instanceof Error ? err.message : 'No se pudo cambiar la contraseña'
  } finally {
    savingPassword.value = false
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

function onBeepSecondsChange(value: number | null): void {
  if (value == null) return
  prefs.countdownBeepSeconds = value
  setUserPreferences({ countdownBeepSeconds: value })
  message.success(`La cuenta regresiva inicia a los ${value} s`)
}

function setTheme(theme: AppTheme): void {
  if (prefs.theme === theme) return
  prefs.theme = theme
  setUserPreferences({ theme })
  message.success(theme === 'light' ? 'Tema claro activado' : 'Tema oscuro activado')
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

        <section class="profile__panel" aria-labelledby="profile-password">
          <div class="profile__panel-head">
            <div>
              <h2 id="profile-password">Contraseña</h2>
              <p class="profile__desc">
                Cambia tu contraseña. Necesitas la actual para confirmar el cambio.
              </p>
            </div>
          </div>

          <a-form layout="vertical" class="profile__form" @submit.prevent="savePassword">
            <a-form-item label="Contraseña actual">
              <a-input-password
                v-model:value="passwordForm.current"
                autocomplete="current-password"
                placeholder="Tu contraseña actual"
              />
            </a-form-item>

            <a-form-item label="Nueva contraseña">
              <a-input-password
                v-model:value="passwordForm.next"
                autocomplete="new-password"
                placeholder="Mínimo 6 caracteres"
              />
            </a-form-item>

            <a-form-item label="Confirmar nueva contraseña">
              <a-input-password
                v-model:value="passwordForm.confirm"
                autocomplete="new-password"
                placeholder="Repite la nueva contraseña"
              />
            </a-form-item>

            <a-alert
              v-if="passwordError"
              type="error"
              :message="passwordError"
              show-icon
              class="profile__alert"
            />

            <div class="profile__actions">
              <a-button
                type="primary"
                html-type="submit"
                :loading="savingPassword"
                :disabled="!canSubmitPassword"
              >
                Cambiar contraseña
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

            <div class="profile__pref-row profile__pref-row--stack">
              <div>
                <h3>Inicio de la cuenta regresiva</h3>
                <p>
                  Desde cuántos segundos restantes empieza el beep
                  ({{ MIN_COUNTDOWN_BEEP_SECONDS }}–{{ MAX_COUNTDOWN_BEEP_SECONDS }}).
                  Por defecto 10.
                </p>
              </div>
              <a-input-number
                :value="prefs.countdownBeepSeconds"
                :min="MIN_COUNTDOWN_BEEP_SECONDS"
                :max="MAX_COUNTDOWN_BEEP_SECONDS"
                :disabled="!prefs.countdownBeepEnabled"
                addon-after="s"
                class="profile__seconds-input"
                @update:value="onBeepSecondsChange"
              />
            </div>

            <div class="profile__pref-row profile__pref-row--stack">
              <div>
                <h3>Tema de la interfaz</h3>
                <p>
                  Cambia entre modo oscuro y claro. El marcador TV y el overlay OBS se mantienen oscuros.
                </p>
              </div>
              <div class="profile__theme-toggle" role="group" aria-label="Tema">
                <a-button
                  :type="prefs.theme === 'dark' ? 'primary' : 'default'"
                  @click="setTheme('dark')"
                >
                  Oscuro
                </a-button>
                <a-button
                  :type="prefs.theme === 'light' ? 'primary' : 'default'"
                  @click="setTheme('light')"
                >
                  Claro
                </a-button>
              </div>
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
    color: var(--app-text-muted);
  }
}

.profile__panel {
  padding: 1.15rem 1.2rem;
  border-radius: 12px;
  background: var(--app-surface);
  border: 1px solid var(--app-border);
  color: var(--app-text);

  & + & {
    margin-top: 1rem;
  }

  &--danger {
    border-color: var(--app-danger-border);
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
  color: var(--app-text-muted);
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
  color: var(--app-text-muted);
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
  background: var(--app-surface-inset);
  border: 1px solid var(--app-border);

  &--stack {
    flex-wrap: wrap;
  }

  h3 {
    margin: 0;
    font-size: 0.92rem;
    font-weight: 650;
    color: var(--app-text);
  }

  p {
    margin: 0.3rem 0 0;
    font-size: 0.8rem;
    color: var(--app-text-muted);
    line-height: 1.4;
  }
}

.profile__seconds-input {
  width: 8.5rem;
}

.profile__theme-toggle {
  display: flex;
  gap: 0.45rem;
  flex-wrap: wrap;
}
</style>
