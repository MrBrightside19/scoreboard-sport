import { onMounted, onUnmounted, ref } from 'vue'

/**
 * Reloj de pared para pintar mm:ss. En el teléfono `setInterval` se retrasa y
 * el display se queda corto; rAF se reanuda con Date.now() real.
 */
export function useAnimationNow(minIntervalMs = 200) {
  const now = ref(Date.now())
  let raf = 0

  function stop(): void {
    if (raf) {
      cancelAnimationFrame(raf)
      raf = 0
    }
  }

  function loop(): void {
    raf = requestAnimationFrame(loop)
    const next = Date.now()
    if (next - now.value >= minIntervalMs) now.value = next
  }

  function onVisibility(): void {
    if (document.visibilityState === 'visible') {
      now.value = Date.now()
      if (!raf) loop()
      return
    }
    stop()
  }

  onMounted(() => {
    now.value = Date.now()
    loop()
    document.addEventListener('visibilitychange', onVisibility)
  })

  onUnmounted(() => {
    document.removeEventListener('visibilitychange', onVisibility)
    stop()
  })

  return now
}
