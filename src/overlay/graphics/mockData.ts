import { overlayCrest } from '@/overlay/graphics/crest'
import type {
  OverlayBreakModel,
  OverlayLineupModel,
  OverlayLineupPlayer,
} from '@/overlay/graphics/types'

function players(
  rows: Array<[string, string, OverlayLineupPlayer['role']?]>,
): OverlayLineupPlayer[] {
  return rows.map(([number, name, role]) => ({
    number,
    name,
    role: role ?? 'player',
  }))
}

const hockeyLocal = {
  name: 'Star Lions',
  shortName: 'Lions',
  logo: overlayCrest('L', '#1b4b8a'),
  color: '#3da5ff',
  score: 2,
}

const hockeyVisit = {
  name: 'Night Hawks',
  shortName: 'Hawks',
  logo: overlayCrest('H', '#8a1f14'),
  color: '#ff5a36',
  score: 1,
}

const footballLocal = {
  name: 'Atlético Norte',
  shortName: 'Norte',
  logo: overlayCrest('N', '#0b6e4f'),
  color: '#0b6e4f',
  score: 2,
}

const footballVisit = {
  name: 'Real Sur',
  shortName: 'Sur',
  logo: overlayCrest('S', '#c1121f'),
  color: '#c1121f',
  score: 1,
}

const futsalLocal = {
  name: 'Metro FC',
  shortName: 'Metro',
  logo: overlayCrest('M', '#1256a8'),
  color: '#3da5ff',
  score: 3,
}

const futsalVisit = {
  name: 'Costa Azul',
  shortName: 'Costa',
  logo: overlayCrest('C', '#b45309'),
  color: '#f59e0b',
  score: 2,
}

const basketballLocal = {
  name: 'Titanes',
  shortName: 'Titanes',
  logo: overlayCrest('T', '#4338ca'),
  color: '#818cf8',
  score: 21,
}

const basketballVisit = {
  name: 'Cóndores',
  shortName: 'Cóndores',
  logo: overlayCrest('C', '#9a3412'),
  color: '#fb923c',
  score: 18,
}

