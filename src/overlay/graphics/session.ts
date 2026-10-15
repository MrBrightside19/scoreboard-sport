import { parseSportId, type SportId } from '@/types/sport'

const STORAGE_KEY = 'scoredesk-overlay-playground'
const CHANNEL = 'scoredesk-overlay-playground'
const POLL_MS = 400

export type PlaygroundPhase = 'prematch' | 'live' | 'break' | 'final'

export interface PlaygroundSession {
  sport: SportId
  phase: PlaygroundPhase
}

const DEFAULT_SESSION: PlaygroundSession = {
  sport: 'hockey',
  phase: 'prematch',
}

let writeChannel: BroadcastChannel | null | undefined

export function parsePlaygroundPhase(raw: unknown): PlaygroundPhase {
  if (raw === 'live' || raw === 'break' || raw === 'final' || raw === 'prematch') {
    return raw
  }
  if (raw === 'lineup') return 'prematch'
  return 'prematch'
}

export function parsePlaygroundSession(raw: unknown): PlaygroundSession {
  const parsed = raw && typeof raw === 'object' ? (raw as Partial<PlaygroundSession>) : null
  return {
    sport: parseSportId(parsed?.sport),
    phase: parsePlaygroundPhase(parsed?.phase),
  }
}

function sessionEqual(a: PlaygroundSession, b: PlaygroundSession): boolean {
  return a.sport === b.sport && a.phase === b.phase
}

function sessionEndpoint(): string {
  const base = import.meta.env.BASE_URL.endsWith('/')
    ? import.meta.env.BASE_URL
    : `${import.meta.env.BASE_URL}/`
  return `${base}__playground-session`
}

function getWriteChannel(): BroadcastChannel | null {
  if (writeChannel !== undefined) return writeChannel
  try {
    writeChannel = new BroadcastChannel(CHANNEL)
  } catch {
    writeChannel = null
  }
  return writeChannel
}

export function readPlaygroundSession(): PlaygroundSession {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_SESSION }
    return parsePlaygroundSession(JSON.parse(raw) as unknown)
  } catch {
    return { ...DEFAULT_SESSION }
  }
}

async function pullRemoteSession(): Promise<PlaygroundSession | null> {
  try {
    const response = await fetch(sessionEndpoint(), { cache: 'no-store' })
    if (!response.ok) return null
    return parsePlaygroundSession(await response.json())
  } catch {
    return null
  }
}

async function pushRemoteSession(session: PlaygroundSession): Promise<void> {
  try {
    await fetch(sessionEndpoint(), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(session),
      keepalive: true,
    })
  } catch {
    // Build estático o sin el endpoint del playground.
  }
}

export function writePlaygroundSession(next: PlaygroundSession): void {
  const session = parsePlaygroundSession(next)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
  getWriteChannel()?.postMessage(session)
  void pushRemoteSession(session)
}

export function subscribePlaygroundSession(
  onChange: (session: PlaygroundSession) => void,
): () => void {
  let stopped = false
  let last: PlaygroundSession | null = null

  const emit = (session: PlaygroundSession): void => {
    if (stopped) return
    if (last && sessionEqual(last, session)) return
    last = session
    onChange(session)
  }

  const emitLocal = (): void => emit(readPlaygroundSession())

  const refresh = async (): Promise<void> => {
    const remote = await pullRemoteSession()
    if (stopped) return
    if (remote) emit(remote)
    else emitLocal()
  }

  const onStorage = (event: StorageEvent): void => {
    if (event.key === STORAGE_KEY) emitLocal()
  }
  window.addEventListener('storage', onStorage)

  let channel: BroadcastChannel | null = null
  try {
    channel = new BroadcastChannel(CHANNEL)
    channel.onmessage = (event: MessageEvent<unknown>) => {
      emit(parsePlaygroundSession(event.data))
    }
  } catch {
    channel = null
  }

  const timer = window.setInterval(() => {
    void refresh()
  }, POLL_MS)
  void refresh()

  return () => {
    stopped = true
    window.removeEventListener('storage', onStorage)
    channel?.close()
    window.clearInterval(timer)
  }
}
