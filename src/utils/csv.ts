import type { CsvMatchRow } from '@/types/tournament'
import { normalizeGameTime } from '@/utils/clock'

const REQUIRED_COLUMNS = ['local', 'visita', 'tiempo_juego', 'cancha'] as const

export function parseCsv(text: string): CsvMatchRow[] {
  const lines = text
    .trim()
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)

  if (lines.length < 2) {
    throw new Error('El CSV debe incluir encabezado y al menos una fila.')
  }

  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase())
  for (const column of REQUIRED_COLUMNS) {
    if (!headers.includes(column)) {
      throw new Error(`Falta la columna obligatoria: ${column}`)
    }
  }

  return lines.slice(1).map((line, index) => {
    const values = line.split(',').map((v) => v.trim())
    const row: Record<string, string> = {}
    headers.forEach((header, i) => {
      row[header] = values[i] ?? ''
    })

    if (!row.local || !row.visita || !row.tiempo_juego || !row.cancha) {
      throw new Error(`Fila ${index + 2}: faltan datos obligatorios.`)
    }

    return {
      local: row.local,
      visita: row.visita,
      tiempo_juego: normalizeGameTime(row.tiempo_juego),
      cancha: row.cancha,
      categoria: row.categoria || undefined,
      fecha_programada: row.fecha_programada || undefined,
    }
  })
}

export function buildCsvTemplate(): string {
  return [
    'local,visita,categoria,tiempo_juego,cancha,fecha_programada',
    'Huracanes,Thunder,Sub-18,20:00,1,2026-06-15 18:00',
    'Leones,Sharks,Sub-21,15:00,2,2026-06-15 18:00',
  ].join('\n')
}
