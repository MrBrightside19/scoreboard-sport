<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import { useAuthStore } from '@/stores/auth'
import {
  getSharedTvScoreboardStyle,
  getTvScoreboardStyle,
  getUserPreferences,
  isUsingSportSpecificTvStyle,
  clearSportTvStyleOverride,
  setSharedTvScoreboardStyle,
  setTvScoreboardStyle,
  setUserPreferences,
  type AppTheme,
  type UserPreferences,
  MIN_COUNTDOWN_BEEP_SECONDS,
  MAX_COUNTDOWN_BEEP_SECONDS,
  MIN_LATE_GAME_WARNING_MINUTES,
  MAX_LATE_GAME_WARNING_MINUTES,
} from '@/utils/userPreferences'
import { listAvailableSports } from '@/sports/registry'
import { DEFAULT_SPORT, type SportId } from '@/types/sport'
import { playLateGameWarning } from '@/utils/lateGameWarningBeep'
import { playCountdownBeep } from '@/utils/countdownBeep'
import type {
  OverlayScoreboardStyle,
  TvScoreboardStyle,
} from '@/config/scoreboardStyles'
import {
  isSharedTvStyle,
  sportSpecificTvStyles,
} from '@/config/scoreboardStyles'
import ScoreboardStylePicker from '@/components/ScoreboardStylePicker.vue'
import { fetchEntitlement, resolvePlan } from '@/services/entitlementsService'
import { getPlanDefinition } from '@/config/plans'
import type { Entitlement } from '@/types/billing'
import { clearMatchIdFromStorage } from '@/utils/localSync'
import { isSupabaseConfigured } from '@/services/supabaseClient'
import { isMobileMesaViewport } from '@/utils/mobileMesa'

type ProfileSection = 'cuenta' | 'mesa' | 'marcadores' | 'sesion'
type BoardView = 'tv' | 'sport' | 'overlay'

const PROFILE_SECTIONS: { id: ProfileSection; label: string; hint: string }[] = [
  { id: 'cuenta', label: 'Cuenta', hint: 'Nombre y acceso' },
  { id: 'mesa', label: 'Mesa', hint: 'Sonidos y tema' },
  { id: 'marcadores', label: 'Marcadores', hint: 'TV y overlay' },
  { id: 'sesion', label: 'Sesión', hint: 'Salir o eliminar' },
]

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

const savingProfile = ref(false)
const savingPassword = ref(false)
const loggingOut = ref(false)
const deletingAccount = ref(false)
const showDeleteModal = ref(false)
const deletePassword = ref('')
const profileError = ref<string | null>(null)
const passwordError = ref<string | null>(null)
const deleteError = ref<string | null>(null)

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
const previewSport = ref<SportId>(DEFAULT_SPORT)
const boardView = ref<BoardView>('tv')
const passwordOpen = ref(false)
const sports = listAvailableSports()
const sharedTvStyle = computed(() => getSharedTvScoreboardStyle())
const currentTvStyle = computed(() => getTvScoreboardStyle(previewSport.value))
const designSportHasSpecific = computed(
  () => sportSpecificTvStyles(previewSport.value).length > 0,
)
const designSportUsesSpecific = computed(() =>
  isUsingSportSpecificTvStyle(previewSport.value),
)
const previewSportLabel = computed(
  () => sports.find((item) => item.id === previewSport.value)?.label ?? '',
)

function isProfileSection(value: unknown): value is ProfileSection {
  return PROFILE_SECTIONS.some((item) => item.id === value)
}

const section = computed<ProfileSection>({
  get() {
    return isProfileSection(route.query.seccion) ? route.query.seccion : 'cuenta'
  },
  set(next) {
    void router.replace({ query: { ...route.query, seccion: next } })
  },
})

