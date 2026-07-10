-- Torneos y calendario

create type public.tournament_visibility as enum ('public', 'private');
create type public.tournament_status as enum ('draft', 'active', 'finished');
create type public.tournament_match_status as enum ('scheduled', 'live', 'finished');

create table public.tournaments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  start_date date,
  end_date date,
  organizer_id uuid not null references public.profiles (id) on delete cascade,
  visibility public.tournament_visibility not null default 'public',
  status public.tournament_status not null default 'draft',
  sport text not null default 'hockey',
  created_at timestamptz not null default now()
);

create table public.tournament_matches (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  local_team text not null,
  visit_team text not null,
  game_time text not null default '20:00',
  court text not null,
  scheduled_at timestamptz,
  status public.tournament_match_status not null default 'scheduled',
  match_id text references public.matches (id) on delete set null,
  sort_order integer not null default 0,
  goal_local integer,
  goal_visit integer,
  unique (tournament_id, sort_order)
);

alter table public.matches
  add constraint matches_tournament_fk
  foreign key (tournament_id) references public.tournaments (id) on delete set null;

alter table public.tournaments enable row level security;
alter table public.tournament_matches enable row level security;

create policy "tournaments_select_public"
  on public.tournaments for select using (
    visibility = 'public' or organizer_id = auth.uid()
  );

create policy "tournaments_insert_organizer"
  on public.tournaments for insert with check (organizer_id = auth.uid());

create policy "tournaments_update_organizer"
  on public.tournaments for update using (organizer_id = auth.uid());

create policy "tournaments_delete_organizer"
  on public.tournaments for delete using (organizer_id = auth.uid());

create policy "tournament_matches_select_public"
  on public.tournament_matches for select using (
    exists (
      select 1 from public.tournaments t
      where t.id = tournament_id
        and (t.visibility = 'public' or t.organizer_id = auth.uid())
    )
  );

create policy "tournament_matches_write_organizer"
  on public.tournament_matches for all using (
    exists (
      select 1 from public.tournaments t
      where t.id = tournament_id and t.organizer_id = auth.uid()
    )
  );

create index tournament_matches_order_idx
  on public.tournament_matches (tournament_id, court, sort_order);
