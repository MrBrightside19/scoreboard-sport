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
  MIN_LATE_GAME_WARNING_MINUTES,
  MAX_LATE_GAME_WARNING_MINUTES,
} from '@/utils/userPreferences'
import { playLateGameWarning } from '@/utils/lateGameWarningBeep'
import { playCountdownBeep } from '@/utils/countdownBeep'
import type {
  OverlayScoreboardStyle,
  TvScoreboardStyle,
} from '@/config/scoreboardStyles'
import ScoreboardStylePicker from '@/components/ScoreboardStylePicker.vue'

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

function onLateGameWarningToggle(checked: boolean | string | number): void {
  const enabled = Boolean(checked)
  prefs.lateGameWarningEnabled = enabled
  setUserPreferences({ lateGameWarningEnabled: enabled })
  message.success(
    enabled
      ? 'Aviso de últimos minutos activado'
      : 'Aviso de últimos minutos desactivado',
  )
}

function onLateGameWarningMinutesChange(value: number | null): void {
  if (value == null) return
  prefs.lateGameWarningMinutes = value
  setUserPreferences({ lateGameWarningMinutes: value })
  message.success(`Aviso a los ${value} min restantes`)
}

async function previewLateGameWarning(): Promise<void> {
  try {
    await playLateGameWarning({ force: true })
  } catch {
    message.warning('No se pudo reproducir el sonido de prueba')
  }
}

async function previewCountdownBeep(): Promise<void> {
  try {
    // Mismo beep que en controles (un tick), sin alargar la prueba.
    await playCountdownBeep(false, { force: true })
  } catch {
    message.warning('No se pudo reproducir el sonido de prueba')
  }
}

function setTheme(theme: AppTheme): void {
  if (prefs.theme === theme) return
  prefs.theme = theme
  setUserPreferences({ theme })
  message.success(theme === 'light' ? 'Tema claro activado' : 'Tema oscuro activado')
}

function onTvStyleChange(style: TvScoreboardStyle | OverlayScoreboardStyle): void {
  const next = style as TvScoreboardStyle
  if (prefs.tvScoreboardStyle === next) return
  prefs.tvScoreboardStyle = next
  setUserPreferences({ tvScoreboardStyle: next })
  message.success('Estilo de marcador TV actualizado')
}

