/** Beep corto para cuenta regresiva final (sin archivo de audio). */

import { isCountdownBeepEnabled } from '@/utils/userPreferences'

let audioCtx: AudioContext | null = null

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const Ctx = window.AudioContext || (window as typeof window & {
    webkitAudioContext?: typeof AudioContext
  }).webkitAudioContext
  if (!Ctx) return null
  if (!audioCtx) audioCtx = new Ctx()
  return audioCtx
}

/** El navegador suspende el audio hasta un gesto; hay que reanudar el contexto. */
export async function unlockBeepAudio(): Promise<void> {
  const ctx = getAudioContext()
  if (!ctx) return
  if (ctx.state === 'suspended') {
    try {
      await ctx.resume()
    } catch {
      /* el siguiente beep lo reintenta */
    }
  }
}

export async function playCountdownBeep(
  final = false,
  options?: { force?: boolean },
): Promise<void> {
  if (!options?.force && !isCountdownBeepEnabled()) return

  await unlockBeepAudio()
  const ctx = getAudioContext()
  if (!ctx || ctx.state === 'suspended') return

  const now = ctx.currentTime
  const oscillator = ctx.createOscillator()
  const gain = ctx.createGain()
  const dur = final ? 0.32 : 0.2

  oscillator.type = 'square'
  oscillator.frequency.value = final ? 880 : 660

  gain.gain.setValueAtTime(0.0001, now)
  gain.gain.exponentialRampToValueAtTime(final ? 0.28 : 0.22, now + 0.012)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + dur)

  oscillator.connect(gain)
  gain.connect(ctx.destination)

  oscillator.start(now)
  oscillator.stop(now + dur + 0.02)
}
