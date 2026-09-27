import { defineStore, acceptHMRUpdate } from 'pinia'
import { ref } from 'vue'
import type {
  GoalEvent,
  RosterPlayer,
  ScoreboardState,
  ShotEvent,
  ShotResult,
  TeamPenalty,
} from '@/sports/scoreboardState'
import type { FutsalExclusionEvent } from '@/sports/futsal/types'
import {
  createDefaultScoreboardState,
  DEFAULT_INTERMISSION_TIME,
  DEFAULT_PENALTY_TYPE_ID,
  isGoalPending,
  MAX_PENALTIES_PER_TEAM,
  normalizeScoreboardState,
} from '@/sports/scoreboardState'
import { getPenaltyType, secondsToClock } from '@/data/penaltyCatalog'
import { getSportModule } from '@/sports/registry'
import { clockDirection, isCountUpSport, kickoffClock, periodEndClockSeconds } from '@/sports/clockRules'
import { fetchMatchState } from '@/services/matchSync'
import { isSupabaseConfigured } from '@/services/supabaseClient'
import {
  dispatchScoreboardSync,
  getStorageKey,
  writeMatchIdToStorage,
} from '@/utils/localSync'
import { generateId } from '@/utils/id'
import { canSetRole, findPlayerById } from '@/utils/roster'
import {
  interpolateClock,
  formatSecondsToTime,
  normalizeGameTime,
  parseTimeToSeconds,
  tickDown,
} from '@/utils/clock'

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
        timeGame: isCountUpSport(next.sport)
          ? next.timeGame
          : fallback.timeGame ?? next.timeGame,
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

  let writerResumeHandler: (() => void) | null = null
  let wakeLockSentinel: WakeLockSentinel | null = null
  let syncingClock = false

  function interpolateGameClock(now = Date.now()): string {
    const direction = clockDirection(state.value.sport)
    return interpolateClock(
      state.value.timeGame,
      state.value.isPaused,
      state.value.updatedAt,
      now,
      direction,
      direction === 'up' ? periodEndClockSeconds(state.value) : undefined,
    )
  }

  function playedClockSeconds(
    fromTime: string,
    toTime: string,
    direction: 'down' | 'up',
  ): number {
    const from = parseTimeToSeconds(fromTime)
    const to = parseTimeToSeconds(toTime)
    return Math.max(0, direction === 'up' ? to - from : from - to)
  }

  function currentDisplayClock(now = Date.now()): string {
    if (state.value.intermissionActive) {
      return interpolateClock(
        state.value.intermissionTime,
        state.value.isPaused,
        state.value.updatedAt,
        now,
        'down',
      )
    }
    return interpolateGameClock(now)
  }

  /** Avanza el reloj con el tiempo real, no con un +1 por cada setInterval. */
  function catchUpRunningClock(
    now = Date.now(),
    options: { allowPeriodAdvance?: boolean; materialize?: boolean } = {},
  ): boolean {
    const allowPeriodAdvance = options.allowPeriodAdvance !== false
    const materialize = options.materialize === true
    if (syncingClock) return false
    syncingClock = true
    try {
      const direction = clockDirection(state.value.sport)

      if (
        direction === 'up' &&
        !state.value.intermissionActive &&
        parseTimeToSeconds(state.value.timeGame) > periodEndClockSeconds(state.value)
      ) {
        patch({
          timeGame: formatSecondsToTime(periodEndClockSeconds(state.value)),
          isPaused: true,
        })
        return true
      }

      if (state.value.isPaused) return false

      if (state.value.intermissionActive) {
        const remaining = parseTimeToSeconds(state.value.intermissionTime)
        if (remaining <= 0) {
          if (allowPeriodAdvance) finishIntermissionTick()
          return allowPeriodAdvance
        }
        const nextIntermission = interpolateClock(
          state.value.intermissionTime,
          false,
          state.value.updatedAt,
          now,
          'down',
        )
        const ended = parseTimeToSeconds(nextIntermission) <= 0
        if (!ended && !materialize) return false
        if (nextIntermission === state.value.intermissionTime && !ended) return false
        state.value = {
          ...state.value,
          intermissionTime: nextIntermission,
          updatedAt: new Date(now).toISOString(),
        }
        persistLocal()
        if (ended && allowPeriodAdvance) finishIntermissionTick()
        return true
      }

      if (direction === 'down' && parseTimeToSeconds(state.value.timeGame) <= 0) {
        patch({ isPaused: true })
        return true
      }

      const previousTime = state.value.timeGame
      const nextTime = interpolateGameClock(now)
      const playedSeconds = playedClockSeconds(previousTime, nextTime, direction)
      const cap = direction === 'up' ? periodEndClockSeconds(state.value) : 0
      const periodEnded =
        direction === 'up'
          ? parseTimeToSeconds(nextTime) >= cap
          : parseTimeToSeconds(nextTime) <= 0

      if (!periodEnded && !materialize) return false
      if (playedSeconds <= 0 && !periodEnded) return false

      state.value = {
        ...state.value,
        timeGame: nextTime,
        penaltiesLocal: tickPenaltyList(state.value.penaltiesLocal, playedSeconds),
        penaltiesVisit: tickPenaltyList(state.value.penaltiesVisit, playedSeconds),
        futsalExclusions: tickFutsalExclusions(
          state.value.futsalExclusions ?? [],
          playedSeconds,
        ),
        isPaused: periodEnded,
        updatedAt: new Date(now).toISOString(),
      }
      persistLocal()
      return true
    } finally {
      syncingClock = false
    }
  }

  function syncElapsedAndPause(): void {
    if (state.value.isPaused) {
      patch({ updatedAt: new Date().toISOString() })
      return
    }
    catchUpRunningClock()
    if (!state.value.isPaused) {
      patch({ isPaused: true })
    }
  }

  async function requestWriterWakeLock(): Promise<void> {
    if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) return
    if (document.visibilityState !== 'visible') return
    try {
      wakeLockSentinel = await navigator.wakeLock.request('screen')
      wakeLockSentinel.addEventListener('release', () => {
        wakeLockSentinel = null
      })
    } catch {
      wakeLockSentinel = null
    }
  }

  function bindWriterClockGuards(): void {
    if (writerResumeHandler || typeof document === 'undefined') return
    writerResumeHandler = () => {
      catchUpRunningClock()
      if (document.visibilityState === 'visible') {
        void requestWriterWakeLock()
      }
    }
    document.addEventListener('visibilitychange', writerResumeHandler)
    document.addEventListener('freeze', writerResumeHandler)
    document.addEventListener('resume', writerResumeHandler)
    window.addEventListener('pageshow', writerResumeHandler)
    void requestWriterWakeLock()
  }

  function unbindWriterClockGuards(): void {
    if (writerResumeHandler) {
      document.removeEventListener('visibilitychange', writerResumeHandler)
      document.removeEventListener('freeze', writerResumeHandler)
      document.removeEventListener('resume', writerResumeHandler)
      window.removeEventListener('pageshow', writerResumeHandler)
      writerResumeHandler = null
    }
    if (wakeLockSentinel) {
      void wakeLockSentinel.release()
      wakeLockSentinel = null
    }
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
    catchUpRunningClock(Date.now(), { allowPeriodAdvance: false, materialize: true })
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
    const gameMinute = interpolateGameClock()

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

  function defaultGoalkeeperId(team: 'local' | 'visit'): string {
    const roster = team === 'local' ? state.value.rosterLocal : state.value.rosterVisit
    return roster.find((player) => player.role === 'goalkeeper')?.id ?? ''
  }

  function markShot(
    team: 'local' | 'visit',
    result: ShotResult,
    goalkeeperPlayerId?: string,
  ): string {
    const gameMinute = interpolateGameClock()

    const shot: ShotEvent = {
      id: generateId(),
      team,
      result,
      goalkeeperPlayerId:
        result === 'save'
          ? (goalkeeperPlayerId || defaultGoalkeeperId(team))
          : '',
      gameMinute,
      period: state.value.gamePeriod,
      createdAt: new Date().toISOString(),
    }

    patch({
      shots: [...state.value.shots, shot],
      timeGame: gameMinute,
    })

    return shot.id
  }

  function removeLastShot(team: 'local' | 'visit', result: ShotResult): void {
    const teamShots = state.value.shots.filter(
      (shot) => shot.team === team && shot.result === result,
    )
    if (teamShots.length === 0) return

    const lastShot = teamShots[teamShots.length - 1]
    patch({
      shots: state.value.shots.filter((shot) => shot.id !== lastShot.id),
    })
  }

  function removeShot(shotId: string): void {
    if (!state.value.shots.some((shot) => shot.id === shotId)) return
    patch({
      shots: state.value.shots.filter((shot) => shot.id !== shotId),
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

  /** Pasa al siguiente periodo conservando el tiempo restante de las faltas. */
  function advanceToNextPeriod(periodLength?: string): void {
    const nextTime = normalizeGameTime(
      periodLength ?? kickoffClock(state.value.sport),
    )
    if (
      !state.value.intermissionActive &&
      !state.value.isPaused &&
      clockDirection(state.value.sport) === 'down' &&
      parseTimeToSeconds(state.value.timeGame) > 0
    ) {
      syncElapsedAndPause()
    }
    patch({
      gamePeriod: state.value.gamePeriod + 1,
      timeGame: nextTime,
      intermissionActive: false,
      intermissionTime: state.value.intermissionDuration || DEFAULT_INTERMISSION_TIME,
      isPaused: true,
      footballStoppageMinutes: 0,
    })
  }

  function startIntermission(duration?: string): void {
    if (!state.value.isPaused && !state.value.intermissionActive) {
      if (
        clockDirection(state.value.sport) === 'up' ||
        parseTimeToSeconds(state.value.timeGame) > 0
      ) {
        patch({ timeGame: interpolateGameClock() })
      }
    }
    const configured = normalizeGameTime(
      duration ?? (state.value.intermissionDuration || DEFAULT_INTERMISSION_TIME),
    )
    if (parseTimeToSeconds(configured) <= 0) return
    patch({
      intermissionActive: true,
      intermissionDuration: configured,
      intermissionTime: configured,
      isPaused: false,
    })
  }

  function stopIntermission(): void {
    if (!state.value.intermissionActive) return
    finishIntermissionTick()
  }

  function setIntermissionTime(time: string): void {
    const normalized = normalizeGameTime(time)
    if (state.value.intermissionActive) {
      patch({ intermissionTime: normalized })
      return
    }
    patch({
      intermissionDuration: normalized,
      intermissionTime: normalized,
    })
  }

  function setTeams(localTeam: string, visitTeam: string): void {
    patch({
      localTeam: localTeam.slice(0, 18),
      visitTeam: visitTeam.slice(0, 18),
    })
  }

  function setTeamLogos(localLogo: string, visitLogo: string): void {
    patch({ localLogo, visitLogo })
  }

  function setTeamColors(localColor: string, visitColor: string): void {
    patch({ localColor, visitColor })
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

  function tickPenaltyList(penalties: TeamPenalty[], seconds = 1): TeamPenalty[] {
    if (seconds <= 0) return penalties
    return penalties
      .map((penalty) => ({ ...penalty, time: tickDown(penalty.time, seconds) }))
      .filter((penalty) => parseTimeToSeconds(penalty.time) > 0)
  }

  function tickFutsalExclusions(
    exclusions: FutsalExclusionEvent[],
    seconds = 1,
  ): FutsalExclusionEvent[] {
    if (seconds <= 0) return exclusions
    return exclusions
      .map((item) => ({ ...item, time: tickDown(item.time, seconds) }))
      .filter((item) => parseTimeToSeconds(item.time) > 0)
  }

  /** Al terminar el descanso: avanza de periodo si queda alguno y reinicia el reloj de cuenta arriba. */
  function finishIntermissionTick(): void {
    const sport = getSportModule(state.value.sport)
    const countUp = sport.clock.direction === 'up'
    if (countUp) {
      const nextPeriod =
        state.value.gamePeriod < sport.clock.periods
          ? state.value.gamePeriod + 1
          : state.value.gamePeriod
      patch({
        gamePeriod: nextPeriod,
        timeGame: kickoffClock(state.value.sport),
        intermissionActive: false,
        intermissionTime: state.value.intermissionDuration || DEFAULT_INTERMISSION_TIME,
        isPaused: true,
        footballStoppageMinutes: 0,
      })
      return
    }
    if (state.value.gamePeriod < sport.clock.periods) {
      advanceToNextPeriod()
      return
    }
    patch({
      intermissionActive: false,
      intermissionTime: state.value.intermissionDuration || DEFAULT_INTERMISSION_TIME,
      isPaused: true,
    })
  }

  function startWriterTick(): void {
    if (tickInterval.value) return
    isWriter.value = true
    bindWriterClockGuards()
    catchUpRunningClock()
    tickInterval.value = window.setInterval(() => {
      catchUpRunningClock()
    }, 1000)
  }

  function stopWriterTick(): void {
    isWriter.value = false
    unbindWriterClockGuards()
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
    markShot,
    removeLastShot,
    removeShot,
    adjustGoal,
    togglePause,
    setPeriod,
    advanceToNextPeriod,
    startIntermission,
    stopIntermission,
    setIntermissionTime,
    setTeams,
    setTeamLogos,
    setTeamColors,
    setGameTime,
    addPenalty,
    removePenalty,
    setPenaltyInfraction,
    startWriterTick,
    stopWriterTick,
    catchUpRunningClock,
    currentDisplayClock,
    replaceState,
    persistLocal,
    syncElapsedAndPause,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useScoreboardStore, import.meta.hot))
}