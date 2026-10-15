import { nextTick, onMounted, onUnmounted, watch, type Ref } from 'vue'

/** Píxeles por segundo: ~1,5 s por renglón de 13 px para poder leer. */
const PX_PER_SEC = 30
const PAUSE_MS = 1700

export function useAutoPingPong(
  viewport: Ref<HTMLElement | null>,
  track: Ref<HTMLElement | null>,
  source: Ref<unknown>,
): void {
  let frameId = 0
  let observer: ResizeObserver | null = null
  let offset = 0
  let direction = 1
  let pauseUntil = 0
  let lastTs = 0
  let overflow = 0

  function setTransform(y: number): void {
    const el = track.value
    if (!el) return
    el.style.transform = y > 0.5 ? `translate3d(0, ${-y}px, 0)` : ''
  }

  function stop(): void {
    if (frameId) {
      cancelAnimationFrame(frameId)
      frameId = 0
    }
    lastTs = 0
  }

  function tick(now: number): void {
    frameId = requestAnimationFrame(tick)
    if (overflow <= 1) {
      offset = 0
      setTransform(0)
      return
    }
    if (!lastTs) {
      lastTs = now
      pauseUntil = now + PAUSE_MS
    }
    if (now < pauseUntil) {
      lastTs = now
      return
    }
    const dt = Math.min(0.048, (now - lastTs) / 1000)
    lastTs = now
    offset += direction * PX_PER_SEC * dt
    if (offset >= overflow) {
      offset = overflow
      direction = -1
      pauseUntil = now + PAUSE_MS
    } else if (offset <= 0) {
      offset = 0
      direction = 1
      pauseUntil = now + PAUSE_MS
    }
    setTransform(offset)
  }

  function measure(): void {
    const view = viewport.value
    const inner = track.value
    if (!view || !inner) return
    const next = Math.max(0, inner.scrollHeight - view.clientHeight)
    if (Math.abs(next - overflow) < 1) return
    overflow = next
    offset = 0
    direction = 1
    lastTs = 0
    setTransform(0)
  }

  onMounted(() => {
    void nextTick(measure)
    observer = new ResizeObserver(() => measure())
    if (viewport.value) observer.observe(viewport.value)
    if (track.value) observer.observe(track.value)
    frameId = requestAnimationFrame(tick)
  })

  watch(
    source,
    async () => {
      await nextTick()
      measure()
      if (viewport.value) observer?.observe(viewport.value)
      if (track.value) observer?.observe(track.value)
    },
    { deep: true },
  )

  onUnmounted(() => {
    stop()
    observer?.disconnect()
  })
}
