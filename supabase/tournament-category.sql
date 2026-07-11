-- Categoría en partidos del calendario (ej. Sub-18, Sub-21)

alter table public.tournament_matches
  add column if not exists category text;

comment on column public.tournament_matches.category is 'Categoría del partido (opcional)';