export const PLAYGROUND_LINEUPS: Record<OverlayLineupModel['sport'], OverlayLineupModel> = {
  hockey: {
    sport: 'hockey',
    sportLabel: 'Hockey en línea',
    category: 'Liga Apertura',
    local: hockeyLocal,
    visit: hockeyVisit,
    localRoster: players([
      ['1', 'Martín Rivas', 'goalkeeper'],
      ['4', 'Diego Soto', 'captain'],
      ['7', 'Lucas Peña', 'assistant_captain'],
      ['9', 'Tomás Vidal'],
      ['11', 'Nicolás Bravo'],
      ['14', 'Facundo Ruiz'],
      ['17', 'Iván Castro'],
      ['19', 'Ramiro Díaz'],
      ['22', 'Emiliano Paz'],
      ['27', 'Santiago Mora'],
    ]),
    visitRoster: players([
      ['31', 'Pablo Herrera', 'goalkeeper'],
      ['5', 'Julián Ortiz', 'captain'],
      ['8', 'Andrés Vega'],
      ['10', 'Matías Gómez'],
      ['12', 'Leo Navarro'],
      ['15', 'Cristian Melo'],
      ['18', 'Esteban Ríos'],
      ['21', 'Hugo Paredes'],
      ['24', 'Kevin Silva'],
      ['29', 'Bruno Acosta'],
    ]),
  },
  football: {
    sport: 'football',
    sportLabel: 'Fútbol',
    category: 'Copa Ciudad',
    local: footballLocal,
    visit: footballVisit,
    localRoster: players([
      ['1', 'Alan Duarte', 'goalkeeper'],
      ['2', 'Enzo Paredes'],
      ['3', 'Ramiro Solís'],
      ['4', 'Iván López', 'captain'],
      ['6', 'Marcos Benítez'],
      ['8', 'Thiago Roldán'],
      ['7', 'Luciano Díaz'],
      ['10', 'Franco Pérez'],
      ['9', 'Julián Castro'],
      ['11', 'Brian Molina'],
      ['19', 'Gastón Vera'],
      ['21', 'Nahuel Ortiz'],
      ['23', 'Ezequiel Ramos'],
    ]),
    visitRoster: players([
      ['12', 'Kevin Soto', 'goalkeeper'],
      ['13', 'Pablo Núñez'],
      ['5', 'Óscar Medina', 'captain'],
      ['16', 'Luis Cabrera'],
      ['18', 'Daniel Rojas'],
      ['20', 'Camilo Fuentes'],
      ['8', 'Sebastián Ruiz'],
      ['10', 'Andrés Gómez'],
      ['9', 'Miguel Torres'],
      ['7', 'Pedro Álvarez'],
      ['22', 'Nicolás Ibarra'],
      ['14', 'Héctor Salas'],
    ]),
  },
  futsal: {
    sport: 'futsal',
    sportLabel: 'Futsal',
    category: 'Metropolitano',
    local: futsalLocal,
    visit: futsalVisit,
    localRoster: players([
      ['1', 'Leo Aguirre', 'goalkeeper'],
      ['2', 'Maxi Flores'],
      ['4', 'Cristian Soto', 'captain'],
      ['7', 'Damián Ruiz'],
      ['9', 'Pablo Ferrari'],
      ['10', 'Nacho Varela'],
      ['12', 'Tomi Herrera', 'goalkeeper'],
      ['14', 'Alex Correa'],
      ['17', 'Renzo Paz'],
    ]),
    visitRoster: players([
      ['1', 'Hugo Benítez', 'goalkeeper'],
      ['3', 'Fede Molina'],
      ['5', 'Lucas Gaitán', 'captain'],
      ['8', 'Marco Díaz'],
      ['9', 'Santi López'],
      ['11', 'Ian Romero'],
      ['13', 'Brian Acosta'],
      ['15', 'Joel Núñez'],
      ['18', 'Kevin Pinto'],
    ]),
  },
  basketball: {
    sport: 'basketball',
    sportLabel: 'Básquetbol',
    category: 'Liga Federal',
    local: basketballLocal,
    visit: basketballVisit,
    localRoster: players([
      ['4', 'Mateo Cruz', 'captain'],
      ['5', 'Agustín Ríos'],
      ['7', 'Joaquín Pérez'],
      ['9', 'Lautaro Vega'],
      ['11', 'Facundo Silva'],
      ['13', 'Ignacio Torres'],
      ['15', 'Benjamín Díaz'],
      ['21', 'Simón Herrera'],
      ['24', 'Valentín Mora'],
      ['32', 'Thiago Castro'],
    ]),
    visitRoster: players([
      ['3', 'Ramiro López'],
      ['6', 'Emiliano Paz', 'captain'],
      ['8', 'Nicolás Bravo'],
      ['10', 'Julián Soto'],
      ['12', 'Tomás Acosta'],
      ['14', 'Luca Navarro'],
      ['20', 'Franco Méndez'],
      ['23', 'Alan Ruiz'],
      ['30', 'Iván Gómez'],
      ['33', 'Pedro Vidal'],
    ]),
  },
}

