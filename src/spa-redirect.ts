// Restaura la ruta profunda tras el fallback 404 de GitHub Pages.
function restoreSpaPath(): void {
  const stored = sessionStorage.getItem('spa-redirect')
  if (stored) {
    sessionStorage.removeItem('spa-redirect')
    const url = new URL(stored, window.location.origin)
    const pathParam = new URLSearchParams(url.search).get('p')
    if (pathParam) {
      history.replaceState(null, '', pathParam)
      return
    }
  }

  const pathParam = new URLSearchParams(window.location.search).get('p')
  if (pathParam) {
    history.replaceState(null, '', pathParam)
  }
}

restoreSpaPath()
