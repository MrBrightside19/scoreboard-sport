-- Asistentes por torneo (hasta 2, asignados por email)

alter type public.user_role add value if not exists 'assistant';

create table if not exists public.tournament_assistants (
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

alter table public.tournament_assistants enable row level security;

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

-- Actualizar políticas de torneos y partidos para incluir asistentes

drop policy if exists "tournaments_select_public" on public.tournaments;
create policy "tournaments_select_public"
  on public.tournaments for select using (
    visibility = 'public'
    or organizer_id = auth.uid()
    or exists (
      select 1 from public.tournament_assistants ta
      where ta.tournament_id = id and ta.user_id = auth.uid()
    )
  );

drop policy if exists "tournaments_update_organizer" on public.tournaments;
create policy "tournaments_update_staff"
  on public.tournaments for update using (
    public.is_tournament_staff(id)
  );

drop policy if exists "tournament_matches_select_public" on public.tournament_matches;
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

drop policy if exists "tournament_matches_write_organizer" on public.tournament_matches;
create policy "tournament_matches_write_staff"
  on public.tournament_matches for all using (
    public.is_tournament_staff(tournament_id)
  );

comment on table public.tournament_assistants is 'Hasta 2 asistentes por torneo; pueden operar el calendario y marcador junto al organizador';