export const PLAYGROUND_BREAKS: Record<OverlayBreakModel['sport'], OverlayBreakModel> = {
  hockey: {
    sport: 'hockey',
    sportLabel: 'Hockey en línea',
    heading: 'Descanso · 1P',
    local: hockeyLocal,
    visit: hockeyVisit,
    stats: [
      { key: 'saves', label: 'Atajadas', local: '8', visit: '5' },
      { key: 'shots', label: 'Tiros al arco', local: '14', visit: '9' },
      { key: 'fouls', label: 'Faltas', local: '3', visit: '4' },
      { key: 'pp', label: 'Power play', local: '1/3', visit: '0/2' },
      { key: 'pim', label: 'Min. penalidad', local: '4:30', visit: '6:00' },
    ],
    scorers: {
      local: [
        { number: '9', player: 'Tomás Vidal', minute: '04:18' },
        { number: '7', player: 'Lucas Peña', minute: '12:41' },
      ],
      visit: [{ number: '10', player: 'Matías Gómez', minute: '08:02' }],
    },
    fouls: {
      local: [
        { number: '14', player: 'Facundo Ruiz', minute: '06:20', extra: 'Menor 1:30' },
        { number: '19', player: 'Ramiro Díaz', minute: '15:10', extra: 'Menor 1:30' },
      ],
      visit: [
        { number: '8', player: 'Andrés Vega', minute: '03:44', extra: 'Menor 1:30' },
        { number: '12', player: 'Leo Navarro', minute: '11:05', extra: 'Doble menor' },
      ],
    },
  },
  football: {
    sport: 'football',
    sportLabel: 'Fútbol',
    heading: 'Descanso · 1T',
    local: footballLocal,
    visit: footballVisit,
    stats: [
      { key: 'saves', label: 'Atajadas', local: '4', visit: '3' },
      { key: 'fouls', label: 'Faltas', local: '8', visit: '11' },
      { key: 'yellow', label: 'Amarillas', local: '1', visit: '2' },
      { key: 'red', label: 'Rojas', local: '0', visit: '1' },
    ],
    scorers: {
      local: [
        { number: '9', player: 'Julián Castro', minute: "12'" },
        { number: '10', player: 'Franco Pérez', minute: "38'" },
      ],
      visit: [{ number: '9', player: 'Miguel Torres', minute: "29'" }],
    },
    cards: {
      local: [{ number: '4', player: 'Iván López', minute: "34'", kind: 'yellow' }],
      visit: [
        { number: '16', player: 'Luis Cabrera', minute: "22'", kind: 'yellow' },
        { number: '8', player: 'Sebastián Ruiz', minute: "41'", kind: 'red' },
      ],
    },
  },
  futsal: {
    sport: 'futsal',
    sportLabel: 'Futsal',
    heading: 'Descanso · 1T',
    local: futsalLocal,
    visit: futsalVisit,
    stats: [
      { key: 'saves', label: 'Atajadas', local: '6', visit: '4' },
      { key: 'fouls', label: 'Faltas acum.', local: '3', visit: '5' },
      { key: 'to', label: 'Tiempos muertos', local: '1', visit: '1' },
    ],
    scorers: {
      local: [
        { number: '9', player: 'Pablo Ferrari', minute: '03:12' },
        { number: '7', player: 'Damián Ruiz', minute: '11:40' },
        { number: '10', player: 'Nacho Varela', minute: '18:05' },
      ],
      visit: [
        { number: '9', player: 'Santi López', minute: '07:22' },
        { number: '11', player: 'Ian Romero', minute: '15:58' },
      ],
    },
    cards: {
      local: [{ number: '4', player: 'Cristian Soto', minute: '14:20', kind: 'yellow' }],
      visit: [
        { number: '5', player: 'Lucas Gaitán', minute: '09:10', kind: 'blue' },
        { number: '8', player: 'Marco Díaz', minute: '19:44', kind: 'yellow' },
      ],
    },
  },
  basketball: {
    sport: 'basketball',
    sportLabel: 'Básquetbol',
    heading: 'Descanso · 1T',
    local: basketballLocal,
    visit: basketballVisit,
    stats: [
      { key: 'fouls', label: 'Faltas de equipo', local: '4', visit: '3' },
      { key: 'rebounds', label: 'Rebotes', local: '7', visit: '5' },
    ],
    scorers: {
      local: [
        { number: '7', player: 'Joaquín Pérez', minute: '08:12', extra: '+3' },
        { number: '4', player: 'Mateo Cruz', minute: '05:40', extra: '+2' },
        { number: '11', player: 'Facundo Silva', minute: '02:18', extra: '+2' },
      ],
      visit: [
        { number: '10', player: 'Julián Soto', minute: '07:55', extra: '+3' },
        { number: '6', player: 'Emiliano Paz', minute: '04:22', extra: '+2' },
      ],
    },
    fouls: {
      local: [
        { number: '5', player: 'Agustín Ríos', minute: '06:10', extra: 'Personal' },
        { number: '9', player: 'Lautaro Vega', minute: '03:33', extra: 'Personal' },
      ],
      visit: [
        { number: '8', player: 'Nicolás Bravo', minute: '09:01', extra: 'En ataque' },
        { number: '12', player: 'Tomás Acosta', minute: '01:48', extra: 'Personal' },
      ],
    },
  },
}

