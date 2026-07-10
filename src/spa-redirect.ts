// SPA redirect para GitHub Pages (404.html)
const redirect = sessionStorage.getItem('spa-redirect')
if (redirect) {
  sessionStorage.removeItem('spa-redirect')
  const url = new URL(redirect, window.location.origin)
  const pathParam = new URLSearchParams(url.search).get('p')
  if (pathParam) {
    history.replaceState(null, '', pathParam)
  }
}
