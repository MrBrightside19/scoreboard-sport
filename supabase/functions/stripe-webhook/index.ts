import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const encoder = new TextEncoder()

async function verifyStripeSignature(
  payload: string,
  header: string,
  secret: string,
): Promise<boolean> {
  const parts = Object.fromEntries(
    header.split(',').map((item) => {
      const [key, ...rest] = item.split('=')
      return [key, rest.join('=')]
    }),
  )
  const timestamp = parts.t
  const signature = parts.v1
  if (!timestamp || !signature) return false

  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signed = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(`${timestamp}.${payload}`),
  )
  const digest = Array.from(new Uint8Array(signed))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
  return digest === signature
}

function periodEnd(event: Record<string, unknown>): string | null {
  const obj = (event.data as { object?: Record<string, unknown> } | undefined)?.object
  const raw =
    (obj?.current_period_end as number | undefined) ??
    (obj?.expires_at as number | undefined) ??
    null
  if (!raw) {
    if (event.type === 'checkout.session.completed') {
      const meta = obj?.metadata as { plan?: string } | undefined
      if (meta?.plan === 'event') {
        return new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString()
      }
    }
    return null
  }
  return new Date(raw * 1000).toISOString()
}

Deno.serve(async (req) => {
  const secret = Deno.env.get('STRIPE_WEBHOOK_SECRET')
  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
  if (!secret || !stripeKey) {
    return new Response('Stripe webhook no configurado', { status: 501 })
  }

  const payload = await req.text()
  const header = req.headers.get('stripe-signature') ?? ''
  const valid = await verifyStripeSignature(payload, header, secret)
  if (!valid) {
    return new Response('Firma inválida', { status: 400 })
  }

  const event = JSON.parse(payload) as {
    type: string
    data: { object: Record<string, unknown> }
  }
  const object = event.data.object
  const metadata = (object.metadata ?? {}) as { user_id?: string; plan?: string }
  let userId = metadata.user_id ?? (object.client_reference_id as string | undefined)
  const customerId = (object.customer as string | undefined) ?? null
  const subscriptionId =
    (object.subscription as string | undefined) ??
    (object.id as string | undefined) ??
    null

  const admin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )

  if (!userId && customerId) {
    const { data } = await admin
      .from('entitlements')
      .select('user_id')
      .eq('stripe_customer_id', customerId)
      .maybeSingle()
    userId = data?.user_id
  }

  if (!userId) {
    return new Response('ok', { status: 200 })
  }

  const plan = metadata.plan === 'event' ? 'event' : 'pro'
  const ended =
    event.type === 'customer.subscription.deleted' ||
    event.type === 'invoice.payment_failed'

  await admin.from('entitlements').upsert({
    user_id: userId,
    plan: ended ? 'free' : plan,
    status: ended ? 'canceled' : 'active',
    current_period_end: ended ? null : periodEnd(event),
    stripe_customer_id: customerId,
    stripe_subscription_id: subscriptionId,
    updated_at: new Date().toISOString(),
  })

  return new Response('ok', { status: 200 })
})
