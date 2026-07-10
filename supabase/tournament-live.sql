-- Legacy: live_match_id en torneos (opcional, para compatibilidad)

alter table public.tournaments
  add column if not exists live_match_id text references public.matches (id) on delete set null;

comment on column public.tournaments.live_match_id is 'Legacy: partido en vivo principal del torneo';
