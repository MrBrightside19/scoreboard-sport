-- Registro de partidos sueltos (Config → Guardar partido).
-- Ejecutar en el SQL Editor de Supabase.

create table if not exists public.saved_matches (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null references public.profiles (id) on delete cascade,
  source_match_id text,
  sport text not null default 'hockey',
  title text,
  local_team text not null default 'Local',
  visit_team text not null default 'Visita',
  goal_local integer not null default 0,
  goal_visit integer not null default 0,
  state jsonb not null default '{}'::jsonb,
  saved_at timestamptz not null default now()
);

alter table public.saved_matches enable row level security;

drop policy if exists "saved_matches_select_own" on public.saved_matches;
create policy "saved_matches_select_own"
  on public.saved_matches for select
  using (organizer_id = auth.uid());

drop policy if exists "saved_matches_insert_own" on public.saved_matches;
create policy "saved_matches_insert_own"
  on public.saved_matches for insert
  with check (organizer_id = auth.uid());

drop policy if exists "saved_matches_delete_own" on public.saved_matches;
create policy "saved_matches_delete_own"
  on public.saved_matches for delete
  using (organizer_id = auth.uid());

create index if not exists saved_matches_organizer_idx
  on public.saved_matches (organizer_id, saved_at desc);
