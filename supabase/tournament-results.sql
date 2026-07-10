-- Resultados finales (columnas goal_* y finished_at ya en schema)

comment on column public.matches.finished_at is 'Marca de fin del partido';
comment on column public.matches.goal_local is 'Goles local al finalizar';
comment on column public.matches.goal_visit is 'Goles visita al finalizar';

comment on column public.tournament_matches.goal_local is 'Resultado final local';
comment on column public.tournament_matches.goal_visit is 'Resultado final visita';
