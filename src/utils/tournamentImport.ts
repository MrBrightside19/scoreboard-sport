import * as XLSX from 'xlsx'
import type {
  CsvMatchRow,
  CsvPlayerRow,
  TournamentImportPayload,
} from '@/types/tournament'
import { normalizeGameTime } from '@/utils/clock'
import { parseCsv } from '@/utils/csv'

const MATCH_SHEET = 'Calendario'
const PLAYER_SHEET = 'Jugadores'

const MATCH_REQUIRED = ['local', 'visita', 'tiempo_juego', 'cancha'] as const
const PLAYER_REQUIRED = ['equipo', 'numero', 'nombre', 'apellido'] as const

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase()
}

/** Convierte celdas de Excel (Date, serial, texto) a string usable. */
function cellToString(value: unknown, field?: string): string {
  if (value == null || value === '') return ''

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    if (field === 'tiempo_juego') {
      return `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`
    }
    const y = value.getFullYear()
    const m = String(value.getMonth() + 1).padStart(2, '0')
    const d = String(value.getDate()).padStart(2, '0')
    const hh = String(value.getHours()).padStart(2, '0')
    const mm = String(value.getMinutes()).padStart(2, '0')
    return `${y}-${m}-${d} ${hh}:${mm}`
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    // Serial de Excel (días desde 1899-12-30)
    if (field === 'fecha_programada' || value > 20000) {
      const parsed = XLSX.SSF.parse_date_code(value)
      if (parsed) {
        const y = parsed.y
        const m = String(parsed.m).padStart(2, '0')
        const d = String(parsed.d).padStart(2, '0')
        const hh = String(parsed.H).padStart(2, '0')
        const mm = String(parsed.M).padStart(2, '0')
        if (field === 'tiempo_juego') return `${hh}:${mm}`
        return `${y}-${m}-${d} ${hh}:${mm}`
      }
    }
    if (field === 'tiempo_juego' && value > 0 && value < 1) {
      const totalMinutes = Math.round(value * 24 * 60)
      const mins = Math.floor(totalMinutes / 60)
      const secs = totalMinutes % 60
      return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
    }
    return String(value)
  }

  return String(value).trim()
}

/**
 * Parsea fecha_programada a ISO o null.
 * Acepta: "2026-06-15 18:00", ISO, DD/MM/YYYY HH:mm, serial Excel, Date.
 */
export function parseScheduledAt(
  raw: string | null | undefined,
  rowLabel?: string,
): string | null {
  const value = (raw ?? '').trim()
  if (!value) return null

  let date: Date | null = null

  // YYYY-MM-DD[ T]HH:mm[:ss]
  const isoLike = value.match(
    /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/,
  )
  if (isoLike) {
    const [, y, mo, d, hh = '0', mm = '0', ss = '0'] = isoLike
    date = new Date(
      Number(y),
      Number(mo) - 1,
      Number(d),
      Number(hh),
      Number(mm),
      Number(ss),
    )
  }

  // DD/MM/YYYY[ HH:mm]
  if (!date || Number.isNaN(date.getTime())) {
    const dmy = value.match(
      /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/,
    )
    if (dmy) {
      const [, d, mo, y, hh = '0', mm = '0', ss = '0'] = dmy
      date = new Date(
        Number(y),
        Number(mo) - 1,
        Number(d),
        Number(hh),
        Number(mm),
        Number(ss),
      )
    }
  }

  // Serial Excel numérico
  if ((!date || Number.isNaN(date.getTime())) && /^\d+(\.\d+)?$/.test(value)) {
    const serial = Number(value)
    if (serial > 20000) {
      const parsed = XLSX.SSF.parse_date_code(serial)
      if (parsed) {
        date = new Date(parsed.y, parsed.m - 1, parsed.d, parsed.H, parsed.M, parsed.S || 0)
      }
    }
  }

  // Último intento nativo
  if (!date || Number.isNaN(date.getTime())) {
    const native = new Date(
      value.includes(' ') && !value.includes('T') ? value.replace(' ', 'T') : value,
    )
    if (!Number.isNaN(native.getTime())) date = native
  }

  if (!date || Number.isNaN(date.getTime())) {
    throw new Error(
      `${rowLabel ?? 'Fecha'}: valor inválido "${value}". Usa formato AAAA-MM-DD HH:mm (ej. 2026-06-15 18:00).`,
    )
  }

  return date.toISOString()
}

function sheetToObjects(sheet: XLSX.WorkSheet): Record<string, string>[] {
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: '',
    raw: true,
  })
  return rows.map((row) => {
    const normalized: Record<string, string> = {}
    for (const [key, value] of Object.entries(row)) {
      const header = normalizeHeader(String(key))
      normalized[header] = cellToString(value, header)
    }
    return normalized
  })
}

