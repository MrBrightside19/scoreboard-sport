<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import { Modal } from 'ant-design-vue'
import { useScoreboardStore } from '@/stores/scoreboard'
import { useAuthStore } from '@/stores/auth'
import { fetchMatchState, publishMatchState } from '@/services/matchSync'
import {
  advanceToNextTournamentMatch,
  getNextScheduledMatch,
} from '@/services/tournamentService'
import { isSupabaseConfigured } from '@/services/supabaseClient'
import { readMatchIdFromStorage } from '@/utils/localSync'
import { normalizeGameTime } from '@/utils/clock'
import { buildAppUrl, tournamentLivePath, tournamentOverlayPath } from '@/utils/appUrl'
import { MAX_PERIODS, MAX_PENALTIES_PER_TEAM } from '@/types/hockeyScoreboard'

const route = useRoute()
const router = useRouter()
const store = useScoreboardStore()
const auth = useAuthStore()

const matchId = computed(
  () => (route.query.matchId as string) || readMatchIdFromStorage() || '',
)

const matchFallback = computed((): Pick<
  import('@/types/hockeyScoreboard').ScoreboardState,
  'localTeam' | 'visitTeam' | 'timeGame'
> | undefined => {
  const local = route.query.local as string | undefined
  const visit = route.query.visit as string | undefined
  const time = route.query.time as string | undefined
  if (!local || !visit) return undefined
  return { localTeam: local, visitTeam: visit, timeGame: normalizeGameTime(time ?? '20:00') }
})

const publishing = ref(false)
const copied = ref<string | null>(null)
const hydrated = ref(false)
const advancing = ref(false)
const advanceError = ref<string | null>(null)
const tournamentContext = ref<{ tournamentId: string; court: string } | null>(null)
const hasNextMatch = ref(false)
const skipLeaveGuard = ref(false)

let publishTimer: number | null = null

async function finalizeOnExit(): Promise<void> {
  store.stopWriterTick()
  if (publishTimer) {
    clearInterval(publishTimer)
    publishTimer = null
  }
  if (!matchId.value || !hydrated.value || !isSupabaseConfigured) return
  hydrated.value = false
  store.syncElapsedAndPause()
  await publish()
}

function onBeforeUnload(event: BeforeUnloadEvent): void {
  if (!matchId.value || !hydrated.value || skipLeaveGuard.value) return
  event.preventDefault()
  event.returnValue = ''
}

let leaveModalOpen = false

async function loadTournamentContext(id: string): Promise<void> {
  tournamentContext.value = null
  hasNextMatch.value = false

  if (!isSupabaseConfigured) return

  try {
    const record = await fetchMatchState(id)
    if (!record?.tournament_id || !record.court) return

    tournamentContext.value = {
      tournamentId: record.tournament_id,
      court: record.court,
    }
    const next = await getNextScheduledMatch(record.tournament_id, record.court)
    hasNextMatch.value = Boolean(next)
  } catch {
    tournamentContext.value = null
  }
}

async function initMatch(id: string): Promise<void> {
  hydrated.value = false
  advanceError.value = null
  await store.hydrateMatch(id, matchFallback.value)
  await loadTournamentContext(id)
  hydrated.value = true
  if (!store.isWriter) {
    store.startWriterTick()
  }
}

async function goToNextMatch(): Promise<void> {
  if (!matchId.value || !auth.profile) return

  advancing.value = true
  advanceError.value = null
  hydrated.value = false
  store.stopWriterTick()

  try {
    const result = await advanceToNextTournamentMatch(
      matchId.value,
      store.state,
      auth.profile.id,
    )

    if (!result) {
      advanceError.value = 'No hay más partidos programados en esta cancha.'
      hasNextMatch.value = false
      hydrated.value = true
      store.startWriterTick()
      return
    }

    skipLeaveGuard.value = true
    await router.replace({
      name: 'controls',
      query: {
        matchId: result.matchId,
        local: result.localTeam,
        visit: result.visitTeam,
        time: result.timeGame,
        tournamentId: result.tournamentId,
      },
    })
  } catch (err) {
    advanceError.value = err instanceof Error ? err.message : 'Error al avanzar al siguiente partido'
    hydrated.value = true
    store.startWriterTick()
  } finally {
    advancing.value = false
  }
}

async function publish(): Promise<void> {
  if (!matchId.value || !isSupabaseConfigured) return
  publishing.value = true
  try {
    await publishMatchState(matchId.value, store.state, {
      organizer_id: auth.profile?.id ?? null,
      is_live: true,
      title: `${store.state.localTeam} vs ${store.state.visitTeam}`,
    })
  } finally {
    publishing.value = false
  }
}

