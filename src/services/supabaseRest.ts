import { getSupabaseClient, isSupabaseConfigured } from './supabaseClient'

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE'

interface RestOptions {
  method?: HttpMethod
  body?: unknown
  prefer?: string
}

export async function supabaseRest<T>(
  path: string,
  options: RestOptions = {},
): Promise<T> {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase no configurado')
  }

  const supabase = getSupabaseClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  const headers: Record<string, string> = {
    apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
    'Content-Type': 'application/json',
  }

  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`
  }

  if (options.prefer) {
    headers.Prefer = options.prefer
  }

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/${path}`,
    {
      method: options.method ?? 'GET',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    },
  )

  if (!response.ok) {
    const errorText = await response.text()
    let message = errorText || `Error REST ${response.status}`
    try {
      const parsed = JSON.parse(errorText) as { message?: string; code?: string }
      if (parsed.message) message = parsed.message
      if (parsed.code === '42501' || message.includes('row-level security')) {
        message = 'Permiso denegado. Inicia sesión como organizador o asistente del torneo.'
      }
    } catch {
      // mantener message original
    }
    throw new Error(message)
  }

  if (response.status === 204) {
    return [] as T
  }

  const text = await response.text()
  if (!text.trim()) {
    return [] as T
  }

  return JSON.parse(text) as T
}
