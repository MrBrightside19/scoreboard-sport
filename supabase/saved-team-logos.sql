-- Logos de equipo por usuario (Perfil → Mesa).
-- Ejecutar en el SQL Editor de Supabase.

alter table public.profiles
  add column if not exists saved_team_logos jsonb not null default '[]'::jsonb;
