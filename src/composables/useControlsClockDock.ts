import {
  computed,
  nextTick,
  onMounted,
  onUnmounted,
  ref,
  watch,
  type MaybeRefOrGetter,
  type Ref,
  toValue,
} from 'vue'
import { useScoreboardStore } from '@/stores/scoreboard'
import { getSportModule } from '@/sports/registry'

/**
 * Mini-reloj flotante cuando el card de reloj no está a la vista
 * (cambio de pestaña o scroll). Compartido por todos los deportes.
 */
export function useControlsClockDock(options: {
  activeTab: Ref<string>
  matchId: MaybeRefOrGetter<string>
  matchTabKey?: string
  clockSectionEl?: Ref<HTMLElement | null>
  clockDisplayEl?: Ref<HTMLElement | null>
}) {
  const store = useScoreboardStore()
  const matchTabKey = options.matchTabKey ?? 'match'

  const clockSectionEl = options.clockSectionEl ?? ref<HTMLElement | null>(null)
  const clockDisplayEl = options.clockDisplayEl ?? ref<HTMLElement | null>(null)
  const clockInView = ref(false)
  let clockObserver: IntersectionObserver | null = null

  const sport = computed(() => getSportModule(store.state.sport))

  const dockClockTime = computed(() =>
    store.state.intermissionActive
      ? store.state.intermissionTime
      : store.state.timeGame,
  )

  const dockClockLabel = computed(() => {
    if (store.state.intermissionActive) {
      return store.state.isPaused ? 'Descanso · pausa' : 'Descanso'
    }
    const period = sport.value.periodLabel(store.state.gamePeriod)
    return store.state.isPaused ? `${period} · pausa` : period
  })

  const showDockClock = computed(
    () => Boolean(toValue(options.matchId)) && !clockInView.value,
  )

  function clockViewportTopInset(): number {
    const nav = document.querySelector('.app-nav')
    const tabs = document.querySelector('.controls__tabs .ant-tabs-nav')
    const navBottom = nav?.getBoundingClientRect().bottom ?? 0
    const tabsBottom = tabs?.getBoundingClientRect().bottom ?? 0
    return Math.max(navBottom, tabsBottom, 0) + 8
  }

  function measureClockDisplayInView(): boolean {
    const el = clockDisplayEl.value
    if (!el) return false
    const rect = el.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return false
    const top = clockViewportTopInset()
    const bottom =
      (window.innerHeight || document.documentElement.clientHeight) - 8
    const midY = rect.top + rect.height / 2
    return midY >= top && midY <= bottom
  }

  function syncClockInView(): void {
    clockInView.value = measureClockDisplayInView()
  }

  function setupClockObserver(): void {
    clockObserver?.disconnect()
    clockObserver = null
    const el = clockDisplayEl.value
    if (!el || typeof IntersectionObserver === 'undefined') {
      syncClockInView()
      return
    }
    const topInset = clockViewportTopInset()
    clockObserver = new IntersectionObserver(() => syncClockInView(), {
      root: null,
      threshold: [0, 0.25, 0.5, 0.75, 1],
      rootMargin: `-${Math.round(topInset)}px 0px -8px 0px`,
    })
    clockObserver.observe(el)
    syncClockInView()
    requestAnimationFrame(() => {
      requestAnimationFrame(syncClockInView)
    })
  }

  function scrollToClock(): void {
    if (options.activeTab.value !== matchTabKey) {
      options.activeTab.value = matchTabKey
      void nextTick(() => {
        clockSectionEl.value?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      })
      return
    }
    clockSectionEl.value?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  watch(options.activeTab, () => {
    void nextTick(setupClockObserver)
  })

  watch(
    () => toValue(options.matchId),
    () => {
      void nextTick(setupClockObserver)
    },
  )

  onMounted(() => {
    window.addEventListener('resize', syncClockInView, { passive: true })
    window.addEventListener('scroll', syncClockInView, { passive: true, capture: true })
    void nextTick(setupClockObserver)
  })

  onUnmounted(() => {
    window.removeEventListener('resize', syncClockInView)
    window.removeEventListener('scroll', syncClockInView)
    clockObserver?.disconnect()
    clockObserver = null
  })

  return {
    clockSectionEl,
    clockDisplayEl,
    clockInView,
    dockClockTime,
    dockClockLabel,
    showDockClock,
    scrollToClock,
    setupClockObserver,
    syncClockInView,
  }
}
