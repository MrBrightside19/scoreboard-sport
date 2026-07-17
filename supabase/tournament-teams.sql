-- Metadatos de equipos por torneo (color y logo para overlay)

create table if not exists public.tournament_teams (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  team text not null,
  color text not null default '#3da5ff',
  logo_url text not null default '',
  created_at timestamptz not null default now()
);

create unique index if not exists tournament_teams_unique_idx
  on public.tournament_teams (tournament_id, lower(trim(team)));

create index if not exists tournament_teams_lookup_idx
  on public.tournament_teams (tournament_id);

alter table public.tournament_teams enable row level security;

drop policy if exists "tournament_teams_select_public" on public.tournament_teams;
create policy "tournament_teams_select_public"
  on public.tournament_teams for select using (
    exists (
      select 1 from public.tournaments t
      where t.id = tournament_id
        and (
          t.visibility = 'public'
          or public.is_tournament_staff(t.id)
        )
    )
  );

drop policy if exists "tournament_teams_write_staff" on public.tournament_teams;
create policy "tournament_teams_write_staff"
  on public.tournament_teams for all using (
    public.is_tournament_staff(tournament_id)
  );

comment on table public.tournament_teams is
  'Color y logo por equipo del torneo (aplicados al overlay al iniciar partidos)';
