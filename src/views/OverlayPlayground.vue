<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import OverlayPlaygroundStage from '@/overlay/graphics/OverlayPlaygroundStage.vue'
import {
  parsePlaygroundPhase,
  readPlaygroundSession,
  writePlaygroundSession,
  type PlaygroundPhase,
} from '@/overlay/graphics/session'
import { SPORTS, parseSportId, type SportId } from '@/types/sport'
import { buildAppUrl } from '@/utils/appUrl'

const CANVAS_W = 1920
const CANVAS_H = 1080

const PHASES: { id: PlaygroundPhase; label: string; hint: string }[] = [
  { id: 'prematch', label: 'Pre partido', hint: 'Nómina a pantalla, antes del overlay' },
  { id: 'live', label: 'Partido', hint: 'Marcador overlay' },
  { id: 'break', label: 'Descanso', hint: 'Estadísticas del primer tiempo' },
  { id: 'final', label: 'Finalizar partido', hint: 'Estadísticas de todo el partido' },
]

const route = useRoute()
const router = useRouter()
const viewport = ref<HTMLElement | null>(null)
const scale = ref(0.4)
const background = ref<'dark' | 'chroma' | 'checker'>('dark')
const copied = ref(false)

const stored = readPlaygroundSession()
const sport = computed(() =>
  typeof route.query.sport === 'string' ? parseSportId(route.query.sport) : stored.sport,
)
const phase = computed(() => {
  const raw = route.query.phase ?? route.query.card
  return raw != null ? parsePlaygroundPhase(raw) : stored.phase
})

const obsUrl = computed(() => buildAppUrl('/overlay/playground'))

const notes = computed(() => {
  const current = PHASES.find((item) => item.id === phase.value)
  return current?.hint ?? ''
})

function queryWithoutLegacyCard() {
  const { card: _card, ...rest } = route.query
  return rest
}

function setSport(id: SportId): void {
  void router.replace({
    query: { ...queryWithoutLegacyCard(), sport: id, phase: phase.value },
  })
}

function setPhase(next: PlaygroundPhase): void {
  void router.replace({
    query: { ...queryWithoutLegacyCard(), sport: sport.value, phase: next },
  })
}

function copyObsUrl(): void {
  void navigator.clipboard.writeText(obsUrl.value)
  copied.value = true
  window.setTimeout(() => {
    copied.value = false
  }, 1600)
}

function updateScale(): void {
  const el = viewport.value
  if (!el) return
  scale.value = Math.min(el.clientWidth / CANVAS_W, el.clientHeight / CANVAS_H)
}

watch(
  [sport, phase],
  ([nextSport, nextPhase]) => {
    writePlaygroundSession({ sport: nextSport, phase: nextPhase })
    requestAnimationFrame(updateScale)
  },
  { immediate: true },
)

let observer: ResizeObserver | null = null

onMounted(() => {
  const rest = queryWithoutLegacyCard()
  if (rest.sport !== sport.value || rest.phase !== phase.value || route.query.card != null) {
    void router.replace({
      query: { ...rest, sport: sport.value, phase: phase.value },
    })
  }
  updateScale()
  observer = new ResizeObserver(() => updateScale())
  if (viewport.value) observer.observe(viewport.value)
  window.addEventListener('resize', updateScale)
})

onUnmounted(() => {
  observer?.disconnect()
  window.removeEventListener('resize', updateScale)
})
</script>

<template>
  <div class="playground">
    <header class="playground__bar">
      <div>
        <RouterLink :to="{ name: 'app-home' }" class="playground__back">Volver al inicio</RouterLink>
        <p class="playground__eyebrow">Overlay</p>
        <h1>Playground</h1>
        <p class="playground__lead">
          Los botones controlan también la URL de OBS. Dejala abierta y cambia
          el momento del partido desde acá para ubicar cada card.
        </p>
      </div>
      <div class="playground__controls">
        <div class="playground__group">
          <span>Deporte</span>
          <div class="playground__pills">
            <button
              v-for="item in SPORTS"
              :key="item.id"
              type="button"
              :class="{ 'is-active': sport === item.id }"
              @click="setSport(item.id)"
            >
              {{ item.label }}
            </button>
          </div>
        </div>
        <div class="playground__group">
          <span>Fondo</span>
          <div class="playground__pills">
            <button
              type="button"
              :class="{ 'is-active': background === 'dark' }"
              @click="background = 'dark'"
            >
              Oscuro
            </button>
            <button
              type="button"
              :class="{ 'is-active': background === 'chroma' }"
              @click="background = 'chroma'"
            >
              Chroma
            </button>
            <button
              type="button"
              :class="{ 'is-active': background === 'checker' }"
              @click="background = 'checker'"
            >
              Damero
            </button>
          </div>
        </div>
      </div>
    </header>

    <div class="playground__flow">
      <button
        v-for="(item, index) in PHASES"
        :key="item.id"
        type="button"
        :class="{ 'is-active': phase === item.id }"
        @click="setPhase(item.id)"
      >
        <span>{{ index + 1 }}</span>
        {{ item.label }}
      </button>
    </div>

    <p class="playground__note">{{ notes }}</p>

    <div class="playground__obs">
      <code>{{ obsUrl }}</code>
      <a-button size="small" @click="copyObsUrl">
        {{ copied ? 'Copiado' : 'Copiar URL OBS' }}
      </a-button>
    </div>

    <div ref="viewport" class="playground__viewport" :data-bg="background">
      <div
        class="playground__canvas"
        :style="{
          width: `${CANVAS_W}px`,
          height: `${CANVAS_H}px`,
          transform: `scale(${scale})`,
        }"
      >
        <OverlayPlaygroundStage :sport="sport" :phase="phase" />
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.playground {
  max-width: 1240px;
  margin: 0 auto;
  padding: 1.5rem 1.5rem 2.5rem;
}

