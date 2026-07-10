<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useScoreboardStore } from '@/stores/scoreboard'
import { useAuthStore } from '@/stores/auth'
import { useLocalScoreboardSync } from '@/composables/useLocalScoreboardSync'
import { publishMatchState } from '@/services/matchSync'
import { isSupabaseConfigured } from '@/services/supabaseClient'
import { readMatchIdFromStorage } from '@/utils/localSync'
import { MAX_PERIODS } from '@/types/hockeyScoreboard'

const route = useRoute()
const store = useScoreboardStore()
const auth = useAuthStore()

const matchId = computed(
  () => (route.query.matchId as string) || readMatchIdFromStorage() || '',
)
const publishing = ref(false)
const copied = ref<string | null>(null)

useLocalScoreboardSync(() => matchId.value)

let publishTimer: number | null = null

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

function copyLink(type: 'live' | 'overlay'): void {
  const path = type === 'live'
    ? `/live/${matchId.value}`
    : `/overlay/${matchId.value}`
  const url = `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, '')}${path}`
  void navigator.clipboard.writeText(url)
  copied.value = type
  setTimeout(() => { copied.value = null }, 2000)
}

watch(
  matchId,
  (id) => {
    if (id) store.setMatch(id)
  },
  { immediate: true },
)

watch(
  () => store.state,
  () => { void publish() },
  { deep: true },
)

onMounted(() => {
  if (matchId.value) {
    store.startWriterTick()
    publishTimer = window.setInterval(() => void publish(), 5000)
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
        <router-link :to="{ name: 'board', query: { matchId } }" target="_blank">
          <a-button>Abrir Marcador TV</a-button>
        </router-link>
        <a-button @click="copyLink('live')">
          {{ copied === 'live' ? '¡Copiado!' : 'Copiar Live' }}
        </a-button>
        <a-button @click="copyLink('overlay')">
          {{ copied === 'overlay' ? '¡Copiado!' : 'Copiar OBS' }}
        </a-button>
      </div>
    </header>

    <a-alert
      v-if="!matchId"
      type="warning"
      message="Sin partido activo"
      description="Crea un partido desde Inicio para comenzar."
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