export const PLAYGROUND_FINALS: Record<OverlayBreakModel['sport'], OverlayBreakModel> = {
  hockey: {
    ...PLAYGROUND_BREAKS.hockey,
    heading: 'Final del partido',
    local: { ...hockeyLocal, score: 11 },
    visit: { ...hockeyVisit, score: 9 },
    stats: [
      { key: 'saves', label: 'Atajadas', local: '21', visit: '16' },
      { key: 'shots', label: 'Tiros al arco', local: '32', visit: '24' },
      { key: 'fouls', label: 'Faltas', local: '7', visit: '9' },
      { key: 'pp', label: 'Power play', local: '2/5', visit: '1/4' },
      { key: 'pim', label: 'Min. penalidad', local: '9:00', visit: '12:00' },
    ],
    scorers: {
      local: [
        ...PLAYGROUND_BREAKS.hockey.scorers.local,
        { number: '11', player: 'Nicolás Bravo', minute: '02:10' },
        { number: '9', player: 'Tomás Vidal', minute: '05:44' },
        { number: '17', player: 'Iván Castro', minute: '08:14' },
        { number: '4', player: 'Diego Soto', minute: '11:02' },
        { number: '22', player: 'Emiliano Paz', minute: '13:38' },
        { number: '27', player: 'Santiago Mora', minute: '15:21' },
        { number: '7', player: 'Lucas Peña', minute: '17:02' },
        { number: '14', player: 'Facundo Ruiz', minute: '18:47' },
        { number: '19', player: 'Ramiro Díaz', minute: '19:33' },
      ],
      visit: [
        ...PLAYGROUND_BREAKS.hockey.scorers.visit,
        { number: '8', player: 'Andrés Vega', minute: '01:22' },
        { number: '12', player: 'Leo Navarro', minute: '04:09' },
        { number: '21', player: 'Hugo Paredes', minute: '06:51' },
        { number: '5', player: 'Julián Ortiz', minute: '09:18' },
        { number: '15', player: 'Cristian Melo', minute: '11:33' },
        { number: '24', player: 'Kevin Silva', minute: '14:07' },
        { number: '29', player: 'Bruno Acosta', minute: '16:40' },
        { number: '10', player: 'Matías Gómez', minute: '18:12' },
      ],
    },
    fouls: {
      local: [
        ...PLAYGROUND_BREAKS.hockey.fouls.local,
        { number: '4', player: 'Diego Soto', minute: '01:55', extra: 'Menor 1:30' },
        { number: '11', player: 'Nicolás Bravo', minute: '04:12', extra: 'Doble menor' },
        { number: '17', player: 'Iván Castro', minute: '07:40', extra: 'Menor 1:30' },
        { number: '22', player: 'Emiliano Paz', minute: '10:08', extra: 'Mayor 5:00' },
        { number: '27', player: 'Santiago Mora', minute: '12:33', extra: 'Menor 1:30' },
        { number: '7', player: 'Lucas Peña', minute: '15:19', extra: 'Menor 1:30' },
        { number: '9', player: 'Tomás Vidal', minute: '17:28', extra: 'Doble menor' },
        { number: '1', player: 'Martín Rivas', minute: '19:05', extra: 'Menor 1:30' },
      ],
      visit: [
        ...PLAYGROUND_BREAKS.hockey.fouls.visit,
        { number: '5', player: 'Julián Ortiz', minute: '02:18', extra: 'Menor 1:30' },
        { number: '15', player: 'Cristian Melo', minute: '05:01', extra: 'Menor 1:30' },
        { number: '18', player: 'Esteban Ríos', minute: '07:44', extra: 'Mayor 5:00' },
        { number: '21', player: 'Hugo Paredes', minute: '09:27', extra: 'Menor 1:30' },
        { number: '24', player: 'Kevin Silva', minute: '12:15', extra: 'Doble menor' },
        { number: '29', player: 'Bruno Acosta', minute: '14:50', extra: 'Menor 1:30' },
        { number: '10', player: 'Matías Gómez', minute: '16:36', extra: 'Menor 1:30' },
        { number: '31', player: 'Pablo Herrera', minute: '18:22', extra: 'Menor 1:30' },
        { number: '8', player: 'Andrés Vega', minute: '19:41', extra: 'Menor 1:30' },
      ],
    },
  },
  football: {
    ...PLAYGROUND_BREAKS.football,
    heading: 'Final del partido',
    local: { ...footballLocal, score: 3 },
    visit: { ...footballVisit, score: 1 },
    stats: [
      { key: 'saves', label: 'Atajadas', local: '7', visit: '5' },
      { key: 'fouls', label: 'Faltas', local: '14', visit: '17' },
      { key: 'yellow', label: 'Amarillas', local: '2', visit: '3' },
      { key: 'red', label: 'Rojas', local: '0', visit: '1' },
    ],
    scorers: {
      local: [
        ...PLAYGROUND_BREAKS.football.scorers.local,
        { number: '7', player: 'Luciano Díaz', minute: "67'" },
      ],
      visit: PLAYGROUND_BREAKS.football.scorers.visit,
    },
    cards: {
      local: [
        { number: '4', player: 'Iván López', minute: "34'", kind: 'yellow' },
        { number: '6', player: 'Marcos Benítez', minute: "71'", kind: 'yellow' },
      ],
      visit: PLAYGROUND_BREAKS.football.cards?.visit ?? [],
    },
  },
  futsal: {
    ...PLAYGROUND_BREAKS.futsal,
    heading: 'Final del partido',
    local: { ...futsalLocal, score: 5 },
    visit: { ...futsalVisit, score: 4 },
    stats: [
      { key: 'saves', label: 'Atajadas', local: '11', visit: '9' },
      { key: 'fouls', label: 'Faltas acum.', local: '6', visit: '8' },
      { key: 'to', label: 'Tiempos muertos', local: '2', visit: '2' },
    ],
    scorers: {
      local: [
        ...PLAYGROUND_BREAKS.futsal.scorers.local,
        { number: '9', player: 'Pablo Ferrari', minute: '08:40' },
        { number: '14', player: 'Alex Correa', minute: '17:11' },
      ],
      visit: [
        ...PLAYGROUND_BREAKS.futsal.scorers.visit,
        { number: '8', player: 'Marco Díaz', minute: '04:02' },
        { number: '9', player: 'Santi López', minute: '19:28' },
      ],
    },
  },
  basketball: {
    ...PLAYGROUND_BREAKS.basketball,
    heading: 'Final del partido',
    local: { ...basketballLocal, score: 78 },
    visit: { ...basketballVisit, score: 71 },
    stats: [
      { key: 'fouls', label: 'Faltas de equipo', local: '16', visit: '18' },
      { key: 'rebounds', label: 'Rebotes', local: '31', visit: '27' },
    ],
    scorers: {
      local: [
        ...PLAYGROUND_BREAKS.basketball.scorers.local,
        { number: '7', player: 'Joaquín Pérez', minute: '02:10', extra: '+3' },
        { number: '32', player: 'Thiago Castro', minute: '05:44', extra: '+2' },
      ],
      visit: [
        ...PLAYGROUND_BREAKS.basketball.scorers.visit,
        { number: '33', player: 'Pedro Vidal', minute: '01:18', extra: '+2' },
        { number: '10', player: 'Julián Soto', minute: '06:02', extra: '+3' },
      ],
    },
  },
}