const initials = computed(() => {
  const name = form.displayName.trim()
  if (name) {
    const parts = name.split(/\s+/).filter(Boolean)
    if (parts.length >= 2) {
      return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase()
    }
    return name.slice(0, 2).toUpperCase()
  }
  const email = auth.profile?.email ?? '?'
  return email.slice(0, 2).toUpperCase()
})

const entitlement = ref<Entitlement | null>(null)
const currentPlan = computed(() => getPlanDefinition(resolvePlan(entitlement.value)))
const showMesaBack = ref(false)

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
  return 'Puedes ver torneos públicos y marcadores en vivo. Entra a la app para organizar con el plan Free.'
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
  showMesaBack.value = isMobileMesaViewport()
  if (!auth.loading && !auth.isAuthenticated) {
    void router.replace({ name: 'access', query: { redirect: '/perfil' } })
  }
  if (auth.profile) {
    void fetchEntitlement(auth.profile.id).then((row) => {
      entitlement.value = row
    })
  }
})

watch(
  () => auth.loading,
  (loading) => {
    if (!loading && !auth.isAuthenticated) {
      void router.replace({ name: 'access', query: { redirect: '/perfil' } })
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
    passwordOpen.value = false
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

function onSharedTvStyleChange(style: TvScoreboardStyle | OverlayScoreboardStyle): void {
  const next = style as TvScoreboardStyle
  if (!isSharedTvStyle(next) || sharedTvStyle.value === next) return
  const updated = setSharedTvScoreboardStyle(next)
  Object.assign(prefs, updated)
  message.success('Tema TV aplicado a todos los deportes')
}

function onSportTvStyleChange(style: TvScoreboardStyle | OverlayScoreboardStyle): void {
  const next = style as TvScoreboardStyle
  if (isSharedTvStyle(next) || currentTvStyle.value === next) return
  const updated = setTvScoreboardStyle(previewSport.value, next)
  Object.assign(prefs, updated)
  message.success('Diseño exclusivo de marcador actualizado')
}

function useSharedThemeForSport(): void {
  if (!designSportUsesSpecific.value) return
  const updated = clearSportTvStyleOverride(previewSport.value)
  Object.assign(prefs, updated)
  message.success('Marcador vuelve al tema compartido')
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
    await router.push({ name: 'landing' })
  } finally {
    loggingOut.value = false
  }
}

function openDeleteAccount(): void {
  deletePassword.value = ''
  deleteError.value = null
  showDeleteModal.value = true
}

async function confirmDeleteAccount(): Promise<void> {
  if (deletingAccount.value || !deletePassword.value) return
  deletingAccount.value = true
  deleteError.value = null
  try {
    await auth.deleteAccount(deletePassword.value)
    clearMatchIdFromStorage()
    showDeleteModal.value = false
    message.success('Cuenta eliminada')
    await router.replace({ name: 'landing' })
  } catch (err) {
    deleteError.value =
      err instanceof Error ? err.message : 'No se pudo eliminar la cuenta'
    throw err
  } finally {
    deletingAccount.value = false
  }
}

function togglePasswordForm(): void {
  passwordOpen.value = !passwordOpen.value
  if (passwordOpen.value) return
  passwordError.value = null
  passwordForm.current = ''
  passwordForm.next = ''
  passwordForm.confirm = ''
}
</script>

<template>
  <div class="profile">
    <a-spin :spinning="auth.loading">
      <header class="profile__header">
        <router-link
          v-if="showMesaBack"
          class="profile__back"
          :to="{ name: 'mobile-mesa' }"
        >
          Volver a la mesa
        </router-link>
        <p class="profile__eyebrow">Ajustes</p>
        <h1>Perfil</h1>
        <p>Cuenta, mesa y marcadores, en un solo lugar.</p>
      </header>

      <template v-if="auth.profile">
        <div class="profile__shell">
          <aside class="profile__rail">
            <div class="profile__id">
              <span class="profile__avatar" aria-hidden="true">{{ initials }}</span>
              <div class="profile__id-copy">
                <strong>{{ form.displayName.trim() || 'Sin nombre' }}</strong>
                <span>{{ auth.profile.email }}</span>
                <div class="profile__chips">
                  <span class="profile__chip">{{ roleLabel }}</span>
                  <RouterLink class="profile__chip profile__chip--plan" :to="{ name: 'plans' }">
                    Plan {{ currentPlan.name }}
                  </RouterLink>
                </div>
              </div>
            </div>

            <nav class="profile__nav" aria-label="Secciones del perfil">
              <button
                v-for="item in PROFILE_SECTIONS"
                :key="item.id"
                type="button"
                class="profile__nav-item"
                :class="{ 'profile__nav-item--active': section === item.id }"
                :aria-current="section === item.id ? 'page' : undefined"
                @click="section = item.id"
              >
                <strong>{{ item.label }}</strong>
                <span>{{ item.hint }}</span>
              </button>
            </nav>
          </aside>

          <div class="profile__stage">
            <section v-if="section === 'cuenta'" class="profile__pane" aria-labelledby="profile-account">
              <header class="profile__pane-head">
                <h2 id="profile-account">Cuenta</h2>
                <p>Datos visibles en la app. El email no se cambia desde aquí.</p>
              </header>

              <div class="profile__grid">
                <a-form layout="vertical" class="profile__card" @submit.prevent="saveProfile">
                  <h3>Identidad</h3>
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
                  <a-alert
                    v-if="profileError"
                    type="error"
                    :message="profileError"
                    show-icon
                    class="profile__alert"
                  />
                  <a-button
                    type="primary"
                    html-type="submit"
                    :loading="savingProfile"
                    :disabled="!displayNameDirty"
                  >
                    Guardar nombre
                  </a-button>
                </a-form>

                <div class="profile__card">
                  <h3>Rol y plan</h3>
                  <p class="profile__role-hint">{{ roleHint }}</p>
                  <div class="profile__chips">
                    <span class="profile__chip">{{ roleLabel }}</span>
                    <span class="profile__chip">{{ currentPlan.name }}</span>
                  </div>
                  <RouterLink class="profile__text-link" :to="{ name: 'plans' }">
                    Ver planes
                  </RouterLink>
                </div>
              </div>

              <div class="profile__card">
                <button
                  type="button"
                  class="profile__disclosure"
                  :aria-expanded="passwordOpen"
                  @click="togglePasswordForm"
                >
                  <span>
                    <strong>Contraseña</strong>
                    <em>Cámbiala con tu clave actual.</em>
                  </span>
                  <span class="profile__disclosure-mark">{{ passwordOpen ? 'Ocultar' : 'Cambiar' }}</span>
                </button>
                <a-form
                  v-if="passwordOpen"
                  layout="vertical"
                  class="profile__password"
                  @submit.prevent="savePassword"
                >
                  <div class="profile__password-grid">
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
                  </div>
                  <a-alert
                    v-if="passwordError"
                    type="error"
                    :message="passwordError"
                    show-icon
                    class="profile__alert"
                  />
                  <a-button
                    type="primary"
                    html-type="submit"
                    :loading="savingPassword"
                    :disabled="!canSubmitPassword"
                  >
                    Actualizar contraseña
                  </a-button>
                </a-form>
              </div>
            </section>

            <section v-else-if="section === 'mesa'" class="profile__pane" aria-labelledby="profile-mesa">
              <header class="profile__pane-head">
                <h2 id="profile-mesa">Mesa</h2>
                <p>Preferencias de este navegador. No se sincronizan entre dispositivos.</p>
              </header>

              <div class="profile__card profile__card--row">
                <div>
                  <h3>Tema de la interfaz</h3>
                  <p>TV y overlay OBS se mantienen oscuros.</p>
                </div>
                <div class="profile__segment" role="group" aria-label="Tema">
                  <button
                    type="button"
                    :class="{ 'profile__segment-btn--on': prefs.theme === 'dark' }"
                    class="profile__segment-btn"
                    @click="setTheme('dark')"
                  >
                    Oscuro
                  </button>
                  <button
                    type="button"
                    :class="{ 'profile__segment-btn--on': prefs.theme === 'light' }"
                    class="profile__segment-btn"
                    @click="setTheme('light')"
                  >
                    Claro
                  </button>
                </div>
              </div>

              <div class="profile__grid">
                <div class="profile__card">
                  <div class="profile__card-top">
                    <div>
                      <h3>Cuenta regresiva final</h3>
                      <p>
                        Beep en los últimos
                        {{ MIN_COUNTDOWN_BEEP_SECONDS }}–{{ MAX_COUNTDOWN_BEEP_SECONDS }} s.
                      </p>
                    </div>
                    <a-switch
                      :checked="prefs.countdownBeepEnabled"
                      aria-label="Activar beep de cuenta regresiva"
                      @update:checked="onBeepToggle"
                    />
                  </div>
                  <div class="profile__card-controls">
                    <label class="profile__field-label" for="profile-countdown-seconds">Inicia a los</label>
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
                    <a-button @click="previewCountdownBeep">Probar</a-button>
                  </div>
                </div>

                <div class="profile__card">
                  <div class="profile__card-top">
                    <div>
                      <h3>Últimos minutos</h3>
                      <p>
                        Aviso al entrar en los últimos
                        {{ MIN_LATE_GAME_WARNING_MINUTES }}–{{ MAX_LATE_GAME_WARNING_MINUTES }} min.
                      </p>
                    </div>
                    <a-switch
                      :checked="prefs.lateGameWarningEnabled"
                      aria-label="Activar aviso de últimos minutos"
                      @update:checked="onLateGameWarningToggle"
                    />
                  </div>
                  <div class="profile__card-controls">
                    <label class="profile__field-label" for="profile-late-game-minutes">Avisa a los</label>
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
                    <a-button @click="previewLateGameWarning">Probar</a-button>
                  </div>
                </div>
              </div>
            </section>

            <section v-else-if="section === 'marcadores'" class="profile__pane" aria-labelledby="profile-boards">
              <header class="profile__pane-head">
                <h2 id="profile-boards">Marcadores</h2>
                <p>Un tema compartido para todos. Los diseños exclusivos se eligen por deporte.</p>
              </header>

              <div class="profile__toolbar">
                <div class="profile__segment" role="tablist" aria-label="Vista previa del deporte">
                  <button
                    v-for="sport in sports"
                    :key="sport.id"
                    type="button"
                    role="tab"
                    class="profile__segment-btn"
                    :class="{ 'profile__segment-btn--on': previewSport === sport.id }"
                    :aria-selected="previewSport === sport.id"
                    @click="previewSport = sport.id"
                  >
                    {{ sport.shortLabel }}
                  </button>
                </div>
                <div class="profile__segment" role="tablist" aria-label="Tipo de marcador">
                  <button
                    type="button"
                    role="tab"
                    class="profile__segment-btn"
                    :class="{ 'profile__segment-btn--on': boardView === 'tv' }"
                    :aria-selected="boardView === 'tv'"
                    @click="boardView = 'tv'"
                  >
                    Tema TV
                  </button>
                  <button
                    type="button"
                    role="tab"
                    class="profile__segment-btn"
                    :class="{ 'profile__segment-btn--on': boardView === 'sport' }"
                    :aria-selected="boardView === 'sport'"
                    @click="boardView = 'sport'"
                  >
                    Por deporte
                  </button>
                  <button
                    type="button"
                    role="tab"
                    class="profile__segment-btn"
                    :class="{ 'profile__segment-btn--on': boardView === 'overlay' }"
                    :aria-selected="boardView === 'overlay'"
                    @click="boardView = 'overlay'"
                  >
                    Overlay
                  </button>
                </div>
              </div>

              <div v-if="boardView === 'tv'" class="profile__card">
                <h3>Tema TV</h3>
                <p>Clásico u claro para salas oscuras o iluminadas. Aplica a todos los deportes sin diseño exclusivo.</p>
                <ScoreboardStylePicker
                  mode="tv"
                  filter="shared"
                  :sport="previewSport"
                  :model-value="sharedTvStyle"
                  @update:model-value="onSharedTvStyleChange"
                />
              </div>

              <div v-else-if="boardView === 'sport'" class="profile__card">
                <div class="profile__card-top">
                  <div>
                    <h3>Diseño de {{ previewSportLabel }}</h3>
                    <p>Variantes con layout propio. Hoy hockey tiene Arena LED.</p>
                  </div>
                  <a-button
                    v-if="designSportHasSpecific"
                    :type="designSportUsesSpecific ? 'default' : 'primary'"
                    @click="useSharedThemeForSport"
                  >
                    {{ designSportUsesSpecific ? 'Usar tema compartido' : 'Tema compartido (activo)' }}
                  </a-button>
                </div>
                <ScoreboardStylePicker
                  v-if="designSportHasSpecific"
                  mode="tv"
                  filter="sport-specific"
                  :sport="previewSport"
                  :model-value="currentTvStyle"
                  @update:model-value="onSportTvStyleChange"
                />
                <p v-else class="profile__empty">
                  {{ previewSportLabel }} todavía no tiene un diseño exclusivo. Usa el tema TV.
                </p>
              </div>

              <div v-else class="profile__card">
                <h3>Overlay OBS</h3>
                <p>Barra transparente de transmisión, compartida entre deportes.</p>
                <ScoreboardStylePicker
                  mode="overlay"
                  :sport="previewSport"
                  :model-value="prefs.overlayScoreboardStyle"
                  @update:model-value="onOverlayStyleChange"
                />
              </div>
            </section>

            <section v-else class="profile__pane" aria-labelledby="profile-session">
              <header class="profile__pane-head">
                <h2 id="profile-session">Sesión</h2>
                <p>Acciones de este dispositivo y de la cuenta.</p>
              </header>

              <div class="profile__grid">
                <div class="profile__card">
                  <h3>Cerrar sesión</h3>
                  <p>Sales de ScoreDesk en este navegador. El marcador en vivo no se apaga.</p>
                  <a-button danger :loading="loggingOut" @click="handleLogout">
                    Cerrar sesión
                  </a-button>
                </div>
                <div v-if="isSupabaseConfigured" class="profile__card profile__card--danger">
                  <h3>Eliminar cuenta</h3>
                  <p>Borra usuario, partidos sueltos y torneos. No se puede deshacer.</p>
                  <a-button danger @click="openDeleteAccount">Eliminar cuenta</a-button>
                </div>
              </div>
            </section>
          </div>
        </div>

        <a-modal
          v-model:open="showDeleteModal"
          title="Eliminar cuenta"
          ok-text="Eliminar definitivamente"
          ok-type="danger"
          cancel-text="Cancelar"
          :confirm-loading="deletingAccount"
          :ok-button-props="{ disabled: !deletePassword }"
          destroy-on-close
          @ok="confirmDeleteAccount"
        >
          <p class="profile__delete-copy">
            Se eliminarán tu usuario, partidos y torneos. No podrás recuperarlos.
            Confirma con tu contraseña.
          </p>
          <a-input-password
            v-model:value="deletePassword"
            autocomplete="current-password"
            placeholder="Tu contraseña"
            @pressEnter="confirmDeleteAccount"
          />
          <a-alert
            v-if="deleteError"
            type="error"
            :message="deleteError"
            show-icon
            class="profile__alert profile__alert--modal"
          />
        </a-modal>
      </template>
    </a-spin>
  </div>
</template>

<style scoped lang="scss">
.profile {
  max-width: min(1120px, 100%);
  width: 100%;
  margin: 0 auto;
  padding: 1.5rem 1.5rem 3rem;
  box-sizing: border-box;

  :deep(.ant-spin-nested-loading),
  :deep(.ant-spin-container) {
    overflow: visible;
  }
}

.profile__header {
  margin-bottom: 1.25rem;

  h1 {
    margin: 0;
    font-family: 'Bebas Neue', sans-serif;
    font-size: clamp(2rem, 4vw, 2.6rem);
    letter-spacing: 0.04em;
    line-height: 1;
  }

  p {
    margin: 0.4rem 0 0;
    font-size: 0.92rem;
    color: var(--app-text-muted);
  }
}

.profile__eyebrow {
  margin: 0 0 0.3rem !important;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--app-link);
}

.profile__back {
  display: inline-block;
  margin: 0 0 0.65rem;
  font-size: 0.88rem;
  font-weight: 600;
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
}

.profile__shell {
  display: grid;
  grid-template-columns: minmax(220px, 260px) minmax(0, 1fr);
  gap: 1.25rem;
  align-items: start;
}

.profile__rail {
  position: sticky;
  top: 5.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.profile__id {
  display: flex;
  gap: 0.75rem;
  padding: 0.95rem 1rem;
  border-radius: 16px;
  border: 1px solid var(--app-border);
  background:
    linear-gradient(
      155deg,
      color-mix(in srgb, var(--app-primary) 16%, transparent),
      transparent 55%
    ),
    var(--app-surface);
}

.profile__avatar {
  flex-shrink: 0;
  width: 2.7rem;
  height: 2.7rem;
  border-radius: 12px;
  display: grid;
  place-items: center;
  font-size: 0.82rem;
  font-weight: 800;
  letter-spacing: 0.04em;
  color: var(--app-bg);
  background: var(--app-link);
}

.profile__id-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;

  strong {
    font-size: 0.95rem;
    line-height: 1.2;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  > span {
    font-size: 0.78rem;
    color: var(--app-text-muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.profile__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin-top: 0.35rem;
}

.profile__chip {
  display: inline-flex;
  align-items: center;
  padding: 0.12rem 0.5rem;
  border-radius: 999px;
  border: 1px solid var(--app-border);
  background: var(--app-bg-elevated);
  color: var(--app-text-soft);
  font-size: 0.72rem;
  font-weight: 650;
  text-decoration: none;
}

.profile__chip--plan {
  border-color: color-mix(in srgb, var(--app-primary) 40%, transparent);
  background: color-mix(in srgb, var(--app-primary) 12%, transparent);
  color: var(--app-link);
}

.profile__nav {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  padding: 0.4rem;
  border-radius: 16px;
  border: 1px solid var(--app-border);
  background: var(--app-surface);
}

.profile__nav-item {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.1rem;
  width: 100%;
  padding: 0.7rem 0.8rem;
  border: 0;
  border-radius: 12px;
  background: transparent;
  color: var(--app-text);
  text-align: left;
  cursor: pointer;

  strong {
    font-size: 0.92rem;
  }

  span {
    font-size: 0.75rem;
    color: var(--app-text-muted);
  }

  &:hover {
    background: var(--app-surface-strong);
  }

  &--active {
    background: color-mix(in srgb, var(--app-link) 12%, transparent);
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--app-link) 35%, transparent);

    span {
      color: var(--app-text-soft);
    }
  }
}

.profile__pane {
  min-width: 0;
}

.profile__pane-head {
  margin-bottom: 1rem;

  h2 {
    margin: 0;
    font-size: 1.2rem;
  }

  p {
    margin: 0.3rem 0 0;
    font-size: 0.88rem;
    color: var(--app-text-muted);
    line-height: 1.45;
  }
}

.profile__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.85rem;
}

.profile__card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 1rem 1.05rem;
  border-radius: 16px;
  border: 1px solid var(--app-border);
  background: var(--app-surface);
  color: var(--app-text);

  h3 {
    margin: 0;
    font-size: 0.98rem;
  }

  > p {
    margin: 0;
    font-size: 0.82rem;
    color: var(--app-text-muted);
    line-height: 1.45;
  }

  :deep(.ant-form-item) {
    margin-bottom: 0.85rem;
  }

  :deep(.style-picker) {
    width: 100%;
  }

  &--row {
    flex-direction: row;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.85rem 1rem;
  }

  &--danger {
    border-color: var(--app-danger-border);
  }
}