function parseMatchObjects(rows: Record<string, string>[]): CsvMatchRow[] {
  if (!rows.length) {
    throw new Error('La hoja Calendario debe incluir al menos un partido.')
  }

  const headers = Object.keys(rows[0] ?? {})
  for (const column of MATCH_REQUIRED) {
    if (!headers.includes(column)) {
      throw new Error(`En Calendario falta la columna obligatoria: ${column}`)
    }
  }

  return rows.map((row, index) => {
    if (!row.local || !row.visita || !row.tiempo_juego || !row.cancha) {
      throw new Error(`Calendario fila ${index + 2}: faltan datos obligatorios.`)
    }
    if (row.fecha_programada) {
      parseScheduledAt(row.fecha_programada, `Calendario fila ${index + 2}`)
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

function parsePlayerObjects(rows: Record<string, string>[]): CsvPlayerRow[] {
  if (!rows.length) return []

  const headers = Object.keys(rows[0] ?? {})
  for (const column of PLAYER_REQUIRED) {
    if (!headers.includes(column)) {
      throw new Error(`En Jugadores falta la columna obligatoria: ${column}`)
    }
  }

  const players: CsvPlayerRow[] = []
  const seen = new Set<string>()

  rows.forEach((row, index) => {
    if (!row.equipo && !row.numero && !row.nombre && !row.apellido) return
    if (!row.equipo || !row.numero || !row.nombre || !row.apellido) {
      throw new Error(
        `Jugadores fila ${index + 2}: equipo, numero, nombre y apellido son obligatorios.`,
      )
    }

    const numero = row.numero.replace(/\D/g, '').slice(0, 3)
    if (!numero) {
      throw new Error(`Jugadores fila ${index + 2}: el número debe ser numérico.`)
    }

    const key = `${row.equipo.toLowerCase()}|${(row.categoria ?? '').toLowerCase()}|${numero}`
    if (seen.has(key)) {
      throw new Error(
        `Jugadores fila ${index + 2}: número ${numero} duplicado para ${row.equipo}` +
          (row.categoria ? ` (${row.categoria})` : '') +
          '.',
      )
    }
    seen.add(key)

    players.push({
      equipo: row.equipo,
      categoria: row.categoria || undefined,
      numero,
      nombre: row.nombre,
      apellido: row.apellido,
      posicion: row.posicion || undefined,
    })
  })

  return players
}

/** Plantilla Excel con hojas Calendario y Jugadores. */
export function buildTournamentTemplateWorkbook(): ArrayBuffer {
  const workbook = XLSX.utils.book_new()

  const matchSheet = XLSX.utils.aoa_to_sheet([
    ['local', 'visita', 'categoria', 'tiempo_juego', 'cancha', 'fecha_programada'],
    ['Huracanes', 'Thunder', 'Sub-18', '20:00', '1', '2026-06-15 18:00'],
    ['Leones', 'Sharks', 'Sub-21', '15:00', '2', '2026-06-15 18:00'],
  ])
  // Forzar texto en tiempo_juego y fecha para que Excel no las convierta
  ;(['D2', 'D3', 'F2', 'F3'] as const).forEach((cell) => {
    if (matchSheet[cell]) matchSheet[cell].t = 's'
  })
  XLSX.utils.book_append_sheet(workbook, matchSheet, MATCH_SHEET)

  const playerSheet = XLSX.utils.aoa_to_sheet([
    ['equipo', 'categoria', 'numero', 'nombre', 'apellido', 'posicion'],
    ['Huracanes', 'Sub-18', '1', 'Ana', 'Porter', 'Arquero'],
    ['Huracanes', 'Sub-18', '10', 'Luis', 'García', 'Capitán'],
    ['Thunder', 'Sub-18', '7', 'Sofía', 'Ruiz', 'Jugador'],
    ['Thunder', 'Sub-18', '19', 'Marco', 'Díaz', 'Asistente Capitán'],
    ['Leones', 'Sub-21', '3', 'Pedro', 'Salas', 'Jugador'],
    ['Sharks', 'Sub-21', '11', 'Elena', 'Vargas', 'Arquero'],
  ])
  XLSX.utils.book_append_sheet(workbook, playerSheet, PLAYER_SHEET)

  return XLSX.write(workbook, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer
}

export async function parseTournamentImportFile(
  file: File,
): Promise<TournamentImportPayload> {
  const name = file.name.toLowerCase()

  if (name.endsWith('.csv')) {
    const text = await file.text()
    return {
      matches: parseCsv(text),
      players: [],
    }
  }

  if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })

    const matchSheetName =
      workbook.SheetNames.find((n) => n.toLowerCase() === MATCH_SHEET.toLowerCase()) ??
      workbook.SheetNames[0]
    if (!matchSheetName || !workbook.Sheets[matchSheetName]) {
      throw new Error('No se encontró la hoja de Calendario en el archivo.')
    }

    const matches = parseMatchObjects(sheetToObjects(workbook.Sheets[matchSheetName]!))

    const playerSheetName = workbook.SheetNames.find(
      (n) => n.toLowerCase() === PLAYER_SHEET.toLowerCase(),
    )
    const players =
      playerSheetName && workbook.Sheets[playerSheetName]
        ? parsePlayerObjects(sheetToObjects(workbook.Sheets[playerSheetName]!))
        : []

    return { matches, players }
  }

  throw new Error('Formato no soportado. Usa .xlsx (recomendado) o .csv solo de calendario.')
}
