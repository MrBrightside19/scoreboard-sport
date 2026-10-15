/** Fecha y hora de un partido guardado. */
export function formatSavedAt(iso: string | null | undefined): string {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'

  return date.toLocaleString('es', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Solo la hora programada del partido (HH:mm). */
export function formatScheduledAt(iso: string | null | undefined): string {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'

  return date.toLocaleTimeString('es', {
    hour: '2-digit',
    minute: '2-digit',
  })
}