.profile__card-top {
  display: flex;
  width: 100%;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.85rem;
}

.profile__card-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem 0.65rem;
  width: 100%;
  padding-top: 0.7rem;
  border-top: 1px solid var(--app-border);
}

.profile__toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.55rem;
  margin-bottom: 0.85rem;
}

.profile__segment {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 0.2rem;
  padding: 0.22rem;
  border-radius: 12px;
  border: 1px solid var(--app-border);
  background: var(--app-surface-inset);
}

.profile__segment-btn {
  border: 0;
  border-radius: 9px;
  padding: 0.42rem 0.7rem;
  background: transparent;
  color: var(--app-text-muted);
  font-size: 0.82rem;
  font-weight: 650;
  cursor: pointer;

  &:hover {
    color: var(--app-text);
  }

  &--on {
    background: var(--app-bg-elevated);
    color: var(--app-text);
    box-shadow: 0 1px 0 color-mix(in srgb, var(--app-border) 80%, transparent);
  }
}

.profile__disclosure {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;

  span {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.15rem;
  }

  em {
    font-style: normal;
    font-size: 0.8rem;
    color: var(--app-text-muted);
  }
}

.profile__disclosure-mark {
  flex-shrink: 0;
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--app-link);
}

.profile__password {
  width: 100%;
  padding-top: 0.35rem;
  border-top: 1px solid var(--app-border);
}

