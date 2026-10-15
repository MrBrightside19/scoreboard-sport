export function overlayCrest(letter: string, background: string, foreground = '#ffffff'): string {
  const initial = (letter.trim()[0] ?? '?').toUpperCase()
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${foreground}" stop-opacity=".18"/>
        <stop offset="1" stop-color="#000" stop-opacity=".28"/>
      </linearGradient>
    </defs>
    <circle cx="32" cy="32" r="30" fill="${background}"/>
    <circle cx="32" cy="32" r="30" fill="url(#g)"/>
    <circle cx="32" cy="32" r="26" fill="none" stroke="${foreground}" stroke-opacity=".35" stroke-width="1.5"/>
    <text x="32" y="42" text-anchor="middle" font-family="Arial Black, sans-serif" font-size="26" fill="${foreground}">${initial}</text>
  </svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}
