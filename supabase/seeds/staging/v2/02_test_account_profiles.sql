-- RIP CITY V2 STAGING-ONLY TEST ACCOUNT PROFILES
--
-- Prerequisites:
-- - Run 01_two_facility_foundation.sql successfully.
-- - Create and auto-confirm the nine fake Auth users documented in
--   docs/STAGING_TEST_ACCOUNTS.md.
--
-- This file stores no passwords. It resolves Auth IDs by fake email and creates
-- application profiles, facility memberships, member profiles, and groups.

begin;

do $$
declare
  auth_user_count bigint;
  expected_auth_user_count bigint;
  unconfirmed_user_count bigint;
  profile_count bigint;
  facility_member_count bigint;
  member_profile_count bigint;
begin
  select count(*) into auth_user_count from auth.users;

  select count(*)
  into expected_auth_user_count
  from auth.users
  where email = any (array[
    'rcadmin@example.com',
    'rccoach@example.com',
    'rcathlete@example.com',
    'rch2k@example.com',
    'rcpending@example.com',
    'rcinactive@example.com',
    'alphaadmin@example.com',
    'alphacoach@example.com',
    'alphaathlete@example.com'
  ]);

  select count(*)
  into unconfirmed_user_count
  from auth.users
  where email = any (array[
    'rcadmin@example.com',
    'rccoach@example.com',
    'rcathlete@example.com',
    'rch2k@example.com',
    'rcpending@example.com',
    'rcinactive@example.com',
    'alphaadmin@example.com',
    'alphacoach@example.com',
    'alphaathlete@example.com'
  ])
    and email_confirmed_at is null;

  select count(*) into profile_count from public.profiles;
  select count(*) into facility_member_count from public.facility_members;
  select count(*) into member_profile_count from public.member_profiles;

  if auth_user_count <> 9 or expected_auth_user_count <> 9 then
    raise exception
      'Refusing account seed: expected exactly the 9 documented fake Auth users; found % total and % matching.',
      auth_user_count,
      expected_auth_user_count;
  end if;

  if unconfirmed_user_count <> 0 then
    raise exception
      'Refusing account seed: % documented Auth users are not auto-confirmed.',
      unconfirmed_user_count;
  end if;

  if profile_count <> 0 or facility_member_count <> 0 or member_profile_count <> 0 then
    raise exception
      'Refusing account seed: expected 0 profiles/members/member profiles; found %/%/%.',
      profile_count,
      facility_member_count,
      member_profile_count;
  end if;

  if not exists (
    select 1
    from public.facilities
    where slug = 'rip-city'
  ) or not exists (
    select 1
    from public.facilities
    where slug = 'test-facility-alpha'
      and id = '00000000-0000-4000-8000-000000000002'
  ) then
    raise exception
      'Refusing account seed: the verified two-facility staging foundation is missing.';
  end if;
end
$$;

with expected_users (email, full_name, username, global_role) as (
  values
    ('rcadmin@example.com', 'RC Test Admin', 'rcadmin', 'admin'),
    ('rccoach@example.com', 'RC Test Coach', 'rccoach', 'coach'),
    ('rcathlete@example.com', 'RC Test Athlete', 'rcathlete', 'member'),
    ('rch2k@example.com', 'RC Test H2K', 'rch2k', 'member'),
    ('rcpending@example.com', 'RC Test Pending', 'rcpending', 'member'),
    ('rcinactive@example.com', 'RC Test Inactive', 'rcinactive', 'member'),
    ('alphaadmin@example.com', 'Alpha Test Admin', 'alphaadmin', 'admin'),
    ('alphacoach@example.com', 'Alpha Test Coach', 'alphacoach', 'coach'),
    ('alphaathlete@example.com', 'Alpha Test Athlete', 'alphaathlete', 'member')
)
insert into public.profiles (
  id,
  email,
  full_name,
  username,
  global_role
)
select
  u.id,
  e.email,
  e.full_name,
  e.username,
  e.global_role
from expected_users e
join auth.users u on u.email = e.email;

