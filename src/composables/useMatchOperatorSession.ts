import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import { Modal } from 'ant-design-vue'
import { useAuthStore } from '@/stores/auth'
import { useScoreboardStore } from '@/stores/scoreboard'
import { fetchMatchState, finishMatch, publishMatchState } from '@/services/matchSync'
import {
  advanceToNextTournamentMatch,
  fetchTournament,
  fetchTournamentMatchByMatchId,
  finishTournamentMatch,
  getNextScheduledMatch,
} from '@/services/tournamentService'
import { isSupabaseConfigured } from '@/services/supabaseClient'
import {
  clearMatchIdFromStorage,
  readMatchIdFromStorage,
  writeCourtActiveMatch,
} from '@/utils/localSync'
import { normalizeGameTime } from '@/utils/clock'
import { getLiveClockUpdateMs } from '@/config/poll'
import { buildAppUrl, tournamentBoardPath } from '@/utils/appUrl'
import { operatorHomeRouteName } from '@/utils/mobileMesa'

export function useMatchOperatorSession() {
  const route = useRoute()
  const router = useRouter()
  const store = useScoreboardStore()
  const auth = useAuthStore()

  const matchId = computed(
    () => (route.query.matchId as string) || readMatchIdFromStorage() || '',
  )
  const matchFallback = computed(():
    | Pick<
        import('@/sports/scoreboardState').ScoreboardState,
        'localTeam' | 'visitTeam' | 'timeGame'
      >
    | undefined => {
    const local = route.query.local as string | undefined
    const visit = route.query.visit as string | undefined
    const time = route.query.time as string | undefined
    if (!local || !visit) return undefined
    return {
      localTeam: local,
      visitTeam: visit,
      timeGame: normalizeGameTime(time ?? '20:00'),
    }
  })

  const copied = ref<string | null>(null)
  const hydrated = ref(false)
  const advancing = ref(false)
  const finishing = ref(false)
  const advanceError = ref<string | null>(null)
  const tournamentContext = ref<{ tournamentId: string; court: string } | null>(null)
  const hasNextMatch = ref(false)
  const skipLeaveGuard = ref(false)

  let publishTimer: number | null = null
  let publishDebounceTimer: number | null = null
  let publishInFlight = false
  let publishQueued = false
  let leaveModalOpen = false

  function schedulePublish(delayMs = 400): void {
    if (!hydrated.value || !matchId.value || !isSupabaseConfigured) return
    if (publishDebounceTimer) clearTimeout(publishDebounceTimer)
    publishDebounceTimer = window.setTimeout(() => {
      publishDebounceTimer = null
      void publish()
    }, delayMs)
  }

  async function publish(): Promise<void> {
    if (!matchId.value || !isSupabaseConfigured) return
    if (publishInFlight) {
      publishQueued = true
      return
    }
    publishInFlight = true
    try {
      await publishMatchState(matchId.value, store.state, {
        organizer_id: auth.profile?.id ?? null,
        is_live: true,
        title: `${store.state.localTeam} vs ${store.state.visitTeam}`,
      })
    } finally {
      publishInFlight = false
      if (publishQueued) {
        publishQueued = false
        void publish()
      }
    }
  }

  async function finalizeOnExit(): Promise<void> {
    store.stopWriterTick()
    if (publishTimer) {
      clearInterval(publishTimer)
      publishTimer = null
    }
    if (publishDebounceTimer) {
      clearTimeout(publishDebounceTimer)
      publishDebounceTimer = null
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

  async function loadTournamentContext(id: string): Promise<boolean> {
    tournamentContext.value = null
    hasNextMatch.value = false
    if (!isSupabaseConfigured) return true
    try {
      const record = await fetchMatchState(id)
      if (!record?.tournament_id || !record.court) return true
      const tournament = await fetchTournament(record.tournament_id)
      if (tournament?.status === 'finished') {
        Modal.warning({
          title: 'Torneo finalizado',
          content: 'No se pueden abrir los controles de un torneo finalizado.',
        })
        skipLeaveGuard.value = true
        await router.replace({
          name: 'tournament-detail',
          params: { id: record.tournament_id },
        })
        return false
      }
      tournamentContext.value = {
        tournamentId: record.tournament_id,
        court: record.court,
      }
      writeCourtActiveMatch(record.tournament_id, record.court, id)
      const next = await getNextScheduledMatch(record.tournament_id, record.court)
      hasNextMatch.value = Boolean(next)
      return true
    } catch {
      tournamentContext.value = null
      return true
    }
  }

  async function initMatch(id: string): Promise<void> {
    hydrated.value = false
    advanceError.value = null
    await store.hydrateMatch(id, matchFallback.value)
    const allowed = await loadTournamentContext(id)
    if (!allowed) return
    hydrated.value = true
    if (!store.isWriter) store.startWriterTick()
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
        skipLeaveGuard.value = true
        const tournamentId = tournamentContext.value?.tournamentId
        if (tournamentId) {
          await router.replace({ name: 'tournament-detail', params: { id: tournamentId } })
        } else {
          await router.replace({ name: 'tournaments' })
        }
        return
      }
      skipLeaveGuard.value = true
      writeCourtActiveMatch(result.tournamentId, result.court, result.matchId)
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
      advanceError.value =
        err instanceof Error ? err.message : 'Error al avanzar al siguiente partido'
      hydrated.value = true
      store.startWriterTick()
    } finally {
      advancing.value = false
    }
  }

  async function finishCurrentMatch(): Promise<void> {
    if (!matchId.value || finishing.value) return
    finishing.value = true
    advanceError.value = null
    store.stopWriterTick()
    if (publishTimer) {
      clearInterval(publishTimer)
      publishTimer = null
    }
    if (publishDebounceTimer) {
      clearTimeout(publishDebounceTimer)
      publishDebounceTimer = null
    }
    try {
      store.syncElapsedAndPause()
      const tm = await fetchTournamentMatchByMatchId(matchId.value)
      if (tm) await finishTournamentMatch(tm, store.state)
      else await finishMatch(matchId.value, store.state)
      skipLeaveGuard.value = true
      hydrated.value = false
      if (!tm) clearMatchIdFromStorage()
      const tournamentId = tournamentContext.value?.tournamentId ?? tm?.tournament_id
      if (tournamentId) {
        await router.replace({ name: 'tournament-detail', params: { id: tournamentId } })
      } else {
        await router.replace({ name: operatorHomeRouteName() })
      }
    } catch (err) {
      advanceError.value =
        err instanceof Error ? err.message : 'Error al finalizar el partido'
      hydrated.value = true
      store.startWriterTick()
    } finally {
      finishing.value = false
    }
  }

  function copyLink(type: 'live' | 'overlay' | 'board' | 'board-torneo'): void {
    let path = ''
    if (type === 'board-torneo' && tournamentContext.value) {
      path = tournamentBoardPath(
        tournamentContext.value.tournamentId,
        tournamentContext.value.court,
      )
    } else if (type === 'board') {
      path = `/board?matchId=${encodeURIComponent(matchId.value)}`
    } else if (type === 'live') {
      path = `/live/${matchId.value}`
    } else {
      path = `/overlay/${matchId.value}`
    }
    void navigator.clipboard.writeText(buildAppUrl(path))
    copied.value = type
    setTimeout(() => {
      copied.value = null
    }, 2000)
  }

  watch(
    matchId,
    (id) => {
      if (id) void initMatch(id)
    },
    { immediate: true },
  )

  watch(
    () => ({
      localTeam: store.state.localTeam,
      visitTeam: store.state.visitTeam,
      goalLocal: store.state.goalLocal,
      goalVisit: store.state.goalVisit,
      gamePeriod: store.state.gamePeriod,
      isPaused: store.state.isPaused,
      goals: store.state.goals,
      basketballScores: store.state.basketballScores,
      rebounds: store.state.rebounds,
      basketballFouls: store.state.basketballFouls,
      futsalAccumulatedFouls: store.state.futsalAccumulatedFouls,
      futsalCards: store.state.futsalCards,
      futsalExclusions: store.state.futsalExclusions,
      futsalTimeouts: store.state.futsalTimeouts,
      footballCards: store.state.footballCards,
      rosterLocal: store.state.rosterLocal,
      rosterVisit: store.state.rosterVisit,
      timeGame: store.state.isPaused ? store.state.timeGame : null,
    }),
    () => schedulePublish(),
    { deep: true },
  )

  onMounted(() => {
    window.addEventListener('beforeunload', onBeforeUnload)
    if (matchId.value) {
      publishTimer = window.setInterval(() => {
        if (hydrated.value) void publish()
      }, getLiveClockUpdateMs())
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
        'Si sales, el reloj se pausará y dejarás de operar el partido. Usa «Finalizar partido» si quieres cerrarlo del todo.',
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
    if (!skipLeaveGuard.value) void finalizeOnExit()
  })

  return {
    route,
    store,
    matchId,
    copied,
    hydrated,
    advancing,
    finishing,
    advanceError,
    tournamentContext,
    hasNextMatch,
    goToNextMatch,
    finishCurrentMatch,
    copyLink,
  }
}
