-- Vacía partidos y torneos sin borrar cuentas de usuario

delete from public.tournament_court_streams;
delete from public.tournament_matches;
delete from public.matches;
delete from public.tournaments;
