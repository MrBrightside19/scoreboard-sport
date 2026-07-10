import type { Profile, UserRole } from '@/types/auth'
import type { AuthError, Session, User } from '@supabase/supabase-js'
import { getSupabaseClient } from './supabaseClient'
import { supabaseRest } from './supabaseRest'

export interface SignUpResult {
  user: User | null
  session: Session | null
  needsEmailConfirmation: boolean
}

function toAuthMessage(error: AuthError): string {
  const code = error.message?.toLowerCase() ?? ''
  if (
    error.code === 'over_email_send_rate_limit' ||
    code.includes('over_email_send_rate_limit')
  ) {
    return 'Supabase limitó el envío de emails (demasiados intentos). Espera unos minutos o desactiva "Confirm email" en Authentication → Email.'
  }
  if (code.includes('email not confirmed') || error.code === 'email_not_confirmed') {
    return 'Debes confirmar tu email antes de iniciar sesión. Revisa tu bandeja de entrada.'
  }
  if (code.includes('invalid login credentials') || error.code === 'invalid_credentials') {
    return 'Email o contraseña incorrectos.'
  }
  if (code.includes('already registered') || error.code === 'user_already_exists') {
    return 'Ya existe una cuenta con ese email.'
  }
  return error.message
}

export async function signUp(
  email: string,
  password: string,
  displayName: string,
  role: UserRole = 'spectator',
): Promise<SignUpResult> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        display_name: displayName,
        role,
      },
    },
  })
  if (error) throw new Error(toAuthMessage(error))

  return {
    user: data.user,
    session: data.session,
    needsEmailConfirmation: Boolean(data.user && !data.session),
  }
}

export async function signIn(email: string, password: string): Promise<Session> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw new Error(toAuthMessage(error))
  if (!data.session) throw new Error('No se pudo iniciar sesión.')
  return data.session
}

export async function signOut(): Promise<void> {
  const supabase = getSupabaseClient()
  const { error } = await supabase.auth.signOut()
  if (error) throw new Error(error.message)
}

export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = getSupabaseClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session?.user) return null

  const rows = await supabaseRest<Profile[]>(
    `profiles?id=eq.${session.user.id}&select=*`,
  )
  return rows[0] ?? null
}

export async function updateProfileRole(role: UserRole): Promise<Profile> {
  const supabase = getSupabaseClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session?.user) throw new Error('No autenticado')

  const rows = await supabaseRest<Profile[]>(
    `profiles?id=eq.${session.user.id}`,
    {
      method: 'PATCH',
      body: { role },
      prefer: 'return=representation',
    },
  )
  return rows[0]
}

export function onAuthStateChange(
  callback: (isAuthenticated: boolean) => void,
): () => void {
  const supabase = getSupabaseClient()
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(Boolean(session))
  })
  return () => subscription.unsubscribe()
}
