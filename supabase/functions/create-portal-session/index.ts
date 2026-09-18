import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
    const siteUrl = Deno.env.get('SITE_URL') ?? 'http://localhost:5173'
    if (!stripeKey) {
      return json({ error: 'Stripe no está configurado en el servidor.' }, 501)
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'No autenticado.' }, 401)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    )
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return json({ error: 'No autenticado.' }, 401)

    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )
    const { data: entitlement } = await admin
      .from('entitlements')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!entitlement?.stripe_customer_id) {
      return json({ error: 'No hay un cliente de Stripe asociado a esta cuenta.' }, 400)
    }

    const body = new URLSearchParams({
      customer: entitlement.stripe_customer_id,
      return_url: `${siteUrl}/app/planes`,
    })
    const stripeRes = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${stripeKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    })
    const session = await stripeRes.json()
    if (!stripeRes.ok) {
      return json({ error: session.error?.message ?? 'No se pudo abrir el portal.' }, 400)
    }
    return json({ url: session.url })
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : 'Error del portal.' },
      500,
    )
  }
})

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
