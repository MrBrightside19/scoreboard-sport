-- Permitir hasta 2 asistentes por torneo (cambiar PK de solo tournament_id a compuesta)

alter table public.tournament_assistants
  drop constraint if exists tournament_assistants_pkey;

alter table public.tournament_assistants
  add primary key (tournament_id, user_id);

comment on table public.tournament_assistants is 'Hasta 2 asistentes por torneo; pueden operar calendario y marcador junto al organizador';
