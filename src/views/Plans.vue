<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { message } from 'ant-design-vue'
import { PLANS } from '@/config/plans'
import { useAuthStore } from '@/stores/auth'
import { fetchEntitlement, resolvePlan } from '@/services/entitlementsService'
import { isStripeConfigured, openCustomerPortal, startCheckout } from '@/services/billingService'
import { isSupabaseConfigured } from '@/services/supabaseClient'
import type { Entitlement } from '@/types/billing'
import type { PlanId } from '@/types/billing'

const auth = useAuthStore()
const route = useRoute()
const entitlement = ref<Entitlement | null>(null)
const loadingPlan = ref<PlanId | null>(null)
const portalLoading = ref(false)

const currentPlan = computed(() => resolvePlan(entitlement.value))
const stripeReady = computed(() => isStripeConfigured() && isSupabaseConfigured)

async function load(): Promise<void> {
  if (!auth.profile || !isSupabaseConfigured) return
  entitlement.value = await fetchEntitlement(auth.profile.id)
}

async function choose(plan: PlanId): Promise<void> {
  if (plan === 'free') return
  if (!auth.isAuthenticated) return
  if (!stripeReady.value) {
    message.info('El cobro se activa cuando Stripe esté configurado en el servidor.')
    return
  }
  loadingPlan.value = plan
  try {
    await startCheckout(plan)
  } catch (err) {
    message.error(err instanceof Error ? err.message : 'No se pudo iniciar el pago.')
  } finally {
    loadingPlan.value = null
  }
}

async function manageBilling(): Promise<void> {
  portalLoading.value = true
  try {
    await openCustomerPortal()
  } catch (err) {
    message.error(err instanceof Error ? err.message : 'No se pudo abrir el portal.')
  } finally {
    portalLoading.value = false
  }
}

onMounted(() => {
  void load()
  const wanted = route.query.plan
  if (wanted === 'pro' || wanted === 'event') {
    void choose(wanted)
  }
})
</script>

<template>
  <div class="plans">
    <header class="plans__header">
      <div>
        <h1>Planes</h1>
        <p>
          Plan actual: <strong>{{ currentPlan }}</strong>.
          Ver el live es gratis. Aquí solo se paga operar.
        </p>
      </div>
      <a-button
        v-if="entitlement?.stripe_customer_id"
        :loading="portalLoading"
        @click="manageBilling"
      >
        Portal de facturación
      </a-button>
    </header>

    <a-alert
      v-if="!stripeReady"
      type="info"
      show-icon
      style="margin-bottom: 1rem"
      message="Stripe pendiente"
      description="La UI de planes ya está lista. Configura las Edge Functions y VITE_STRIPE_PUBLISHABLE_KEY para cobrar de verdad."
    />

    <div class="plans__grid">
      <article
        v-for="plan in PLANS"
        :key="plan.id"
        class="plans__card"
        :class="{ 'plans__card--current': plan.id === currentPlan }"
      >
        <p class="plans__price">{{ plan.priceLabel }}</p>
        <h2>{{ plan.name }}</h2>
        <p>{{ plan.tagline }}</p>
        <ul>
          <li v-for="feature in plan.features" :key="feature">{{ feature }}</li>
        </ul>
        <a-button
          v-if="plan.id !== 'free'"
          type="primary"
          block
          :loading="loadingPlan === plan.id"
          :disabled="plan.id === currentPlan"
          @click="choose(plan.id)"
        >
          {{ plan.id === currentPlan ? 'Plan actual' : `Elegir ${plan.name}` }}
        </a-button>
        <p v-else class="plans__free">Incluido al crear la cuenta</p>
      </article>
    </div>
  </div>
</template>

<style scoped lang="scss">
.plans {
  max-width: 960px;
  margin: 0 auto;
  padding: 1.75rem 1.5rem 3rem;
}

.plans__header {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.25rem;

  h1 {
    margin: 0 0 0.35rem;
  }

  p {
    margin: 0;
    color: var(--app-text-muted);
  }
}

.plans__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 0.85rem;
}

.plans__card {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  padding: 1.15rem 1.2rem;
  border-radius: 14px;
  border: 1px solid var(--app-border);
  background: var(--app-bg-elevated);

  h2 {
    margin: 0;
  }

  p {
    margin: 0;
    color: var(--app-text-muted);
  }

  ul {
    margin: 0.4rem 0 1rem;
    padding-left: 1.1rem;
    color: var(--app-text-soft);
    line-height: 1.5;
  }
}

.plans__card--current {
  border-color: color-mix(in srgb, var(--app-primary) 45%, transparent);
}

.plans__price {
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--app-link) !important;
}

.plans__free {
  margin-top: auto !important;
  font-size: 0.82rem;
}
</style>
