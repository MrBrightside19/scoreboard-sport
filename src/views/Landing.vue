<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { PLANS } from '@/config/plans'
import { listSportModules } from '@/sports/registry'
import { APP_VERSION } from '@/config/version'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const sports = listSportModules()
</script>

<template>
  <div class="landing">
    <section class="landing__hero">
      <p class="landing__eyebrow">Marcador deportivo en vivo</p>
      <h1>ScoreDesk</h1>
      <p class="landing__lead">
        Opera la mesa de control, proyecta en TV y comparte enlaces públicos.
        El público ve el partido gratis. Tú pagas solo si organizas.
      </p>
      <div class="landing__cta">
        <RouterLink
          :to="auth.isAuthenticated ? { name: 'app-home' } : { name: 'access', query: { mode: 'register' } }"
          class="landing__btn landing__btn--primary"
        >
          {{ auth.isAuthenticated ? 'Ir a la app' : 'Empezar gratis' }}
        </RouterLink>
        <RouterLink :to="{ name: 'live-now' }" class="landing__btn">
          Ver en vivo
        </RouterLink>
      </div>
    </section>

    <section id="caracteristicas" class="landing__section">
      <header class="landing__section-head">
        <p class="landing__eyebrow">Capacidades</p>
        <h2>Todo lo que necesita una mesa</h2>
      </header>
      <div class="landing__grid">
        <article class="landing__card">
          <h3>Mesa de control</h3>
          <p>Reloj, periodos, goles, nómina y oficiales. Pensada para operar en cancha.</p>
        </article>
        <article class="landing__card">
          <h3>TV y overlay OBS</h3>
          <p>Marcador para pantalla LED y Browser Source transparente. URL fija por cancha.</p>
        </article>
        <article class="landing__card">
          <h3>Torneos</h3>
          <p>Calendario, equipos, plantillas Excel, asistentes e informes consolidados.</p>
        </article>
        <article class="landing__card">
          <h3>Live público</h3>
          <p>Espectadores y streamers entran sin cuenta. Privado sigue funcionando con el link.</p>
        </article>
      </div>
    </section>

    <section id="deportes" class="landing__section">
      <header class="landing__section-head">
        <p class="landing__eyebrow">Deportes</p>
        <h2>Reglas distintas, misma app</h2>
      </header>
      <div class="landing__grid landing__grid--two">
        <article v-for="sport in sports" :key="sport.id" class="landing__card">
          <h3>{{ sport.label }}</h3>
          <p>{{ sport.description }}</p>
        </article>
      </div>
    </section>

    <section id="planes" class="landing__section">
      <header class="landing__section-head">
        <p class="landing__eyebrow">Planes</p>
        <h2>Prueba gratis. Escala cuando organices de verdad.</h2>
        <p>Ver el live es siempre gratis. Se cobra operar la mesa.</p>
      </header>
      <div class="landing__plans">
        <article
          v-for="plan in PLANS"
          :key="plan.id"
          class="landing__plan"
          :class="{ 'landing__plan--hot': plan.highlighted }"
        >
          <p class="landing__plan-price">{{ plan.priceLabel }}</p>
          <h3>{{ plan.name }}</h3>
          <p class="landing__plan-tag">{{ plan.tagline }}</p>
          <ul>
            <li v-for="feature in plan.features" :key="feature">{{ feature }}</li>
          </ul>
          <RouterLink
            v-if="plan.id === 'free'"
            :to="auth.isAuthenticated ? { name: 'app-home' } : { name: 'access', query: { mode: 'register' } }"
            class="landing__btn landing__btn--block"
          >
            Empezar
          </RouterLink>
          <RouterLink
            v-else
            :to="{ name: 'plans', query: { plan: plan.id } }"
            class="landing__btn landing__btn--block landing__btn--primary"
          >
            Elegir {{ plan.name }}
          </RouterLink>
        </article>
      </div>
    </section>

    <footer class="landing__footer">
      <span>ScoreDesk</span>
      <span aria-hidden="true">·</span>
      <span>v{{ APP_VERSION }}</span>
    </footer>
  </div>
</template>

<style scoped lang="scss">
.landing {
  max-width: 1100px;
  margin: 0 auto;
  padding: 2rem 1.5rem 3rem;
}

.landing__hero {
  padding: 3rem 2rem;
  border-radius: 20px;
  border: 1px solid var(--app-border);
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--app-primary) 16%, transparent), transparent 52%),
    var(--app-surface);
  margin-bottom: 3rem;
}

.landing__eyebrow {
  margin: 0 0 0.45rem;
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--app-link);
}

.landing__hero h1,
.landing__section-head h2 {
  margin: 0 0 0.75rem;
  font-family: 'Bebas Neue', sans-serif;
  font-weight: 400;
  letter-spacing: 0.04em;
}

.landing__hero h1 {
  font-size: clamp(2.8rem, 9vw, 4.6rem);
}

.landing__lead {
  margin: 0 0 1.5rem;
  max-width: 38rem;
  font-size: 1.08rem;
  line-height: 1.55;
  color: var(--app-text-muted);
}

.landing__cta,
.landing__grid,
.landing__plans {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.landing__btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 2.6rem;
  padding: 0.55rem 1.1rem;
  border-radius: 10px;
  border: 1px solid var(--app-border-strong);
  background: var(--app-surface);
  color: var(--app-text);
  text-decoration: none;
  font-weight: 600;

  &:hover {
    background: var(--app-surface-strong);
    color: var(--app-text);
  }

  &--primary {
    border-color: transparent;
    background: var(--app-primary);
    color: #04151c;
  }

  &--block {
    width: 100%;
    margin-top: auto;
  }
}

.landing__section {
  margin-bottom: 3rem;
}

.landing__section-head {
  margin-bottom: 1.15rem;

  h2 {
    font-size: clamp(1.8rem, 5vw, 2.4rem);
  }

  p:last-child {
    margin: 0;
    color: var(--app-text-muted);
  }
}

.landing__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
}

.landing__grid--two {
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
}

.landing__card,
.landing__plan {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  padding: 1.15rem 1.2rem;
  border-radius: 14px;
  border: 1px solid var(--app-border);
  background: var(--app-bg-elevated);

  h3 {
    margin: 0;
  }

  p {
    margin: 0;
    color: var(--app-text-muted);
    line-height: 1.45;
  }
}

.landing__plans {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
}

.landing__plan {
  ul {
    margin: 0.5rem 0 1rem;
    padding-left: 1.1rem;
    color: var(--app-text-soft);
    line-height: 1.5;
  }
}

.landing__plan--hot {
  border-color: color-mix(in srgb, var(--app-primary) 45%, transparent);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--app-primary) 25%, transparent);
}

.landing__plan-price {
  margin: 0;
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--app-link);
}

.landing__plan-tag {
  font-size: 0.9rem;
}

.landing__footer {
  display: flex;
  justify-content: center;
  gap: 0.45rem;
  padding-top: 1.25rem;
  border-top: 1px solid var(--app-border);
  font-size: 0.78rem;
  color: var(--app-text-muted);
}
</style>