with expected_memberships (
  membership_id,
  email,
  facility_slug,
  role,
  status,
  approver_email
) as (
  values
    ('10000000-0000-4000-8000-000000000001', 'rcadmin@example.com', 'rip-city', 'admin', 'approved', 'rcadmin@example.com'),
    ('10000000-0000-4000-8000-000000000002', 'rccoach@example.com', 'rip-city', 'coach', 'approved', 'rcadmin@example.com'),
    ('10000000-0000-4000-8000-000000000003', 'rcathlete@example.com', 'rip-city', 'athlete', 'approved', 'rcadmin@example.com'),
    ('10000000-0000-4000-8000-000000000004', 'rch2k@example.com', 'rip-city', 'h2k_member', 'approved', 'rcadmin@example.com'),
    ('10000000-0000-4000-8000-000000000005', 'rcpending@example.com', 'rip-city', 'athlete', 'pending', null),
    ('10000000-0000-4000-8000-000000000006', 'rcinactive@example.com', 'rip-city', 'athlete', 'inactive', 'rcadmin@example.com'),
    ('10000000-0000-4000-8000-000000000007', 'alphaadmin@example.com', 'test-facility-alpha', 'admin', 'approved', 'alphaadmin@example.com'),
    ('10000000-0000-4000-8000-000000000008', 'alphacoach@example.com', 'test-facility-alpha', 'coach', 'approved', 'alphaadmin@example.com'),
    ('10000000-0000-4000-8000-000000000009', 'alphaathlete@example.com', 'test-facility-alpha', 'athlete', 'approved', 'alphaadmin@example.com'),
    ('10000000-0000-4000-8000-000000000010', 'rccoach@example.com', 'test-facility-alpha', 'coach', 'approved', 'alphaadmin@example.com')
)
insert into public.facility_members (
  id,
  facility_id,
  profile_id,
  role,
  status,
  approved_by,
  approved_at
)
select
  e.membership_id::uuid,
  f.id,
  p.id,
  e.role,
  e.status,
  approver.id,
  case when e.status = 'pending' then null else now() end
from expected_memberships e
join public.facilities f on f.slug = e.facility_slug
join public.profiles p on p.email = e.email
left join public.profiles approver on approver.email = e.approver_email;

with expected_member_profiles (
  member_profile_id,
  membership_id,
  member_type,
  sport,
  age_group,
  position
) as (
  values
    ('20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000003', 'athlete', 'Baseball', '14-15', 'Shortstop'),
    ('20000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000004', 'h2k', null, null, null),
    ('20000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000005', 'athlete', 'Baseball', '12-13', 'Outfield'),
    ('20000000-0000-4000-8000-000000000006', '10000000-0000-4000-8000-000000000006', 'athlete', 'Baseball', 'Older Elite', 'Pitcher'),
    ('20000000-0000-4000-8000-000000000009', '10000000-0000-4000-8000-000000000009', 'athlete', 'Soccer', 'Youth', 'Midfielder')
)
insert into public.member_profiles (
  id,
  facility_member_id,
  member_type,
  sport,
  age_group,
  position
)
select
  e.member_profile_id::uuid,
  e.membership_id::uuid,
  e.member_type,
  e.sport,
  e.age_group,
  e.position
from expected_member_profiles e;

with expected_group_memberships (
  group_membership_id,
  member_profile_id,
  facility_slug,
  group_name
) as (
  values
    ('30000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000003', 'rip-city', '14-15'),
    ('30000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000004', 'rip-city', 'H2K'),
    ('30000000-0000-4000-8000-000000000005', '20000000-0000-4000-8000-000000000005', 'rip-city', '12-13'),
    ('30000000-0000-4000-8000-000000000006', '20000000-0000-4000-8000-000000000006', 'rip-city', 'Older Elite'),
    ('30000000-0000-4000-8000-000000000009', '20000000-0000-4000-8000-000000000009', 'test-facility-alpha', 'Test Youth Athletes')
)
insert into public.group_members (
  id,
  group_id,
  member_profile_id
)
select
  e.group_membership_id::uuid,
  g.id,
  e.member_profile_id::uuid
from expected_group_memberships e
join public.facilities f on f.slug = e.facility_slug
join public.groups g
  on g.facility_id = f.id
 and g.name = e.group_name;

commit;

-- Expected result: 9 profiles and 10 memberships. The Rip City coach appears
-- once in each facility. Pending/inactive members retain their intended status.
select
  p.email,
  p.global_role,
  f.name as facility_name,
  fm.role as facility_role,
  fm.status,
  mp.member_type
from public.profiles p
join public.facility_members fm on fm.profile_id = p.id
join public.facilities f on f.id = fm.facility_id
left join public.member_profiles mp on mp.facility_member_id = fm.id
order by p.email, f.slug;