type LinkType = 'live' | 'overlay' | 'live-torneo' | 'overlay-torneo'

function copyLink(type: LinkType): void {
  let path = ''

  if (type === 'overlay-torneo' && tournamentContext.value) {
    const { tournamentId, court } = tournamentContext.value
    path = tournamentOverlayPath(tournamentId, court)
  } else if (type === 'live-torneo' && tournamentContext.value) {
    const { tournamentId, court } = tournamentContext.value
    path = tournamentLivePath(tournamentId, court)
  } else if (type === 'live') {
    path = `/live/${matchId.value}`
  } else {
    path = `/overlay/${matchId.value}`
  }

  void navigator.clipboard.writeText(buildAppUrl(path))
  copied.value = type
  setTimeout(() => { copied.value = null }, 2000)
}

watch(
  matchId,
  (id) => {
    if (id) void initMatch(id)
  },
  { immediate: true },
)

watch(
  () => store.state,
  () => {
    if (!hydrated.value) return
    void publish()
  },
  { deep: true },
)

onMounted(() => {
  window.addEventListener('beforeunload', onBeforeUnload)
  if (matchId.value) {
    publishTimer = window.setInterval(() => {
      if (hydrated.value) void publish()
    }, 5000)
  }
})

onBeforeRouteLeave((_to, _from, next) => {
  if (skipLeaveGuard.value || !matchId.value || !hydrated.value) {
    skipLeaveGuard.value = false
    next()
    return
  }

  if (leaveModalOpen) {
    next(false)
    return
  }

  leaveModalOpen = true
  Modal.confirm({
    title: '¿Cerrar la mesa de control?',
    content:
      'Si sales, el reloj se pausará y dejarás de operar el partido. El overlay seguirá mostrando el marcador pausado.',
    okText: 'Salir',
    cancelText: 'Quedarme',
    okType: 'danger',
    onOk: async () => {
      skipLeaveGuard.value = true
      await finalizeOnExit()
      leaveModalOpen = false
      next()
    },
    onCancel: () => {
      leaveModalOpen = false
      next(false)
    },
  })
})

onUnmounted(() => {
  window.removeEventListener('beforeunload', onBeforeUnload)
  if (!skipLeaveGuard.value) {
    void finalizeOnExit()
  }
})
</script>

