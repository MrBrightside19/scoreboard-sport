/** Aviso sonoro de últimos minutos de juego (distinto del beep de 10 s). */

import { isLateGameWarningEnabled } from '@/utils/userPreferences'

let audioCtx: AudioContext | null = null

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const Ctx =
    window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext
  if (!Ctx) return null
  if (!audioCtx) audioCtx = new Ctx()
  return audioCtx
}

/**
 * Alarma urgente (doble-doble en square), más llamativa que el beep
 * corto de la cuenta regresiva.
 */
export async function playLateGameWarning(options?: { force?: boolean }): Promise<void> {
  if (!options?.force && !isLateGameWarningEnabled()) return

  const ctx = getAudioContext()
  if (!ctx) return

  if (ctx.state === 'suspended') {
    try {
      await ctx.resume()
    } catch {
      return
    }
  }

  // Patrón: bip-bip … BIP-BIP (más agudo y largo al final).
  const pulses = [
    { freq: 880, start: 0, dur: 0.11 },
    { freq: 880, start: 0.15, dur: 0.11 },
    { freq: 1175, start: 0.42, dur: 0.13 },
    { freq: 1175, start: 0.6, dur: 0.28 },
  ]

  const now = ctx.currentTime
  for (const pulse of pulses) {
    const oscillator = ctx.createOscillator()
    const gain = ctx.createGain()
    const t0 = now + pulse.start

    oscillator.type = 'square'
    oscillator.frequency.value = pulse.freq

    gain.gain.setValueAtTime(0.0001, t0)
    gain.gain.exponentialRampToValueAtTime(0.28, t0 + 0.008)
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + pulse.dur)

    oscillator.connect(gain)
    gain.connect(ctx.destination)
    oscillator.start(t0)
    oscillator.stop(t0 + pulse.dur + 0.02)
  }
}
