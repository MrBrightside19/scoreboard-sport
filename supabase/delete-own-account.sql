-- Permite que cada usuario autenticado elimine su cuenta y sus datos.
-- Ejecutar en el SQL Editor de Supabase (rol postgres).

create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'No autenticado';
  end if;

  delete from public.matches
  where organizer_id = uid
     or tournament_id in (
       select id from public.tournaments where organizer_id = uid
     );

  delete from public.tournaments where organizer_id = uid;

  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.delete_own_account() from public, anon;
grant execute on function public.delete_own_account() to authenticated;
