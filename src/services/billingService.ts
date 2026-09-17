import { getSupabaseClient, isSupabaseConfigured } from './supabaseClient'

export function isStripeConfigured(): boolean {
  return Boolean(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY)
}

export async function startCheckout(plan: 'pro' | 'event'): Promise<void> {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase no está configurado.')
  }

  const supabase = getSupabaseClient()
  const { data, error } = await supabase.functions.invoke<{ url?: string; error?: string }>(
    'create-checkout-session',
    { body: { plan } },
  )

  if (error) {
    throw new Error(error.message || 'No se pudo iniciar el pago.')
  }
  if (data?.error) {
    throw new Error(data.error)
  }
  if (!data?.url) {
    throw new Error(
      'Stripe no está configurado en el servidor. Define las claves en las Edge Functions.',
    )
  }

  window.location.assign(data.url)
}

export async function openCustomerPortal(): Promise<void> {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase no está configurado.')
  }

  const supabase = getSupabaseClient()
  const { data, error } = await supabase.functions.invoke<{ url?: string; error?: string }>(
    'create-portal-session',
    { body: {} },
  )

  if (error) {
    throw new Error(error.message || 'No se pudo abrir el portal de facturación.')
  }
  if (data?.error) {
    throw new Error(data.error)
  }
  if (!data?.url) {
    throw new Error('No hay un cliente de Stripe asociado a esta cuenta.')
  }

  window.location.assign(data.url)
}
