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
    const proPrice = Deno.env.get('STRIPE_PRICE_PRO')
    const eventPrice = Deno.env.get('STRIPE_PRICE_EVENT')
    const siteUrl = Deno.env.get('SITE_URL') ?? 'http://localhost:5173'

    if (!stripeKey || !proPrice || !eventPrice) {
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

    const { plan } = (await req.json()) as { plan?: string }
    if (plan !== 'pro' && plan !== 'event') {
      return json({ error: 'Plan inválido.' }, 400)
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )
    const { data: entitlement } = await admin
      .from('entitlements')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .maybeSingle()

    const price = plan === 'pro' ? proPrice : eventPrice
    const mode = plan === 'pro' ? 'subscription' : 'payment'
    const body = new URLSearchParams({
      mode,
      success_url: `${siteUrl}/app/planes?ok=1`,
      cancel_url: `${siteUrl}/app/planes?canceled=1`,
      'line_items[0][price]': price,
      'line_items[0][quantity]': '1',
      client_reference_id: user.id,
      'metadata[user_id]': user.id,
      'metadata[plan]': plan,
    })
    if (entitlement?.stripe_customer_id) {
      body.set('customer', entitlement.stripe_customer_id)
    } else if (user.email) {
      body.set('customer_email', user.email)
    }

    const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${stripeKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    })
    const session = await stripeRes.json()
    if (!stripeRes.ok) {
      return json({ error: session.error?.message ?? 'Stripe rechazó el checkout.' }, 400)
    }
    return json({ url: session.url })
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : 'Error de checkout.' },
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
