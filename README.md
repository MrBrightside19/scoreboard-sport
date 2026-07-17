# Marcador Hockey

Aplicación web de marcadores en vivo para **hockey en línea**. Permite operar partidos desde una mesa de control, mostrarlos en pantalla o en OBS, y compartir enlaces públicos para espectadores y torneos.

**App en producción (GitHub Pages):** [https://mrbrightside19.github.io/scoreboard-sport/](https://mrbrightside19.github.io/scoreboard-sport/)

---

## Qué hace

- **Mesa de control**: gestiona el partido (reloj, goles, periodos, penalidades, nombres y logos de equipos).
- **Marcador TV**: vista a pantalla completa pensada para monitores en cancha.
- **En vivo**: vista pública del marcador para espectadores.
- **Overlay**: barra compacta con fondo transparente para incrustar en OBS u otras herramientas de streaming.
- **Torneos**: creación y gestión de torneos, calendario, canchas, resultados y tabla de posiciones; vistas públicas para seguimiento.

Los marcadores públicos y el overlay se pueden consultar sin iniciar sesión. Las pantallas de operación requieren cuenta de personal autorizado.

---

## Stack

| Capa        | Tecnología                          |
|-------------|-------------------------------------|
| Frontend    | Vue 3, TypeScript, Vite             |
| Estado      | Pinia                               |
| Routing     | Vue Router                          |
| UI          | Ant Design Vue                      |
| Backend     | Supabase (Auth + PostgreSQL + API)  |
| Deploy      | GitHub Actions → GitHub Pages       |

---

## Requisitos

- [Node.js](https://nodejs.org/) 20 o superior
- Cuenta en [Supabase](https://supabase.com)
- (Opcional) Cuenta en GitHub para el deploy automático

---

## Instalación

```bash
git clone <url-del-repositorio>
cd score-board
npm install
```

Copia el archivo de ejemplo de variables de entorno y completa los valores de tu proyecto Supabase:

```bash
cp .env.example .env
```

### Variables de entorno

| Variable | Descripción |
|----------|-------------|
| `VITE_SUPABASE_URL` | URL del proyecto Supabase |
| `VITE_SUPABASE_ANON_KEY` | Clave anónima / publishable de Supabase |
| `VITE_LIVE_CLOCK_UPDATE_MS` | Intervalo (ms) de actualización del reloj en vivo. Mínimo `1000`. Por defecto `5000` |
| `VITE_POLL_INTERVAL_MS` | Alias heredado; solo se usa si no defines `VITE_LIVE_CLOCK_UPDATE_MS` |
| `VITE_TOURNAMENT_TABLE_REFRESH_MS` | Intervalo (ms) de refresco de tablas de torneo. Por defecto `60000` |

No subas el archivo `.env` al repositorio; ya está en `.gitignore`.

### Base de datos

En la carpeta `supabase/` hay scripts SQL para crear y actualizar el esquema. Ejecútalos en el SQL Editor de Supabase en el orden que indique tu entorno (empezando por el esquema base y luego los scripts de torneos / extensiones según necesites).

Para plantillas de jugadores del calendario, ejecuta también `supabase/tournament-rosters.sql`.

La **plantilla del torneo** (Excel `.xlsx`) incluye dos hojas:
- **Calendario**: partidos (`local`, `visita`, `categoria`, `tiempo_juego`, `cancha`, `fecha_programada`)
- **Jugadores**: plantilla por equipo (`equipo`, `categoria`, `numero`, `nombre`, `apellido`, `posicion`). `posicion` es el tipo de jugador: `Jugador`, `Arquero`, `Capitán` o `Asistente Capitán`.

Al importar el Excel se cargan partidos y jugadores. Al iniciar un partido, los controles cargan los jugadores del equipo filtrados por la categoría. Sigue siendo posible agregar o editar jugadores manualmente en la pestaña Plantillas. También se acepta un `.csv` solo de calendario.

---

## Desarrollo local

```bash
npm run dev
```

La app queda disponible en la URL que muestre Vite (por defecto `http://localhost:5173`).

### Scripts

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Typecheck + build de producción |
| `npm run preview` | Previsualiza el build generado en `dist/` |

---

## Vistas principales

| Ruta | Uso |
|------|-----|
| `/` | Inicio |
| `/controls` | Mesa de control del partido |
| `/board` | Marcador TV (partido concreto) |
| `/board/torneo/:tournamentId/:court` | Marcador TV fijo por cancha (sync local + cambio de partido) |
| `/live/:matchId` | Marcador en vivo (público) |
| `/overlay/:matchId` | Overlay para OBS (público) |
| `/tournaments` | Gestión de torneos (personal) |
| `/torneos-publicos` | Listado público de torneos |
| `/torneo/:id` | Detalle público de un torneo |
| `/live/torneo/:tournamentId/:court` | En vivo por cancha de torneo |
| `/overlay/torneo/:tournamentId/:court` | Overlay por cancha de torneo |

En desarrollo local la base de la app es `/`. En producción (GitHub Pages) la base es `/scoreboard-sport/`.

---

## Cómo funciona (resumen)

1. El personal inicia sesión y opera el partido desde la mesa de control.
2. El estado del partido se sincroniza a través de Supabase.
3. Las vistas públicas (live / overlay) y el marcador TV leen ese estado y lo muestran según el formato de cada pantalla.
4. En torneos, cada cancha puede tener URLs fijas de transmisión (live y overlay) para no cambiar el enlace en OBS entre partidos.

---

## Overlay en OBS

1. Abre la URL de overlay del partido o de la cancha del torneo.
2. En OBS, añade una **fuente de navegador** con esa URL.
3. Ajusta el tamaño del navegador según necesites; el fondo del overlay es transparente.

---

## Deploy (GitHub Pages)

El workflow en `.github/workflows/deploy.yml` construye y publica la app al hacer push a `main` (o de forma manual con `workflow_dispatch`).

Configuración necesaria en el repositorio de GitHub:

1. **Settings → Pages**: source = **GitHub Actions**.
2. **Settings → Secrets and variables → Actions** (o el environment `github-pages`):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

Tras el deploy, la app queda en la ruta configurada por Vite (`/scoreboard-sport/` en producción).

---

## Estructura del proyecto

```
src/
  components/   # UI reutilizable (marcador, paneles de control, etc.)
  views/        # Pantallas / rutas
  stores/       # Estado Pinia
  services/     # Acceso a Supabase y lógica de dominio
  routes/       # Vue Router
  types/        # Tipos TypeScript
  utils/        # Utilidades
supabase/       # Scripts SQL del esquema
.github/        # CI / deploy
```

---

## Licencia

Proyecto privado (`private: true` en `package.json`).