<template>
  <div class="controls">
    <header class="controls__header">
      <div>
        <h1>Mesa de control</h1>
        <p v-if="matchId" class="controls__match-id">Partido: {{ matchId }}</p>
      </div>
      <div class="controls__links">
        <router-link
          :to="{
            name: 'board',
            query: {
              matchId,
              local: route.query.local,
              visit: route.query.visit,
              time: route.query.time,
            },
          }"
          target="_blank"
        >
          <a-button>Abrir Marcador TV</a-button>
        </router-link>
        <template v-if="tournamentContext">
          <a-button type="primary" @click="copyLink('overlay-torneo')">
            {{ copied === 'overlay-torneo' ? '¡Copiado!' : 'Copiar OBS torneo' }}
          </a-button>
          <a-button @click="copyLink('live-torneo')">
            {{ copied === 'live-torneo' ? '¡Copiado!' : 'Copiar Live torneo' }}
          </a-button>
        </template>
        <template v-else>
          <a-button @click="copyLink('live')">
            {{ copied === 'live' ? '¡Copiado!' : 'Copiar Live' }}
          </a-button>
          <a-button @click="copyLink('overlay')">
            {{ copied === 'overlay' ? '¡Copiado!' : 'Copiar OBS' }}
          </a-button>
        </template>
      </div>
    </header>

    <a-alert
      v-if="!matchId"
      type="warning"
      message="Sin partido activo"
      description="Crea un partido desde Inicio para comenzar."
      show-icon
    />

    <a-alert
      v-else-if="!hydrated"
      type="info"
      message="Cargando partido…"
      show-icon
    />

    <div v-else class="controls__grid">
      <a-card title="Partido" class="controls__card controls__card--wide">
        <div class="controls__match">
          <div class="controls__side controls__side--local">
            <span class="controls__side-label">Local</span>
            <a-input
              :value="store.state.localTeam"
              size="large"
              @update:value="(v: string) => store.setTeams(v, store.state.visitTeam)"
            />
            <div class="controls__score-controls">
              <a-button size="large" @click="store.adjustGoal('local', -1)">−</a-button>
              <span class="controls__score">{{ store.state.goalLocal }}</span>
              <a-button type="primary" size="large" @click="store.adjustGoal('local', 1)">+</a-button>
            </div>
          </div>

          <div class="controls__divider" aria-hidden="true">VS</div>

          <div class="controls__side controls__side--visit">
            <span class="controls__side-label">Visita</span>
            <a-input
              :value="store.state.visitTeam"
              size="large"
              @update:value="(v: string) => store.setTeams(store.state.localTeam, v)"
            />
            <div class="controls__score-controls">
              <a-button size="large" @click="store.adjustGoal('visit', -1)">−</a-button>
              <span class="controls__score">{{ store.state.goalVisit }}</span>
              <a-button type="primary" size="large" @click="store.adjustGoal('visit', 1)">+</a-button>
            </div>
          </div>
        </div>
      </a-card>

      <a-card title="Reloj y periodo" class="controls__card">
        <div class="controls__clock-display">{{ store.state.timeGame }}</div>
        <div class="controls__btn-row">
          <a-button
            :type="store.state.isPaused ? 'primary' : 'default'"
            size="large"
            @click="store.togglePause()"
          >
            {{ store.state.isPaused ? 'Reanudar' : 'Pausar' }}
          </a-button>
          <a-input
            :value="store.state.timeGame"
            style="width: 100px"
            @update:value="(v: string) => store.setGameTime(v)"
          />
        </div>
        <div class="controls__btn-row">
          <a-button @click="store.setPeriod(store.state.gamePeriod - 1)">− Periodo</a-button>
          <span>Periodo {{ store.state.gamePeriod }} / {{ MAX_PERIODS }}</span>
          <a-button @click="store.setPeriod(store.state.gamePeriod + 1)">+ Periodo</a-button>
        </div>
      </a-card>

      <a-card title="Penalidades" class="controls__card controls__card--wide">
        <p class="controls__penalty-hint">
          Hasta {{ MAX_PENALTIES_PER_TEAM }} penalidades simultáneas por equipo. Indica el jugador y el tiempo de cada una.
        </p>
        <div class="controls__penalties-grid">
          <div class="controls__penalty-team">
            <h3 class="controls__penalty-team-title">
              Local — {{ store.state.localTeam }}
              <span class="controls__penalty-count">
                {{ store.state.penaltiesLocal.length }}/{{ MAX_PENALTIES_PER_TEAM }}
              </span>
            </h3>

            <div
              v-for="(penalty, index) in store.state.penaltiesLocal"
              :key="`local-penalty-${index}`"
              class="controls__penalty-row"
            >
              <a-input
                :value="penalty.player"
                placeholder="#"
                class="controls__penalty-player"
                @update:value="(v: string) => store.setPenaltyPlayer('local', index, v)"
              />
              <a-input
                :value="penalty.time"
                class="controls__penalty-time-input"
                @update:value="(v: string) => store.setPenaltyTime('local', index, v)"
              />
              <a-button
                danger
                size="small"
                class="controls__penalty-remove"
                @click="store.removePenalty('local', index)"
              >
                Quitar
              </a-button>
            </div>

            <a-button
              v-if="store.state.penaltiesLocal.length < MAX_PENALTIES_PER_TEAM"
              block
              @click="store.addPenalty('local')"
            >
              + Agregar penalidad
            </a-button>
          </div>

          <div class="controls__penalty-team">
            <h3 class="controls__penalty-team-title">
              Visita — {{ store.state.visitTeam }}
              <span class="controls__penalty-count">
                {{ store.state.penaltiesVisit.length }}/{{ MAX_PENALTIES_PER_TEAM }}
              </span>
            </h3>

            <div
              v-for="(penalty, index) in store.state.penaltiesVisit"
              :key="`visit-penalty-${index}`"
              class="controls__penalty-row"
            >
              <a-input
                :value="penalty.player"
                placeholder="#"
                class="controls__penalty-player"
                @update:value="(v: string) => store.setPenaltyPlayer('visit', index, v)"
              />
              <a-input
                :value="penalty.time"
                class="controls__penalty-time-input"
                @update:value="(v: string) => store.setPenaltyTime('visit', index, v)"
              />
              <a-button
                danger
                size="small"
                class="controls__penalty-remove"
                @click="store.removePenalty('visit', index)"
              >
                Quitar
              </a-button>
            </div>

            <a-button
              v-if="store.state.penaltiesVisit.length < MAX_PENALTIES_PER_TEAM"
              block
              @click="store.addPenalty('visit')"
            >
              + Agregar penalidad
            </a-button>
          </div>
        </div>
      </a-card>

      <a-card v-if="tournamentContext" title="Torneo" class="controls__card controls__card--wide">
        <p class="controls__tournament-meta">
          Cancha {{ tournamentContext.court }}
        </p>
        <p class="controls__tournament-hint controls__tournament-hint--info">
          El enlace <strong>OBS torneo</strong> es fijo para esta cancha y se actualiza solo al pasar al siguiente partido.
        </p>
        <a-alert
          v-if="advanceError"
          type="error"
          :message="advanceError"
          show-icon
          style="margin-bottom: 0.75rem"
        />
        <a-popconfirm
          title="¿Finalizar este partido e iniciar el siguiente de la cancha?"
          ok-text="Sí, continuar"
          cancel-text="Cancelar"
          :disabled="!hasNextMatch || advancing"
          @confirm="goToNextMatch"
        >
          <a-button
            type="primary"
            block
            :loading="advancing"
            :disabled="!hasNextMatch"
          >
            Siguiente partido
          </a-button>
        </a-popconfirm>
        <p v-if="!hasNextMatch" class="controls__tournament-hint">
          No quedan partidos programados en esta cancha.
        </p>
      </a-card>
    </div>

    <p v-if="publishing" class="controls__sync">Sincronizando…</p>
  </div>
