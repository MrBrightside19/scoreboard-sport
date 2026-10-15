import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Connect, Plugin } from 'vite'

export const PLAYGROUND_SESSION_PATH = '/__playground-session'

const PHASES = new Set(['prematch', 'live', 'break', 'final'])
const SPORTS = new Set(['hockey', 'futsal', 'basketball', 'football'])

export interface PlaygroundSessionPayload {
  sport: string
  phase: string
}

function normalize(raw: unknown): PlaygroundSessionPayload {
  const parsed = raw && typeof raw === 'object' ? (raw as PlaygroundSessionPayload) : null
  return {
    sport: parsed && SPORTS.has(parsed.sport) ? parsed.sport : 'hockey',
    phase: parsed && PHASES.has(parsed.phase) ? parsed.phase : 'prematch',
  }
}

function pathnameOf(req: IncomingMessage): string {
  const raw = req.url ?? ''
  try {
    return new URL(raw, 'http://playground.local').pathname
  } catch {
    return raw.split('?')[0] ?? ''
  }
}

function isSessionPath(pathname: string): boolean {
  return pathname === PLAYGROUND_SESSION_PATH || pathname.endsWith(PLAYGROUND_SESSION_PATH)
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.end(JSON.stringify(body))
}

export function playgroundSessionPlugin(): Plugin {
  let session = normalize(null)

  const middleware: Connect.NextHandleFunction = (req, res, next) => {
    if (!isSessionPath(pathnameOf(req))) {
      next()
      return
    }

    const method = req.method ?? 'GET'
    if (method === 'OPTIONS') {
      sendJson(res, 204, {})
      return
    }
    if (method === 'GET') {
      sendJson(res, 200, session)
      return
    }
    if (method === 'PUT' || method === 'POST') {
      void readBody(req)
        .then((raw) => {
          try {
            session = normalize(raw ? JSON.parse(raw) : null)
          } catch {
            session = normalize(null)
          }
          sendJson(res, 200, session)
        })
        .catch(() => sendJson(res, 400, session))
      return
    }

    next()
  }

  return {
    name: 'playground-session',
    configureServer(server) {
      server.middlewares.use(middleware)
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware)
    },
  }
}
