-- Canchas y streams fijos por torneo

create table public.tournament_court_streams (
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  court text not null,
  match_id text references public.matches (id) on delete set null,
  primary key (tournament_id, court)
);

alter table public.tournament_court_streams enable row level security;

create policy "court_streams_select_public"
  on public.tournament_court_streams for select using (true);

create policy "court_streams_write_all"
  on public.tournament_court_streams for all using (true);