</template>

<style scoped lang="scss">
.controls {
  max-width: 1000px;
  margin: 0 auto;
  padding: 1.5rem;
}

.controls__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;

  h1 { margin: 0; }
}

.controls__match-id {
  margin: 0.25rem 0 0;
  font-size: 0.85rem;
  opacity: 0.6;
}

.controls__links {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.controls__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1rem;
}

.controls__card--wide {
  grid-column: 1 / -1;
}

.controls__tournament-meta {
  margin: 0 0 0.75rem;
  font-size: 0.9rem;
  opacity: 0.7;
}

.controls__tournament-hint {
  margin: 0.75rem 0 0;
  font-size: 0.8rem;
  opacity: 0.55;
  text-align: center;

  &--info {
    margin-top: 0;
    margin-bottom: 0.75rem;
    text-align: left;
    opacity: 0.7;
  }
}

.controls__match {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 1rem;
  align-items: start;
}

.controls__side {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.controls__side-label {
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  opacity: 0.55;
}

.controls__side--local .controls__side-label {
  color: #00d4ff;
}

.controls__side--visit .controls__side-label {
  color: #ff6b35;
}

.controls__divider {
  align-self: center;
  font-family: 'Bebas Neue', sans-serif;
  font-size: 1.4rem;
  letter-spacing: 0.08em;
  opacity: 0.35;
  padding-top: 2rem;
}

.controls__score-controls {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
}

.controls__score {
  font-family: 'Bebas Neue', sans-serif;
  font-size: 2.8rem;
  min-width: 2ch;
  text-align: center;
  line-height: 1;
}

.controls__penalty-hint {
  margin: 0 0 1rem;
  font-size: 0.82rem;
  opacity: 0.65;
}

.controls__penalties-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 1.25rem;
}

.controls__penalty-team {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  padding: 1rem;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.07);
}

.controls__penalty-team-title {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 600;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
}

.controls__penalty-count {
  font-size: 0.8rem;
  font-weight: 500;
  opacity: 0.55;
}

.controls__penalty-row {
  display: grid;
  grid-template-columns: 64px 88px 1fr;
  gap: 0.5rem;
  align-items: center;
}

.controls__penalty-player,
.controls__penalty-time-input {
  font-family: 'Bebas Neue', sans-serif;
  font-size: 1.1rem;
  letter-spacing: 0.04em;
  text-align: center;
}

.controls__penalty-remove {
  justify-self: start;
}

.controls__score-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.controls__team-block {
  text-align: center;

  span {
    display: block;
    margin-bottom: 0.5rem;
    font-size: 0.85rem;
    opacity: 0.7;
  }
}

.controls__score-btns {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;

  strong {
    font-family: 'Bebas Neue', sans-serif;
    font-size: 2.5rem;
    min-width: 2ch;
  }
}

.controls__clock-display {
  font-family: 'Bebas Neue', sans-serif;
  font-size: 3rem;
  text-align: center;
  margin-bottom: 1rem;
}

.controls__btn-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-top: 0.75rem;
}

.controls__sync {
  text-align: center;
  font-size: 0.8rem;
  opacity: 0.5;
  margin-top: 1rem;
}

@media (max-width: 720px) {
  .controls__match {
    grid-template-columns: 1fr;
  }

  .controls__divider {
    padding-top: 0;
    text-align: center;
  }
}
</style>
