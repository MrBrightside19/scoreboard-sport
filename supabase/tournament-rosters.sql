-- Plantillas de jugadores por torneo (equipo + categoría)

create table if not exists public.tournament_rosters (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  team text not null,
  category text,
  number text not null,
  name text not null,
  last_name text not null default '',
  position text,
  created_at timestamptz not null default now()
);

-- Migración si la tabla ya existía sin estos campos
alter table public.tournament_rosters
  add column if not exists last_name text not null default '';

alter table public.tournament_rosters
  add column if not exists position text;

create unique index if not exists tournament_rosters_unique_idx
  on public.tournament_rosters (
    tournament_id,
    lower(trim(team)),
    lower(trim(coalesce(category, ''))),
    trim(number)
  );

create index if not exists tournament_rosters_lookup_idx
  on public.tournament_rosters (tournament_id, team);

alter table public.tournament_rosters enable row level security;

drop policy if exists "tournament_rosters_select_public" on public.tournament_rosters;
create policy "tournament_rosters_select_public"
  on public.tournament_rosters for select using (
    exists (
      select 1 from public.tournaments t
      where t.id = tournament_id
        and (
          t.visibility = 'public'
          or public.is_tournament_staff(t.id)
        )
    )
  );

drop policy if exists "tournament_rosters_write_staff" on public.tournament_rosters;
create policy "tournament_rosters_write_staff"
  on public.tournament_rosters for all using (
    public.is_tournament_staff(tournament_id)
  );

comment on table public.tournament_rosters is
  'Jugadores importados del calendario (equipo, categoría, número, nombre, apellido, posición)';
