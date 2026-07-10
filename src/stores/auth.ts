import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Profile } from '@/types/auth'
import {
  getCurrentProfile,
  onAuthStateChange,
  signIn,
  signOut,
  signUp,
} from '@/services/authService'
import { isSupabaseConfigured } from '@/services/supabaseClient'

export const useAuthStore = defineStore('auth', () => {
  const profile = ref<Profile | null>(null)
  const loading = ref(true)
  const error = ref<string | null>(null)
  const info = ref<string | null>(null)

  const isAuthenticated = computed(() => Boolean(profile.value))
  const isOrganizer = computed(() => profile.value?.role === 'organizer')

  async function loadProfile(): Promise<void> {
    if (!isSupabaseConfigured) {
      loading.value = false
      return
    }
    try {
      profile.value = await getCurrentProfile()
      error.value = null
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Error de autenticación'
    } finally {
      loading.value = false
    }
  }

  async function login(email: string, password: string): Promise<void> {
    error.value = null
    info.value = null
    try {
      await signIn(email, password)
      profile.value = await getCurrentProfile()
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Error al iniciar sesión'
      throw err
    }
  }

  async function register(
    email: string,
    password: string,
    displayName: string,
    asOrganizer = false,
  ): Promise<boolean> {
    error.value = null
    info.value = null
    try {
      const result = await signUp(
        email,
        password,
        displayName,
        asOrganizer ? 'organizer' : 'spectator',
      )

      if (result.needsEmailConfirmation) {
        info.value =
          'Cuenta creada. Revisa tu email y confirma el enlace antes de iniciar sesión.'
        return false
      }

      profile.value = await getCurrentProfile()
      return true
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Error al registrarse'
      throw err
    }
  }

  async function logout(): Promise<void> {
    await signOut()
    profile.value = null
    info.value = null
  }

  function init(): () => void {
    void loadProfile()
    if (!isSupabaseConfigured) return () => undefined
    return onAuthStateChange((authenticated) => {
      if (authenticated) {
        void loadProfile()
      } else {
        profile.value = null
        loading.value = false
      }
    })
  }

  return {
    profile,
    loading,
    error,
    info,
    isAuthenticated,
    isOrganizer,
    loadProfile,
    login,
    register,
    logout,
    init,
  }
})
