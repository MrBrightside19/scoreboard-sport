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
  category text,
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

create table public.tournament_assistants (
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  email text not null,
  assigned_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (tournament_id, user_id)
);

create index tournament_assistants_user_idx
  on public.tournament_assistants (user_id);

create or replace function public.is_tournament_staff(target_tournament_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.tournaments t
    where t.id = target_tournament_id
      and (
        t.organizer_id = auth.uid()
        or exists (
          select 1
          from public.tournament_assistants ta
          where ta.tournament_id = t.id
            and ta.user_id = auth.uid()
        )
      )
  );
$$;

create or replace function public.is_tournament_organizer(target_tournament_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.tournaments t
    where t.id = target_tournament_id
      and t.organizer_id = auth.uid()
  );
$$;

alter table public.tournaments enable row level security;
alter table public.tournament_matches enable row level security;
alter table public.tournament_assistants enable row level security;

create policy "tournaments_select_public"
  on public.tournaments for select using (
    visibility = 'public'
    or organizer_id = auth.uid()
    or exists (
      select 1 from public.tournament_assistants ta
      where ta.tournament_id = id and ta.user_id = auth.uid()
    )
  );

create policy "tournaments_insert_organizer"
  on public.tournaments for insert with check (organizer_id = auth.uid());

create policy "tournaments_update_staff"
  on public.tournaments for update using (
    public.is_tournament_staff(id)
  );

create policy "tournaments_delete_organizer"
  on public.tournaments for delete using (organizer_id = auth.uid());

create policy "tournament_matches_select_public"
  on public.tournament_matches for select using (
    exists (
      select 1 from public.tournaments t
      where t.id = tournament_id
        and (
          t.visibility = 'public'
          or public.is_tournament_staff(t.id)
        )
    )
  );

create policy "tournament_matches_write_staff"
  on public.tournament_matches for all using (
    public.is_tournament_staff(tournament_id)
  );

create policy "tournament_assistants_select_staff"
  on public.tournament_assistants for select using (
    user_id = auth.uid()
    or public.is_tournament_organizer(tournament_id)
  );

create policy "tournament_assistants_insert_organizer"
  on public.tournament_assistants for insert with check (
    public.is_tournament_organizer(tournament_id)
    and assigned_by = auth.uid()
  );

create policy "tournament_assistants_update_organizer"
  on public.tournament_assistants for update using (
    public.is_tournament_organizer(tournament_id)
  );

create policy "tournament_assistants_delete_organizer"
  on public.tournament_assistants for delete using (
    public.is_tournament_organizer(tournament_id)
  );

create index tournament_matches_order_idx
  on public.tournament_matches (tournament_id, court, sort_order);
