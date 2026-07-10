<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
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
import { MAX_PERIODS } from '@/types/hockeyScoreboard'

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

let publishTimer: number | null = null

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
  if (matchId.value) {
    publishTimer = window.setInterval(() => {
      if (hydrated.value) void publish()
    }, 5000)
  }
})

onUnmounted(() => {
  store.stopWriterTick()
  if (publishTimer) clearInterval(publishTimer)
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
      <a-card title="Equipos" class="controls__card">
        <a-form layout="vertical">
          <a-form-item label="Local">
            <a-input
              :value="store.state.localTeam"
              @update:value="(v: string) => store.setTeams(v, store.state.visitTeam)"
            />
          </a-form-item>
          <a-form-item label="Visita">
            <a-input
              :value="store.state.visitTeam"
              @update:value="(v: string) => store.setTeams(store.state.localTeam, v)"
            />
          </a-form-item>
        </a-form>
      </a-card>

      <a-card title="Marcador" class="controls__card">
        <div class="controls__score-row">
          <div class="controls__team-block">
            <span>{{ store.state.localTeam }}</span>
            <div class="controls__score-btns">
              <a-button size="large" @click="store.adjustGoal('local', -1)">−</a-button>
              <strong>{{ store.state.goalLocal }}</strong>
              <a-button type="primary" size="large" @click="store.adjustGoal('local', 1)">+</a-button>
            </div>
          </div>
          <div class="controls__team-block">
            <span>{{ store.state.visitTeam }}</span>
            <div class="controls__score-btns">
              <a-button size="large" @click="store.adjustGoal('visit', -1)">−</a-button>
              <strong>{{ store.state.goalVisit }}</strong>
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

      <a-card title="Penalidades" class="controls__card">
        <p class="controls__penalty-time">{{ store.state.penaltyGame }}</p>
        <div class="controls__btn-row">
          <a-button
            :type="store.state.penalizedLocal ? 'primary' : 'default'"
            danger
            @click="store.togglePenalty('local')"
          >
            Penalidad {{ store.state.localTeam }}
          </a-button>
          <a-button
            :type="store.state.penalizedVisit ? 'primary' : 'default'"
            danger
            @click="store.togglePenalty('visit')"
          >
            Penalidad {{ store.state.visitTeam }}
          </a-button>
          <a-button @click="store.resetPenalty()">Reset 2:00</a-button>
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

.controls__penalty-time {
  text-align: center;
  font-family: 'Bebas Neue', sans-serif;
  font-size: 2rem;
  margin: 0 0 0.5rem;
  color: #ff6b6b;
}

.controls__sync {
  text-align: center;
  font-size: 0.8rem;
  opacity: 0.5;
  margin-top: 1rem;
}
</style>
