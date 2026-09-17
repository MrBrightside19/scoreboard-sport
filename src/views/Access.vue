<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AuthModal from '@/components/AuthModal.vue'

const route = useRoute()
const router = useRouter()
const initialMode = computed(() =>
  route.query.mode === 'register' ? 'register' : 'login',
)

const heading = computed(() =>
  route.query.reason === 'staff'
    ? 'Acceso de mesa'
    : 'Entra a ScoreDesk',
)

const hint = computed(() => {
  if (route.query.reason === 'staff') {
    return 'Necesitas una cuenta para operar la mesa o administrar un torneo. Ver el live sigue siendo gratis.'
  }
  return 'Crea una cuenta gratis para organizar partidos. Los espectadores no necesitan registrarse.'
})

function onSuccess(): void {
  const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : ''
  if (redirect.startsWith('/') && !redirect.startsWith('//')) {
    void router.replace(redirect)
    return
  }
  void router.replace({ name: 'app-home' })
}
</script>

<template>
  <div class="access">
    <section class="access__card">
      <p class="access__eyebrow">Cuenta</p>
      <h1>{{ heading }}</h1>
      <p class="access__hint">{{ hint }}</p>
      <AuthModal :initial-mode="initialMode" @success="onSuccess" />
    </section>
  </div>
</template>

<style scoped lang="scss">
.access {
  max-width: 460px;
  margin: 0 auto;
  padding: 2.5rem 1.5rem 3rem;
}

.access__card {
  padding: 1.5rem 1.35rem 1.6rem;
  border-radius: 16px;
  border: 1px solid var(--app-border);
  background: var(--app-bg-elevated);
}

.access__eyebrow {
  margin: 0 0 0.35rem;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--app-link);
}

.access h1 {
  margin: 0 0 0.45rem;
  font-size: 1.55rem;
}

.access__hint {
  margin: 0 0 1.15rem;
  color: var(--app-text-muted);
  line-height: 1.45;
}
</style>
