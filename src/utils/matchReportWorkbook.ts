import * as XLSX from 'xlsx'
import type { MatchReport } from '@/utils/matchReport'
import { awardsByCategory, type PlayerStatLine } from '@/utils/playerStats'

function summaryRows(report: MatchReport): (string | number)[][] {
  const { meta } = report
  return [
    ['Campo', 'Valor'],
    ['Local', meta.localTeam],
    ['Visita', meta.visitTeam],
    ['Categoría', meta.category || '—'],
    ['Cancha', meta.court || '—'],
    ['Estado', meta.status],
    ['Marcador', `${report.goalLocal} - ${report.goalVisit}`],
    ['Periodo', report.gamePeriod || '—'],
    ['Tiros local', report.shotsMissLocal],
    ['Tiros visita', report.shotsMissVisit],
    ['Atajadas local', report.savesLocal],
    ['Atajadas visita', report.savesVisit],
  ]
}

function goalsRows(report: MatchReport): (string | number)[][] {
  return [
    ['Equipo', 'Periodo', 'Minuto', 'Autor', 'Asistencia', 'Estado'],
    ...report.goals.map((row) => [
      row.teamName,
      row.period,
      row.gameMinute,
      row.scorer,
      row.assist,
      row.status,
    ]),
  ]
}

function shotsRows(report: MatchReport): (string | number)[][] {
  return [
    ['Equipo', 'Tipo', 'Periodo', 'Minuto'],
    ...report.shots.map((row) => [
      row.teamName,
      row.resultLabel,
      row.period,
      row.gameMinute,
    ]),
  ]
}

function awardsRows(report: MatchReport): (string | number)[][] {
  const { awards } = report
  const row = (
    title: string,
    winner: { label: string; team: string; value: number } | null,
  ): (string | number)[] =>
    winner
      ? [title, winner.label, winner.team, winner.value]
      : [title, '—', '—', 0]

  return [
    ['Premio', 'Jugador', 'Equipo', 'Cantidad'],
    row('Goleador', awards.topScorer),
    row('Mejor jugador (asistencias)', awards.topAssists),
    row('Mejor portero (atajadas)', awards.topGoalkeeper),
  ]
}

function playersRows(report: MatchReport): (string | number)[][] {
  return [
    ['Equipo', 'Jugador', 'Goles', 'Asistencias', 'Atajadas'],
    ...report.playerStats.map((player) => [
      player.team,
      player.label,
      player.goals,
      player.assists,
      player.saves,
    ]),
  ]
}

function penaltiesRows(report: MatchReport): (string | number)[][] {
  return [
    ['Equipo', 'Jugador', 'Tipo', 'Infracción', 'Tiempo'],
    ...report.penalties.map((row) => [
      row.teamName,
      row.player,
      row.type,
      row.infraction,
      row.time,
    ]),
  ]
}

function appendMatchSheets(workbook: XLSX.WorkBook, report: MatchReport, prefix = ''): void {
  const p = prefix ? `${prefix} ` : ''
  const sheets: Array<{ name: string; rows: (string | number)[][] }> = [
    { name: `${p}Resumen`, rows: summaryRows(report) },
    { name: `${p}Destacados`, rows: awardsRows(report) },
    { name: `${p}Jugadores`, rows: playersRows(report) },
    { name: `${p}Goles`, rows: goalsRows(report) },
    { name: `${p}Tiros`, rows: shotsRows(report) },
    { name: `${p}Penalidades`, rows: penaltiesRows(report) },
  ]

  for (const sheet of sheets) {
    const ws = XLSX.utils.aoa_to_sheet(sheet.rows)
    XLSX.utils.book_append_sheet(workbook, ws, sanitizeSheetName(sheet.name))
  }
}

/** Excel limita nombres de hoja a 31 caracteres y no admite \\ / ? * [ ]. */
export function sanitizeSheetName(name: string, used = new Set<string>()): string {
  let base = name.replace(/[\\/?*[\]:]/g, '-').trim() || 'Hoja'
  if (base.length > 31) base = base.slice(0, 31)
  let candidate = base
  let i = 2
  while (used.has(candidate.toLowerCase())) {
    const suffix = ` (${i})`
    candidate = `${base.slice(0, Math.max(1, 31 - suffix.length))}${suffix}`
    i += 1
  }
  used.add(candidate.toLowerCase())
  return candidate
}