.profile__password-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0 0.75rem;
}

.profile__role-hint {
  margin: 0;
  font-size: 0.82rem;
  color: var(--app-text-muted);
  line-height: 1.45;
}

.profile__text-link {
  font-size: 0.86rem;
  font-weight: 650;
  color: var(--app-link);
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
}

.profile__alert {
  width: 100%;
  margin-bottom: 0.35rem;
}

.profile__alert--modal {
  margin-top: 0.85rem;
  margin-bottom: 0;
}

.profile__delete-copy {
  margin: 0 0 0.85rem;
  color: var(--app-text-muted);
  line-height: 1.45;
}

.profile__field-label {
  font-size: 0.8rem;
  color: var(--app-text-muted);
}

.profile__seconds-input {
  width: 8.5rem;
}

.profile__empty {
  margin: 0;
  font-size: 0.88rem;
  line-height: 1.45;
  color: var(--app-text-muted);
}

@media (max-width: 900px) {
  .profile {
    padding: 1.1rem 1rem 2.5rem;
  }

  .profile__shell {
    grid-template-columns: 1fr;
    gap: 1rem;
  }

  .profile__rail {
    position: static;
  }

  .profile__nav {
    flex-direction: row;
    flex-wrap: nowrap;
    align-items: center;
    gap: 0.2rem;
    overflow-x: auto;
    overflow-y: hidden;
    padding: 0.2rem;
    -webkit-overflow-scrolling: touch;
    overscroll-behavior-x: contain;
    scrollbar-width: none;

    &::-webkit-scrollbar {
      display: none;
    }
  }

  .profile__nav-item {
    flex: 0 0 auto;
    width: auto;
    min-width: 0;
    padding: 0.36rem 0.58rem;
    align-items: center;
    border-radius: 9px;

    strong {
      font-size: 0.76rem;
      font-weight: 650;
      line-height: 1.15;
      white-space: nowrap;
    }

    span {
      display: none;
    }
  }

  .profile__grid,
  .profile__password-grid {
    grid-template-columns: 1fr;
  }

  .profile__card-top {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
