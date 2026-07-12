import { defineStore } from 'pinia'
import { ref } from 'vue'
import type {
  GoalEvent,
  RosterPlayer,
  ScoreboardState,
  TeamPenalty,
} from '@/types/hockeyScoreboard'
import {
  createDefaultScoreboardState,
  DEFAULT_PENALTY_TYPE_ID,
  isGoalPending,
  MAX_PENALTIES_PER_TEAM,
  normalizeScoreboardState,
} from '@/types/hockeyScoreboard'
import { getPenaltyType, secondsToClock } from '@/data/penaltyCatalog'
import { fetchMatchState } from '@/services/matchSync'
import { isSupabaseConfigured } from '@/services/supabaseClient'
import {
  dispatchScoreboardSync,
  getStorageKey,
  writeMatchIdToStorage,
} from '@/utils/localSync'
import { generateId } from '@/utils/id'
import { canSetRole, findPlayerById } from '@/utils/roster'
import { normalizeGameTime, parseTimeToSeconds, tickDown, interpolateClock } from '@/utils/clock'

export const useScoreboardStore = defineStore('scoreboard', () => {
  const matchId = ref<string | null>(null)
  const state = ref<ScoreboardState>(createDefaultScoreboardState())
  const isWriter = ref(false)
  const tickInterval = ref<number | null>(null)

  function applyState(raw: unknown): ScoreboardState {
    return normalizeScoreboardState(raw)
  }

  function setMatch(id: string, initial?: ScoreboardState): void {
    matchId.value = id
    writeMatchIdToStorage(id)
    if (initial) {
      state.value = applyState(initial)
    } else {
      const stored = localStorage.getItem(getStorageKey(id))
      if (stored) {
        state.value = applyState(JSON.parse(stored) as ScoreboardState)
      } else {
        state.value = createDefaultScoreboardState()
      }
    }
    persistLocal()
  }

  async function hydrateMatch(
    id: string,
    fallback?: Pick<ScoreboardState, 'localTeam' | 'visitTeam' | 'timeGame'>,
  ): Promise<void> {
    matchId.value = id
    writeMatchIdToStorage(id)

    const applyFallback = (next: ScoreboardState): ScoreboardState => {
      if (!fallback?.localTeam || !fallback?.visitTeam) return next
      const isDefault =
        next.localTeam === 'Local' && next.visitTeam === 'Visita'
      if (!isDefault) return next
      return {
        ...next,
        localTeam: fallback.localTeam,
        visitTeam: fallback.visitTeam,
        timeGame: fallback.timeGame ?? next.timeGame,
      }
    }

    if (isSupabaseConfigured) {
      try {
        const record = await fetchMatchState(id)
        if (record?.state) {
          state.value = applyFallback(applyState(record.state))
          persistLocal()
          return
        }
      } catch {
        // Continuar con localStorage o valores por defecto
      }
    }

    const stored = localStorage.getItem(getStorageKey(id))
    if (stored) {
      state.value = applyFallback(applyState(JSON.parse(stored) as ScoreboardState))
      persistLocal()
      return
    }

    if (fallback?.localTeam && fallback?.visitTeam) {
      state.value = createDefaultScoreboardState(
        fallback.localTeam,
        fallback.visitTeam,
        fallback.timeGame,
      )
      persistLocal()
      return
    }

    state.value = createDefaultScoreboardState()
    persistLocal()
  }

  function syncElapsedAndPause(): void {
    if (state.value.isPaused) {
      patch({ updatedAt: new Date().toISOString() })
      return
    }

    const syncedTime = interpolateClock(
      state.value.timeGame,
      state.value.isPaused,
      state.value.updatedAt,
    )

    state.value = {
      ...state.value,
      timeGame: syncedTime,
      penaltiesLocal: interpolatePenalties(
        state.value.penaltiesLocal,
        state.value.isPaused,
        state.value.updatedAt,
      ),
      penaltiesVisit: interpolatePenalties(
        state.value.penaltiesVisit,
        state.value.isPaused,
        state.value.updatedAt,
      ),
      isPaused: true,
      updatedAt: new Date().toISOString(),
    }
    persistLocal()
  }

  function persistLocal(): void {
    if (!matchId.value) return
    localStorage.setItem(getStorageKey(matchId.value), JSON.stringify(state.value))
    dispatchScoreboardSync(matchId.value)
  }

  function loadFromLocal(id: string): void {
    const stored = localStorage.getItem(getStorageKey(id))
    if (stored) {
      state.value = applyState(JSON.parse(stored) as ScoreboardState)
      matchId.value = id
    }
  }

  function patch(partial: Partial<ScoreboardState>): void {
    state.value = {
      ...state.value,
      ...partial,
      updatedAt: new Date().toISOString(),
    }
    persistLocal()
  }

  function rosterKey(team: 'local' | 'visit'): 'rosterLocal' | 'rosterVisit' {
    return team === 'local' ? 'rosterLocal' : 'rosterVisit'
  }

  function penaltiesKey(team: 'local' | 'visit'): 'penaltiesLocal' | 'penaltiesVisit' {
    return team === 'local' ? 'penaltiesLocal' : 'penaltiesVisit'
  }

  function addRosterPlayer(team: 'local' | 'visit'): void {
    const key = rosterKey(team)
    const list = [...state.value[key]]
    list.push({
      id: generateId(),
      number: '',
      name: '',
      role: 'player',
    })
    patch({ [key]: list })
  }

  function updateRosterPlayer(
    team: 'local' | 'visit',
    playerId: string,
    updates: Partial<Pick<RosterPlayer, 'number' | 'name' | 'role'>>,
  ): void {
    const key = rosterKey(team)
    const list = [...state.value[key]]
    const index = list.findIndex((player) => player.id === playerId)
    if (index < 0) return

    const nextRole = updates.role ?? list[index].role
    if (updates.role && !canSetRole(list, playerId, nextRole)) return

    list[index] = { ...list[index], ...updates }
    patch({ [key]: list })
  }

  function removeRosterPlayer(team: 'local' | 'visit', playerId: string): void {
    const key = rosterKey(team)
    const list = state.value[key].filter((player) => player.id !== playerId)
    const goals = state.value.goals.filter(
      (goal) =>
        goal.scorerPlayerId !== playerId && goal.assistPlayerId !== playerId,
    )
    const penaltyKey = penaltiesKey(team)
    const penalties = state.value[penaltyKey].filter(
      (penalty) => penalty.playerId !== playerId,
    )
    patch({
      [key]: list,
      goals,
      [penaltyKey]: penalties,
    })
  }

  function markGoal(team: 'local' | 'visit'): string {
    const gameMinute = interpolateClock(
      state.value.timeGame,
      state.value.isPaused,
      state.value.updatedAt,
    )

    const goal: GoalEvent = {
      id: generateId(),
      team,
      scorerPlayerId: '',
      assistPlayerId: null,
      gameMinute,
      period: state.value.gamePeriod,
      createdAt: new Date().toISOString(),
      status: 'pending',
    }

    patch({
      goals: [...state.value.goals, goal],
      goalLocal: team === 'local' ? state.value.goalLocal + 1 : state.value.goalLocal,
      goalVisit: team === 'visit' ? state.value.goalVisit + 1 : state.value.goalVisit,
      timeGame: gameMinute,
    })

    return goal.id
  }

  function completeGoal(
    goalId: string,
    scorerPlayerId: string,
    assistPlayerId: string | null,
  ): void {
    const goal = state.value.goals.find((item) => item.id === goalId)
    if (!goal || !isGoalPending(goal)) return

    const goals = state.value.goals.map((item) =>
      item.id === goalId
        ? {
            ...item,
            scorerPlayerId,
            assistPlayerId,
            status: 'confirmed' as const,
          }
        : item,
    )
    patch({ goals })
  }

  function removeLastGoal(team: 'local' | 'visit'): void {
    const teamGoals = state.value.goals.filter((goal) => goal.team === team)
    if (teamGoals.length === 0) {
      if (team === 'local' && state.value.goalLocal > 0) {
        patch({ goalLocal: state.value.goalLocal - 1 })
      }
      if (team === 'visit' && state.value.goalVisit > 0) {
        patch({ goalVisit: state.value.goalVisit - 1 })
      }
      return
    }

    const lastGoal = teamGoals[teamGoals.length - 1]
    patch({
      goals: state.value.goals.filter((goal) => goal.id !== lastGoal.id),
      goalLocal: team === 'local' ? Math.max(0, state.value.goalLocal - 1) : state.value.goalLocal,
      goalVisit: team === 'visit' ? Math.max(0, state.value.goalVisit - 1) : state.value.goalVisit,
    })
  }

  function adjustGoal(team: 'local' | 'visit', delta: number): void {
    if (delta > 0) return
    if (delta < 0) {
      removeLastGoal(team)
      return
    }
  }

  function togglePause(): void {
    patch({ isPaused: !state.value.isPaused })
  }

  function setPeriod(period: number): void {
    patch({ gamePeriod: Math.max(1, period) })
  }

  function setTeams(localTeam: string, visitTeam: string): void {
    patch({
      localTeam: localTeam.slice(0, 15),
      visitTeam: visitTeam.slice(0, 15),
    })
  }

  function setTeamLogos(localLogo: string, visitLogo: string): void {
    patch({ localLogo, visitLogo })
  }

  function setGameTime(time: string): void {
    patch({ timeGame: normalizeGameTime(time) })
  }

  function addPenalty(
    team: 'local' | 'visit',
    playerId: string,
    penaltyTypeId: string,
    infraction = '',
  ): boolean {
    const key = penaltiesKey(team)
    const list = [...state.value[key]]
    if (list.length >= MAX_PENALTIES_PER_TEAM) return false

    const roster = state.value[rosterKey(team)]
    const player = findPlayerById(roster, playerId)
    if (!playerId || !player) return false

    const alreadyPenalized = list.some(
      (penalty) =>
        penalty.playerId === playerId ||
        (player.number.trim() !== '' &&
          penalty.player.trim() === player.number.trim()),
    )
    if (alreadyPenalized) return false

    const penaltyType = getPenaltyType(penaltyTypeId) ?? getPenaltyType(DEFAULT_PENALTY_TYPE_ID)!

    list.push({
      id: generateId(),
      playerId,
      player: player.number,
      penaltyTypeId: penaltyType.id,
      infraction,
      time: secondsToClock(penaltyType.durationSeconds),
    })
    patch({ [key]: list })
    return true
  }

  function removePenalty(team: 'local' | 'visit', penaltyId: string): void {
    const key = penaltiesKey(team)
    const list = state.value[key].filter((penalty) => penalty.id !== penaltyId)
    patch({ [key]: list })
  }

  function setPenaltyInfraction(
    team: 'local' | 'visit',
    penaltyId: string,
    infraction: string,
  ): void {
    const key = penaltiesKey(team)
    const list = [...state.value[key]]
    const index = list.findIndex((penalty) => penalty.id === penaltyId)
    if (index < 0) return
    list[index] = { ...list[index], infraction }
    patch({ [key]: list })
  }

  function tickPenaltyList(penalties: TeamPenalty[]): TeamPenalty[] {
    return penalties
      .map((penalty) => ({ ...penalty, time: tickDown(penalty.time) }))
      .filter((penalty) => parseTimeToSeconds(penalty.time) > 0)
  }

  function interpolatePenalties(
    penalties: TeamPenalty[],
    isPaused: boolean,
    updatedAt: string,
  ): TeamPenalty[] {
    return penalties
      .map((penalty) => ({
        ...penalty,
        time: interpolateClock(penalty.time, isPaused, updatedAt),
      }))
      .filter((penalty) => parseTimeToSeconds(penalty.time) > 0)
  }

  function startWriterTick(): void {
    if (tickInterval.value) return
    isWriter.value = true
    tickInterval.value = window.setInterval(() => {
      if (state.value.isPaused) return

      const next: Partial<ScoreboardState> = {
        timeGame: tickDown(state.value.timeGame),
        penaltiesLocal: tickPenaltyList(state.value.penaltiesLocal),
        penaltiesVisit: tickPenaltyList(state.value.penaltiesVisit),
        updatedAt: new Date().toISOString(),
      }

      state.value = { ...state.value, ...next }
      persistLocal()
    }, 1000)
  }

  function stopWriterTick(): void {
    isWriter.value = false
    if (tickInterval.value) {
      clearInterval(tickInterval.value)
      tickInterval.value = null
    }
  }

  function replaceState(next: ScoreboardState): void {
    state.value = applyState(next)
    if (matchId.value) persistLocal()
  }

  return {
    matchId,
    state,
    isWriter,
    setMatch,
    hydrateMatch,
    loadFromLocal,
    patch,
    addRosterPlayer,
    updateRosterPlayer,
    removeRosterPlayer,
    markGoal,
    completeGoal,
    removeLastGoal,
    adjustGoal,
    togglePause,
    setPeriod,
    setTeams,
    setTeamLogos,
    setGameTime,
    addPenalty,
    removePenalty,
    setPenaltyInfraction,
    startWriterTick,
    stopWriterTick,
    replaceState,
    persistLocal,
    syncElapsedAndPause,
  }
})
