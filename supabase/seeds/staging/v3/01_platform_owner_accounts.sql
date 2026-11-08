-- RIP CITY V3 STAGING-ONLY PLATFORM OWNER ACCOUNTS
--
-- Prerequisites:
-- - Apply 20261108150000_add_platform_owner_foundation.sql.
-- - Create and auto-confirm rcplatform@example.com and
--   alphaplatform@example.com in Rip City Staging Auth.
--
-- This fixture intentionally keeps rcadmin@example.com and
-- alphaadmin@example.com as ordinary facility admins. Each dedicated platform
-- account also receives one approved facility-admin membership so the existing
-- admin experience can be tested without granting cross-facility data access.

begin;

do $$
declare
  missing_auth_users text[];
  unconfirmed_auth_users text[];
begin
  if to_regclass('app_private.platform_owners') is null then
    raise exception
      'Platform-owner migration is missing. Apply 20261108150000_add_platform_owner_foundation.sql first.';
  end if;

  select array_agg(expected.email order by expected.email)
  into missing_auth_users
  from (
    values
      ('rcplatform@example.com'::text),
      ('alphaplatform@example.com'::text)
  ) as expected(email)
  where not exists (
    select 1 from auth.users u where lower(u.email) = lower(expected.email)
  );

  if coalesce(array_length(missing_auth_users, 1), 0) > 0 then
    raise exception 'Create the missing staging Auth users first: %', missing_auth_users;
  end if;

  select array_agg(u.email order by u.email)
  into unconfirmed_auth_users
  from auth.users u
  where lower(u.email) in ('rcplatform@example.com', 'alphaplatform@example.com')
    and u.email_confirmed_at is null;

  if coalesce(array_length(unconfirmed_auth_users, 1), 0) > 0 then
    raise exception 'Auto-confirm the staging Auth users first: %', unconfirmed_auth_users;
  end if;

  if not exists (select 1 from public.facilities where slug = 'rip-city')
     or not exists (select 1 from public.facilities where slug = 'test-facility-alpha') then
    raise exception 'Both staging facilities must exist before adding platform fixtures.';
  end if;
end
$$;

with expected_users (email, full_name, username) as (
  values
    ('rcplatform@example.com', 'RC Test Platform Owner', 'rcplatform'),
    ('alphaplatform@example.com', 'Alpha Test Platform Owner', 'alphaplatform')
)
insert into public.profiles (id, email, full_name, username, global_role)
select
  u.id,
  expected.email,
  expected.full_name,
  expected.username,
  'admin'
from expected_users expected
join auth.users u on lower(u.email) = lower(expected.email)
on conflict (id) do update
set
  email = excluded.email,
  full_name = excluded.full_name,
  username = excluded.username,
  global_role = excluded.global_role;

with expected_memberships (email, facility_slug) as (
  values
    ('rcplatform@example.com', 'rip-city'),
    ('alphaplatform@example.com', 'test-facility-alpha')
)
insert into public.facility_members (
  facility_id,
  profile_id,
  role,
  status,
  approved_by,
  approved_at
)
select
  f.id,
  p.id,
  'admin',
  'approved',
  p.id,
  now()
from expected_memberships expected
join public.facilities f on f.slug = expected.facility_slug
join public.profiles p on lower(p.email) = lower(expected.email)
on conflict (facility_id, profile_id) do update
set
  role = 'admin',
  status = 'approved',
  approved_by = excluded.approved_by,
  approved_at = excluded.approved_at;

insert into app_private.platform_owners (profile_id, granted_by, note)
select
  p.id,
  p.id,
  'Staging-only dedicated platform-owner fixture'
from public.profiles p
where lower(p.email) in ('rcplatform@example.com', 'alphaplatform@example.com')
on conflict (profile_id) do update
set
  active = true,
  note = excluded.note,
  updated_at = now();

commit;
