-- Planes, entitlements y RLS de escritura en partidos / streams

create type public.plan_id as enum ('free', 'pro', 'event');
create type public.entitlement_status as enum ('active', 'canceled', 'expired', 'past_due');

create table if not exists public.entitlements (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  plan public.plan_id not null default 'free',
  status public.entitlement_status not null default 'active',
  current_period_end timestamptz,
  stripe_customer_id text,
  stripe_subscription_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.entitlements enable row level security;

drop policy if exists "entitlements_select_own" on public.entitlements;
create policy "entitlements_select_own"
  on public.entitlements for select using (user_id = auth.uid());

-- Solo service role (webhooks) escribe entitlements.
drop policy if exists "entitlements_no_client_write" on public.entitlements;

create or replace function public.ensure_free_entitlement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.entitlements (user_id, plan, status)
  values (new.id, 'free', 'active')
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_profile_created_entitlement on public.profiles;
create trigger on_profile_created_entitlement
  after insert on public.profiles
  for each row execute function public.ensure_free_entitlement();

insert into public.entitlements (user_id, plan, status)
select p.id, 'free', 'active'
from public.profiles p
on conflict (user_id) do nothing;

-- Nuevos usuarios operan dentro del plan Free (ya no hay checkbox de organizador infinito).
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
    coalesce((new.raw_user_meta_data->>'role')::public.user_role, 'organizer')
  );
  return new;
end;
$$;

-- Lectura pública (live gratis). Escritura solo organizador o staff del torneo.
drop policy if exists "matches_insert_all" on public.matches;
drop policy if exists "matches_update_all" on public.matches;
drop policy if exists "matches_insert_operator" on public.matches;
drop policy if exists "matches_update_operator" on public.matches;

create policy "matches_insert_operator"
  on public.matches for insert with check (
    auth.uid() is not null
    and organizer_id = auth.uid()
  );

create policy "matches_update_operator"
  on public.matches for update using (
    organizer_id = auth.uid()
    or (
      tournament_id is not null
      and public.is_tournament_staff(tournament_id)
    )
  );

drop policy if exists "court_streams_write_all" on public.tournament_court_streams;
drop policy if exists "court_streams_write_staff" on public.tournament_court_streams;

create policy "court_streams_write_staff"
  on public.tournament_court_streams for all using (
    public.is_tournament_staff(tournament_id)
  ) with check (
    public.is_tournament_staff(tournament_id)
  );