.playground__bar {
  display: flex;
  justify-content: space-between;
  gap: 1.5rem;
  align-items: flex-start;
  flex-wrap: wrap;
  margin-bottom: 1rem;
}

.playground__back {
  display: inline-block;
  margin-bottom: 0.65rem;
  color: var(--app-link);
  text-decoration: none;
  font-size: 0.88rem;
  font-weight: 600;

  &:hover {
    text-decoration: underline;
  }
}

.playground__eyebrow {
  margin: 0 0 0.3rem;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--app-link);
}

.playground h1 {
  margin: 0 0 0.45rem;
  font-family: 'Bebas Neue', sans-serif;
  font-weight: 400;
  font-size: clamp(2.2rem, 6vw, 3.2rem);
  letter-spacing: 0.04em;
}

.playground__lead {
  margin: 0;
  max-width: 36rem;
  color: var(--app-text-muted);
  line-height: 1.5;
}

.playground__controls {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  min-width: min(100%, 28rem);
}

.playground__group {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;

  > span {
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--app-text-muted);
  }
}

.playground__pills {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;

  button {
    border: 1px solid var(--app-border-strong);
    background: var(--app-surface);
    color: var(--app-text);
    border-radius: 999px;
    padding: 0.35rem 0.8rem;
    font-size: 0.82rem;
    font-weight: 650;
    cursor: pointer;
  }

  .is-active {
    border-color: color-mix(in srgb, var(--app-primary) 55%, transparent);
    background: color-mix(in srgb, var(--app-primary) 18%, transparent);
    color: var(--app-link);
  }
}

.playground__flow {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.5rem;
  margin-bottom: 0.85rem;

  button {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.2rem;
    padding: 0.7rem 0.85rem;
    border-radius: 12px;
    border: 1px solid var(--app-border-strong);
    background: var(--app-surface);
    color: var(--app-text);
    font-size: 0.92rem;
    font-weight: 650;
    text-align: left;
    cursor: pointer;

    span {
      font-size: 0.68rem;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: var(--app-text-muted);
    }
  }

  .is-active {
    border-color: color-mix(in srgb, var(--app-primary) 55%, transparent);
    background: color-mix(in srgb, var(--app-primary) 16%, transparent);
    color: var(--app-link);

    span {
      color: var(--app-link);
    }
  }
}

@media (max-width: 720px) {
  .playground__flow {
    grid-template-columns: 1fr 1fr;
  }
}

.playground__note {
  margin: 0 0 0.85rem;
  font-size: 0.9rem;
  color: var(--app-text-soft);
}

.playground__obs {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.65rem;
  margin: 0 0 0.85rem;

  code {
    flex: 1;
    min-width: 0;
    padding: 0.4rem 0.65rem;
    border-radius: 8px;
    border: 1px solid var(--app-border);
    background: var(--app-surface);
    font-size: 0.78rem;
    word-break: break-all;
  }
}

.playground__viewport {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  border-radius: 16px;
  border: 1px solid var(--app-border);
  display: flex;
  align-items: flex-start;
  justify-content: center;

  &[data-bg='dark'] {
    background: #070b12;
  }

  &[data-bg='chroma'] {
    background: #00b140;
  }

  &[data-bg='checker'] {
    background-color: #111;
    background-image:
      linear-gradient(45deg, #1c1c1c 25%, transparent 25%),
      linear-gradient(-45deg, #1c1c1c 25%, transparent 25%),
      linear-gradient(45deg, transparent 75%, #1c1c1c 75%),
      linear-gradient(-45deg, transparent 75%, #1c1c1c 75%);
    background-size: 32px 32px;
    background-position: 0 0, 0 16px, 16px -16px, -16px 0;
  }
}

.playground__canvas {
  position: absolute;
  top: 0;
  left: 0;
  overflow: hidden;
  transform-origin: top left;
}
</style>