function onOverlayStyleChange(style: TvScoreboardStyle | OverlayScoreboardStyle): void {
  const next = style as OverlayScoreboardStyle
  if (prefs.overlayScoreboardStyle === next) return
  prefs.overlayScoreboardStyle = next
  setUserPreferences({ overlayScoreboardStyle: next })
  message.success('Estilo de overlay actualizado')
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

          <div class="profile__pref-groups">
            <section class="profile__pref-group" aria-labelledby="profile-alerts">
              <header class="profile__pref-group-head">
                <h3 id="profile-alerts">Alertas de mesa</h3>
                <p>
                  Sonidos de la mesa de control para árbitros y operadores.
                </p>
              </header>

              <div class="profile__pref-card">
                <div class="profile__pref-card-top">
                  <div class="profile__pref-card-copy">
                    <h4>Cuenta regresiva final</h4>
                    <p>
                      Beep corto en los últimos segundos del reloj
                      ({{ MIN_COUNTDOWN_BEEP_SECONDS }}–{{ MAX_COUNTDOWN_BEEP_SECONDS }} s;
                      por defecto 10).
                    </p>
                  </div>
                  <a-switch
                    :checked="prefs.countdownBeepEnabled"
                    aria-label="Activar beep de cuenta regresiva"
                    @update:checked="onBeepToggle"
                  />
                </div>
                <div class="profile__pref-card-controls">
                  <label class="profile__field-label" for="profile-countdown-seconds">
                    Inicia a los
                  </label>
                  <a-input-number
                    id="profile-countdown-seconds"
                    :value="prefs.countdownBeepSeconds"
                    :min="MIN_COUNTDOWN_BEEP_SECONDS"
                    :max="MAX_COUNTDOWN_BEEP_SECONDS"
                    :disabled="!prefs.countdownBeepEnabled"
                    addon-after="s"
                    class="profile__seconds-input"
                    @update:value="onBeepSecondsChange"
                  />
                  <a-button @click="previewCountdownBeep">
                    Probar sonido
                  </a-button>
                </div>
              </div>

              <div class="profile__pref-card">
                <div class="profile__pref-card-top">
                  <div class="profile__pref-card-copy">
                    <h4>Últimos minutos de juego</h4>
                    <p>
                      Aviso distinto al beep final, al entrar en los últimos minutos
                      ({{ MIN_LATE_GAME_WARNING_MINUTES }}–{{ MAX_LATE_GAME_WARNING_MINUTES }};
                      por defecto 2).
                    </p>
                  </div>
                  <a-switch
                    :checked="prefs.lateGameWarningEnabled"
                    aria-label="Activar aviso de últimos minutos"
                    @update:checked="onLateGameWarningToggle"
                  />
                </div>
                <div class="profile__pref-card-controls">
                  <label class="profile__field-label" for="profile-late-game-minutes">
                    Avisa a los
                  </label>
                  <a-input-number
                    id="profile-late-game-minutes"
                    :value="prefs.lateGameWarningMinutes"
                    :min="MIN_LATE_GAME_WARNING_MINUTES"
                    :max="MAX_LATE_GAME_WARNING_MINUTES"
                    :disabled="!prefs.lateGameWarningEnabled"
                    addon-after="min"
                    class="profile__seconds-input"
                    @update:value="onLateGameWarningMinutesChange"
                  />
                  <a-button @click="previewLateGameWarning">
                    Probar sonido
                  </a-button>
                </div>
              </div>
            </section>

            <section class="profile__pref-group" aria-labelledby="profile-appearance">
              <header class="profile__pref-group-head">
                <h3 id="profile-appearance">Apariencia</h3>
                <p>
                  Tema de la aplicación. El marcador TV y el overlay OBS se mantienen oscuros.
                </p>
              </header>

              <div class="profile__pref-card profile__pref-card--inline">
                <div class="profile__pref-card-copy">
                  <h4>Tema de la interfaz</h4>
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
            </section>

            <section class="profile__pref-group" aria-labelledby="profile-boards">
              <header class="profile__pref-group-head">
                <h3 id="profile-boards">Marcadores</h3>
                <p>
                  Estilos visuales para la pantalla de cancha y la transmisión OBS.
                </p>
              </header>

              <div class="profile__pref-card profile__pref-card--stack">
                <div class="profile__pref-card-copy">
                  <h4>Marcador TV</h4>
                  <p>Diseño de la pantalla grande de cancha.</p>
                </div>
                <ScoreboardStylePicker
                  mode="tv"
                  :model-value="prefs.tvScoreboardStyle"
                  @update:model-value="onTvStyleChange"
                />
              </div>

              <div class="profile__pref-card profile__pref-card--stack">
                <div class="profile__pref-card-copy">
                  <h4>Overlay OBS</h4>
                  <p>Diseño del marcador transparente para transmisión.</p>
                </div>
                <ScoreboardStylePicker
                  mode="overlay"
                  :model-value="prefs.overlayScoreboardStyle"
                  @update:model-value="onOverlayStyleChange"
                />
              </div>
            </section>
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
  max-width: min(780px, 100%);
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

.profile__pref-groups {
  display: flex;
  flex-direction: column;
  gap: 1.35rem;
}

.profile__pref-group {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.profile__pref-group-head {
  h3 {
    margin: 0;
    font-size: 0.78rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--app-text-muted);
  }

  p {
    margin: 0.3rem 0 0;
    font-size: 0.82rem;
    color: var(--app-text-muted);
    line-height: 1.4;
  }
}

.profile__pref-card {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  padding: 0.95rem 1rem;
  border-radius: 10px;
  background: var(--app-surface-inset);
  border: 1px solid var(--app-border);

  &--inline {
    flex-direction: row;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.85rem 1rem;
  }

  &--stack {
    gap: 0.75rem;
  }
}

.profile__pref-card-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.profile__pref-card-copy {
  min-width: 0;
  flex: 1;

  h4 {
    margin: 0;
    font-size: 0.95rem;
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

.profile__pref-card-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.55rem 0.65rem;
  padding-top: 0.15rem;
  border-top: 1px solid var(--app-border);
}

.profile__field-label {
  font-size: 0.8rem;
  color: var(--app-text-muted);
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
