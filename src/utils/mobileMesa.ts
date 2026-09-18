export const MOBILE_MESA_QUERY = '(max-width: 900px)'

export function isMobileMesaViewport(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false
  }
  return window.matchMedia(MOBILE_MESA_QUERY).matches
}

export function operatorHomeRouteName(): 'mobile-mesa' | 'app-home' {
  return isMobileMesaViewport() ? 'mobile-mesa' : 'app-home'
}

/** Acepta código, URL de live/overlay/controls o ?matchId=. */
export function parseMatchCode(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ''

  try {
    const url = new URL(trimmed)
    const fromQuery = url.searchParams.get('matchId')?.trim()
    if (fromQuery) return fromQuery
  } catch {
    // No es una URL absoluta.
  }

  const queryMatch = trimmed.match(/[?&]matchId=([^&\s#]+)/i)
  if (queryMatch?.[1]) return decodeURIComponent(queryMatch[1])

  const pathMatch = trimmed.match(/\/(?:live|overlay)\/([^/?#]+)/i)
  if (pathMatch?.[1]) return decodeURIComponent(pathMatch[1])

  return trimmed.replace(/\s+/g, '')
}