export function buildMatchWorkbook(report: MatchReport): ArrayBuffer {
  const workbook = XLSX.utils.book_new()
  appendMatchSheets(workbook, report)
  return XLSX.write(workbook, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer
}

/** Top 3 por categoría: goleador, asistencias y arquero. */
function tournamentAwardsRows(reports: MatchReport[]): (string | number)[][] {
  const categories = awardsByCategory(
    reports.map((report) => ({
      category: report.meta.category,
      lines: report.playerStats,
    })),
    3,
  )

  const rows: (string | number)[][] = [
    ['Categoría', 'Premio', 'Puesto', 'Jugador', 'Equipo', 'Cantidad'],
  ]

  const appendBlock = (
    category: string,
    title: string,
    lines: PlayerStatLine[],
    metric: 'goals' | 'assists' | 'saves',
  ): void => {
    if (lines.length === 0) {
      rows.push([category, title, '—', 'Sin datos', '—', 0])
      return
    }
    lines.forEach((line, index) => {
      rows.push([category, title, index + 1, line.label, line.team, line[metric]])
    })
  }

  for (const entry of categories) {
    appendBlock(entry.category, 'Goleador', entry.topScorers, 'goals')
    appendBlock(entry.category, 'Mejor jugador (asistencias)', entry.topAssists, 'assists')
    appendBlock(entry.category, 'Mejor portero (atajadas)', entry.topGoalkeepers, 'saves')
    rows.push([])
  }

  return rows
}

export function buildTournamentWorkbook(
  tournamentName: string,
  reports: MatchReport[],
): ArrayBuffer {
  const workbook = XLSX.utils.book_new()
  const usedNames = new Set<string>()

  const overview: (string | number)[][] = [
    ['Torneo', tournamentName],
    [],
    [
      'Local',
      'Visita',
      'Categoría',
      'Cancha',
      'Estado',
      'Goles L',
      'Goles V',
      'Tiros L',
      'Tiros V',
      'Atajadas L',
      'Atajadas V',
    ],
    ...reports.map((r) => [
      r.meta.localTeam,
      r.meta.visitTeam,
      r.meta.category || '—',
      r.meta.court || '—',
      r.meta.status,
      r.goalLocal,
      r.goalVisit,
      r.shotsMissLocal,
      r.shotsMissVisit,
      r.savesLocal,
      r.savesVisit,
    ]),
  ]
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet(overview),
    sanitizeSheetName('Resumen', usedNames),
  )

  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet(tournamentAwardsRows(reports)),
    sanitizeSheetName('Destacados', usedNames),
  )

  reports.forEach((report, index) => {
    const label = `${index + 1} ${report.meta.localTeam} vs ${report.meta.visitTeam}`
    const sheetName = sanitizeSheetName(label, usedNames)
    const rows = [
      ...summaryRows(report),
      [],
      ['Destacados'],
      ...awardsRows(report),
      [],
      ['Jugadores'],
      ...playersRows(report),
      [],
      ['Goles'],
      ...goalsRows(report),
      [],
      ['Tiros y atajadas'],
      ...shotsRows(report),
      [],
      ['Penalidades'],
      ...penaltiesRows(report),
    ]
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet(rows),
      sheetName,
    )
  })

  return XLSX.write(workbook, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer
}

export function downloadWorkbookBuffer(buffer: ArrayBuffer, filename: string): void {
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function matchReportFilename(report: MatchReport): string {
  const safe = (value: string) =>
    value.replace(/[^\w\-à-üÀ-Ü]+/gi, '_').replace(/_+/g, '_').slice(0, 40)
  return `informe_${safe(report.meta.localTeam)}_vs_${safe(report.meta.visitTeam)}.xlsx`
}

export function tournamentReportFilename(tournamentName: string): string {
  const safe = tournamentName.replace(/[^\w\-à-üÀ-Ü]+/gi, '_').replace(/_+/g, '_').slice(0, 50)
  return `informes_${safe || 'torneo'}.xlsx`
}
