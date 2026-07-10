# Marcador Hockey en Línea

Plataforma web de marcadores deportivos en vivo para **hockey en línea (inline)**. Permite a organizadores operar partidos desde una mesa de control, mostrarlos en pantalla TV/OBS y compartir enlaces públicos para espectadores.

> Este documento es la guía de arranque para un **proyecto nuevo**. Está basado en [marker-board](../README.md) y enfocado exclusivamente en hockey. La arquitectura deja espacio para agregar otros deportes en el futuro sin reescribir el núcleo.

---

## Tabla de contenidos

- [Características](#características)
- [Stack tecnológico](#stack-tecnológico)
- [Requisitos previos](#requisitos-previos)
- [Crear el proyecto desde cero](#crear-el-proyecto-desde-cero)
- [Configurar Supabase](#configurar-supabase)
- [Variables de entorno](#variables-de-entorno)
- [Desarrollo local](#desarrollo-local)
- [Rutas de la aplicación](#rutas-de-la-aplicación)
- [Arquitectura](#arquitectura)
- [Modelo de datos](#modelo-de-datos)
- [Sincronización en tiempo real](#sincronización-en-tiempo-real)
- [Torneos](#torneos)
- [Deploy en GitHub Pages](#deploy-en-github-pages)
- [Extensibilidad para otros deportes](#extensibilidad-para-otros-deportes)
- [Roadmap MVP](#roadmap-mvp)

---

## Características

### MVP — Hockey en línea

- Marcador con goles, periodos, cronómetro descendente y penalidades
- Mesa de control + marcador TV (sync local entre pestañas)
- Live público y overlay para OBS (sin login)
- Listado de partidos "En vivo ahora"
- Torneos con calendario CSV, múltiples canchas y URLs fijas de transmisión
- Tabla de posiciones (3 pts victoria, 1 empate, 0 derrota)
- Autenticación con roles: **organizador** y **espectador**

### Usuarios

| Rol | Permisos |
|-----|----------|
| **Espectador** | Ver marcadores en vivo y torneos públicos. No opera la mesa. |
| **Organizador** | Crear partidos y torneos, operar controles, importar calendarios CSV. |

Los marcadores públicos funcionan **sin iniciar sesión**.

---

## Stack tecnológico

| Capa | Tecnología |
|------|------------|
| Frontend | Vue 3, TypeScript, Vite |
| Estado | Pinia |
| Routing | Vue Router |
| UI | Ant Design Vue 4 |
| Backend | Supabase (PostgreSQL + Auth + REST) |
| Deploy | GitHub Actions → GitHub Pages |

No hay servidor propio. Toda la lógica vive en el cliente; la seguridad depende de **Row Level Security (RLS)** en Supabase.

---

## Requisitos previos

- Node.js 20+
- [corepack](https://nodejs.org/api/corepack.html) habilitado (`corepack enable`)
- Cuenta en [Supabase](https://supabase.com) (tier gratuito suficiente para empezar)
- Cuenta en GitHub (para deploy)

---

## Crear el proyecto desde cero

### 1. Scaffold con Vite

```bash
yarn create vite marcador-hockey --template vue-ts
cd marcador-hockey
```

### 2. Instalar dependencias

```bash
corepack yarn add vue-router pinia @supabase/supabase-js ant-design-vue dayjs
corepack yarn add -D sass-embedded unplugin-vue-components
```

### 3. Estructura de carpetas sugerida

```
src/
├── views/           # Páginas por ruta
├── components/      # UI reutilizable (marcador, auth, torneos)
├── services/        # Supabase, sync, torneos, auth
├── stores/          # Pinia (auth, scoreboard)
├── composables/     # Lógica reutilizable (remote board, torneos)
├── types/           # Tipos TypeScript
├── utils/           # Relojes, sync local, CSV, standings
├── config/          # Intervalo de poll
└── routes/          # Definición del router

supabase/            # Migraciones SQL
public/              # Assets estáticos + plantilla CSV
```

### 4. Configurar Vite

En `vite.config.ts`, ajusta el `base` según el nombre del repositorio en GitHub Pages:

```typescript
export default defineConfig({
  base: '/marcador-hockey/', // cambiar por el nombre del repo
  // ...
});
```

### 5. Copiar referencia de marker-board

Este repositorio ([marker-board](../README.md)) sirve como referencia de implementación. Los archivos clave a revisar:

| Archivo | Propósito |
|---------|-----------|
| `src/views/Controls.vue` | Mesa de control |
| `src/components/ScoreBoard.vue` | Marcador TV |
| `src/services/matchSync.ts` | Sync hockey |
| `src/services/liveMatchesService.ts` | Listado y publicación |
| `src/services/tournamentService.ts` | Lógica de torneos |
| `src/composables/useRemoteHockeyBoardCore.ts` | Poll + reloj interpolado |
| `supabase/*.sql` | Esquema completo de BD |

---

## Configurar Supabase

### 1. Crear proyecto

1. [supabase.com](https://supabase.com) → New project
2. Anota **Project URL** y **anon/public key** (Settings → API)

### 2. Activar autenticación por email

Authentication → Providers → **Email** → habilitar.

### 3. Ejecutar migraciones SQL

En el **SQL Editor**, ejecutar en este orden:

| Orden | Archivo | Contenido |
|-------|---------|-----------|
| 1 | `schema.sql` | `profiles`, `matches`, trigger de registro |
| 2 | `tournaments.sql` | `tournaments`, `tournament_matches` |
| 3 | `tournament-results.sql` | Resultados finales, `finished_at` |
| 4 | `tournament-live.sql` | `live_match_id` en torneos (legacy) |
| 5 | `tournament-courts.sql` | Canchas + `tournament_court_streams` |
| 6 | `tournament-sport-visibility.sql` | `sport` y `visibility` en torneos |

Los archivos SQL de referencia están en la carpeta [`supabase/`](../supabase/) de marker-board.

### 4. No habilitar Realtime

La app usa solo **REST con polling**. No es necesario activar Replication/Realtime en Supabase.

### 5. Reset de datos (opcional)

Para vaciar partidos y torneos sin borrar cuentas de usuario:

```sql
-- Ver supabase/reset-app-data.sql
```

---

## Variables de entorno

Copia `.env.example` a `.env` y completa los valores:

```bash
cp .env.example .env
```

```bash
VITE_SUPABASE_URL=https://TU_PROYECTO.supabase.co
VITE_SUPABASE_ANON_KEY=TU_CLAVE_ANON_O_PUBLISHABLE
VITE_POLL_INTERVAL_MS=5000
```

| Variable | Descripción |
|----------|-------------|
| `VITE_SUPABASE_URL` | URL del proyecto Supabase |
| `VITE_SUPABASE_ANON_KEY` | Clave anon o publishable (Settings → API) |
| `VITE_POLL_INTERVAL_MS` | Intervalo de poll REST en ms. Mínimo `1000`, por defecto `5000` |

> La clave anon se incluye en el JS del navegador. No commitear el archivo `.env`.

---

## Desarrollo local

```bash
corepack yarn install
corepack yarn dev
```

Abre `http://localhost:5173` (o el puerto que indique Vite).

### Scripts disponibles

```bash
corepack yarn dev       # Servidor de desarrollo
corepack yarn build     # Build de producción (vue-tsc + vite)
corepack yarn preview   # Preview del build local
```

---

## Rutas de la aplicación

### Públicas (sin login)

| Ruta | Descripción |
|------|-------------|
| `/` | Inicio — partidos en vivo, login/registro |
| `/live/:matchId` | Marcador público |
| `/overlay/:matchId` | Overlay para OBS (sin chrome) |
| `/live/torneo/:tournamentId/:court` | Live fijo por cancha de torneo |
| `/torneo/:id` | Vista pública del torneo |
| `/torneos-publicos` | Listado de torneos públicos |

### Operador (requiere rol `organizer`)

| Ruta | Descripción |
|------|-------------|
| `/board` | Marcador TV (pantalla de cancha) |
| `/controls` | Mesa de control del partido |
| `/tournaments` | Gestión de torneos |
| `/tournaments/:id` | Detalle, plantilla CSV, calendario |

### Flujo de partido suelto

1. Organizador → "Crear partido" en Inicio
2. Se genera `matchId` automático (ej. `partido-m5abc123`)
3. Se abren dos pestañas: **Controles** y **Marcador TV**
4. El operador modifica goles, reloj, penalidades → sync local + remoto
5. Comparte `/live/:matchId` o `/overlay/:matchId`

---

## Arquitectura

```
┌─────────────────────────────────────────────────────────┐
│                  NAVEGADOR (Vue SPA)                     │
│                                                          │
│  Home ── Controles ── Marcador TV ── Live/OBS           │
│                    │                                     │
│         Pinia stores + localStorage                      │
│         (sync local entre pestañas)                      │
└────────────────────┼────────────────────────────────────┘
                     │ REST (polling, sin WebSocket)
                     ▼
         ┌───────────────────────┐
         │      Supabase         │
         │  PostgreSQL + Auth    │
         │  PostgREST (RLS)      │
         └───────────────────────┘
```

### Principios de diseño

1. **Estado dual local/remoto** — Controles escriben en `localStorage` (misma máquina) y publican a Supabase (espectadores remotos).
2. **Reloj interpolado** — El servidor guarda `timeGame`, `isPaused`, `updatedAt`; el cliente calcula el tiempo entre polls.
3. **Estado en JSONB** — Toda la lógica de juego vive en `matches.state`; columnas SQL son metadatos.
4. **Writer lock** — Solo la pestaña de Controles hace tick del reloj.
5. **Sin Realtime** — Polling REST para minimizar costos de Supabase.

### Servicios frontend

```
src/services/
├── supabaseClient.ts         # Cliente Supabase (auth, queries)
├── supabaseRest.ts           # GET/PATCH/POST directo a PostgREST
├── authService.ts            # Login, registro, perfiles
├── liveMatchesService.ts     # Listado "en vivo", publicación
├── matchSync.ts              # fetchMatchState / publishMatchState
├── tournamentService.ts      # CRUD torneos, CSV, iniciar/finalizar
└── tournamentCourtStream.ts  # Streams fijos por cancha
```

---

## Modelo de datos

### Diagrama

```
auth.users
    └── profiles (organizer | spectator)
            └── tournaments
                    ├── tournament_matches
                    └── tournament_court_streams
                            └── matches (state JSONB)
```

### Tablas principales

**`profiles`** — Perfil vinculado a Supabase Auth.

**`matches`** — Núcleo del marcador.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | text PK | Ej. `partido-m5abc123` |
| `state` | jsonb | Estado completo del marcador |
| `updated_at` | timestamptz | Última actualización |
| `title` | text | Título para listados |
| `organizer_id` | uuid | FK → profiles |
| `is_live` | boolean | Visible en "En vivo" |
| `tournament_id` | uuid | FK → tournaments (opcional) |
| `court` | text | Cancha (torneos) |
| `goal_local`, `goal_visit` | integer | Marcador final |
| `finished_at` | timestamptz | Fin del partido |
| `sport` | text | Default `'hockey'` |

**`tournaments`** — Torneos del organizador (nombre, fechas, visibilidad, estado).

**`tournament_matches`** — Calendario importable por CSV.

**`tournament_court_streams`** — URL fija por torneo + cancha (`PK: tournament_id + court`).

### Estado JSONB — Hockey

```typescript
interface ScoreboardState {
  localTeam: string;
  visitTeam: string;
  goalLocal: number;
  goalVisit: number;
  gamePeriod: number;
  timeGame: string;        // "MM:SS"
  penaltyGame: string;     // cronómetro de penalidad
  isPaused: boolean;
  penalizedLocal: boolean;
  penalizedVisit: boolean;
  updatedAt: string;       // ISO 8601
}
```

### Políticas RLS

| Tabla | Lectura | Escritura |
|-------|---------|-----------|
| `profiles` | Pública | Solo propio usuario |
| `matches` | Pública | Anon + authenticated |
| `tournaments` | Pública | Solo organizador dueño |
| `tournament_matches` | Pública | Solo organizador del torneo |
| `tournament_court_streams` | Pública | Organizador + anon |

---

## Sincronización en tiempo real

### Sync local (misma máquina)

```
Controles (writer)
  → Pinia store + localStorage
  → CustomEvent (SCOREBOARD_SYNC_EVENT)
  → PATCH Supabase (REST)

Marcador TV
  → escucha CustomEvent + storage event
  → refleja cambios al instante
```

### Sync remoto (espectadores)

```
Live público
  → GET /rest/v1/matches?id=eq.{matchId} cada N ms
  → interpola reloj localmente entre polls
```

### Ventana "en vivo"

Un partido aparece en el listado si:

- `is_live = true`
- `updated_at` dentro de las últimas **3 horas**
- No es un partido de torneo con `status = 'finished'`

---

## Torneos

### Crear y gestionar

1. `/tournaments` → crear torneo (nombre, fechas, visibilidad pública/privada)
2. Descargar plantilla CSV y subir calendario de partidos
3. Iniciar partido programado → crea `match_id`, reloj en pausa
4. Operar desde Controles
5. **Siguiente partido** → guarda resultado, inicia el siguiente de la misma cancha
6. **Finalizar torneo** → tabla de posiciones definitiva

### Plantilla CSV

Columnas obligatorias: `local`, `visita`, `tiempo_juego`, `cancha`.

Columna opcional: `fecha_programada` (formato `yyyy-MM-dd HH:mm`).

```csv
local,visita,tiempo_juego,cancha,fecha_programada
Huracanes,Thunder,20:00,1,2026-06-15 18:00
Leones,Sharks,15:00,2,2026-06-15 18:00
```

### URLs fijas por cancha

Cada cancha de torneo tiene una URL que **no cambia** entre partidos:

- Live: `/live/torneo/:tournamentId/:court`
- Overlay: `/overlay/torneo/:tournamentId/:court`

La tabla `tournament_court_streams` apunta al `match_id` activo de cada cancha.

### Tabla de posiciones

- Victoria: **3 puntos**
- Empate: **1 punto**
- Derrota: **0 puntos**

---

## Deploy en GitHub Pages

### 1. Workflow de GitHub Actions

Crea `.github/workflows/deploy.yml` (ver referencia en marker-board). El workflow:

1. Instala dependencias con `yarn`
2. Ejecuta `yarn build` con variables de entorno
3. Publica `dist/` en GitHub Pages

### 2. Variables en GitHub

Repo → **Settings** → **Secrets and variables** → **Actions**:

| Tipo | Nombre | Valor |
|------|--------|-------|
| Variable | `VITE_SUPABASE_URL` | `https://TU_PROYECTO.supabase.co` |
| Variable | `VITE_POLL_INTERVAL_MS` | `5000` (opcional) |
| Secret | `VITE_SUPABASE_ANON_KEY` | Clave anon de Supabase |

### 3. Configurar Pages

1. **Settings** → **Pages** → fuente: **GitHub Actions**
2. **Settings** → **Environments** → `github-pages` → permitir rama `main`/`develop`

### 4. Redirect SPA (404)

En GitHub Pages, las rutas directas (ej. `/live/partido-123`) devuelven 404. Solución:

- `public/404.html` con redirect al `index.html`
- O configurar el `base` en Vite correctamente

---

## Extensibilidad para otros deportes

El MVP es solo hockey. Para agregar un deporte nuevo en el futuro:

1. Crear `src/types/{deporte}Scoreboard.ts` — interfaz del estado JSONB
2. Crear `src/stores/{deporte}Scoreboard.ts` — store Pinia
3. Crear `src/services/{deporte}MatchSync.ts` — fetch/publish
4. Crear vistas y componentes bajo prefijo de ruta (ej. `/basquet/controls`)
5. Registrar en `src/types/sport.ts` con `available: true`

Las tablas `matches`, `tournaments` y `tournament_matches` **no cambian**. Solo se usa la columna `sport` y un esquema JSONB distinto en `state`.

---

## Roadmap MVP

### Fase 1 — Marcador standalone

- [ ] Auth (registro/login con roles)
- [ ] Marcador hockey: goles, periodos, reloj, penalidades
- [ ] Controles + Marcador TV (sync local)
- [ ] Live público con polling
- [ ] Overlay para OBS
- [ ] Listado "En vivo ahora"

### Fase 2 — Torneos

- [ ] CRUD de torneos
- [ ] Importación CSV
- [ ] Iniciar/finalizar partidos
- [ ] "Siguiente partido" por cancha
- [ ] URLs fijas por cancha
- [ ] Tabla de posiciones
- [ ] Torneos públicos/privados

### Fase 3 — Mejoras

- [ ] Segundo deporte (patrón de extensibilidad)
- [ ] Historial de partidos del organizador
- [ ] API propia si se superan límites de RLS

---

## Criterios de éxito

1. Un organizador crea un partido, lo opera desde Controles y el marcador se actualiza en Live público en menos de 5 segundos.
2. Un espectador ve partidos en vivo sin login.
3. Un organizador crea un torneo, importa 10+ partidos por CSV, opera partidos secuenciales por cancha y obtiene tabla de posiciones al finalizar.
4. La app funciona desplegada de forma estática sin servidor propio.
5. Costo de Supabase en tier gratuito para eventos pequeños y medianos.

---

## Licencia

Definir según necesidad del proyecto.
