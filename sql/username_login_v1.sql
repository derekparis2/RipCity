-- =====================================================
-- RIP CITY USERNAME LOGIN
-- =====================================================
-- Lets the public login page resolve an exact username to the account email
-- without granting broad anon SELECT access to profiles.

create unique index if not exists profiles_username_lower_unique
on public.profiles (lower(username))
where username is not null and btrim(username) <> '';

create or replace function public.resolve_login_identifier(login_identifier text)
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.email
  from public.profiles p
  where lower(p.username) = lower(btrim(login_identifier))
  limit 1;
$$;

revoke all on function public.resolve_login_identifier(text) from public;
grant execute on function public.resolve_login_identifier(text) to anon, authenticated;
