/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_POLL_INTERVAL_MS?: string
  readonly VITE_LIVE_CLOCK_UPDATE_MS?: string
  readonly VITE_TOURNAMENT_TABLE_REFRESH_MS?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
