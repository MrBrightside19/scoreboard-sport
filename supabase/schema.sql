-- Perfiles, partidos y trigger de registro

create type public.user_role as enum ('organizer', 'spectator');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  display_name text,
  role public.user_role not null default 'spectator',
  created_at timestamptz not null default now()
);

create table public.matches (
  id text primary key,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  title text,
  organizer_id uuid references public.profiles (id) on delete set null,
  is_live boolean not null default false,
  tournament_id uuid,
  court text,
  goal_local integer,
  goal_visit integer,
  finished_at timestamptz,
  sport text not null default 'hockey'
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    coalesce((new.raw_user_meta_data->>'role')::public.user_role, 'spectator')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.matches enable row level security;

create policy "profiles_select_public"
  on public.profiles for select using (true);

create policy "profiles_update_own"
  on public.profiles for update using (auth.uid() = id);

create policy "matches_select_public"
  on public.matches for select using (true);

create policy "matches_insert_all"
  on public.matches for insert with check (true);

create policy "matches_update_all"
  on public.matches for update using (true);

create policy "matches_delete_organizer"
  on public.matches for delete using (
    organizer_id is null or organizer_id = auth.uid()
  );

create index matches_live_idx on public.matches (is_live, updated_at desc);
create index matches_tournament_idx on public.matches (tournament_id, court);
