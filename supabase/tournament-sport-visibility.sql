-- sport y visibility ya incluidos en tournaments.sql
-- Este archivo documenta valores por defecto para extensibilidad futura

comment on column public.tournaments.sport is 'Deporte del torneo (default hockey)';
comment on column public.tournaments.visibility is 'public | private';
comment on column public.matches.sport is 'Deporte del partido (default hockey)';
