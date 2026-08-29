-- RIP CITY V2 STAGING-ONLY TWO-FACILITY FOUNDATION
--
-- Run only in Rip City Staging before creating fake Auth users.
-- The guard rejects production and any database that no longer matches the
-- verified empty staging baseline. No real people or activity are inserted.

begin;

do $$
declare
  auth_user_count bigint;
  profile_count bigint;
  facility_count bigint;
  exercise_count bigint;
begin
  select count(*) into auth_user_count from auth.users;
  select count(*) into profile_count from public.profiles;
  select count(*) into facility_count from public.facilities;
  select count(*) into exercise_count from public.exercise_templates;

  if auth_user_count <> 0 then
    raise exception
      'Refusing staging seed: expected 0 Auth users, found %.',
      auth_user_count;
  end if;

  if profile_count <> 0 then
    raise exception
      'Refusing staging seed: expected 0 application profiles, found %.',
      profile_count;
  end if;

  if not exists (
    select 1
    from public.facilities
    where slug = 'rip-city'
      and name = 'Rip City'
  ) then
    raise exception
      'Refusing staging seed: verified Rip City baseline facility is missing.';
  end if;

  if facility_count not in (1, 2) then
    raise exception
      'Refusing staging seed: expected 1 baseline facility or 2 seeded facilities, found %.',
      facility_count;
  end if;

  if exists (
    select 1
    from public.facilities
    where slug <> 'rip-city'
      and slug <> 'test-facility-alpha'
  ) then
    raise exception
      'Refusing staging seed: an unexpected non-Rip-City facility already exists.';
  end if;

  if exists (
    select 1
    from public.facilities
    where slug = 'test-facility-alpha'
      and id <> '00000000-0000-4000-8000-000000000002'
  ) then
    raise exception
      'Refusing staging seed: Test Facility Alpha exists with an unexpected ID.';
  end if;

  if exercise_count <> 87 then
    raise exception
      'Refusing staging seed: expected 87 baseline exercises, found %.',
      exercise_count;
  end if;
end
$$;

insert into public.facilities (
  id,
  name,
  slug,
  primary_color,
  secondary_color
)
values (
  '00000000-0000-4000-8000-000000000002',
  'Test Facility Alpha',
  'test-facility-alpha',
  '#2457D6',
  '#F4F7FF'
)
on conflict (slug) do update
set
  name = excluded.name,
  primary_color = excluded.primary_color,
  secondary_color = excluded.secondary_color;

insert into public.groups (
  id,
  facility_id,
  name,
  group_type,
  member_type
)
values
  (
    '00000000-0000-4000-8000-000000000101',
    '00000000-0000-4000-8000-000000000002',
    'Test Youth Athletes',
    'age',
    'athlete'
  ),
  (
    '00000000-0000-4000-8000-000000000102',
    '00000000-0000-4000-8000-000000000002',
    'Test Adult Athletes',
    'program',
    'athlete'
  )
on conflict (facility_id, name) do update
set
  group_type = excluded.group_type,
  member_type = excluded.member_type;

commit;

-- Expected result: two facilities. Rip City has five groups and six habits;
-- Test Facility Alpha has two athlete groups and no habits.
select
  f.name as facility_name,
  f.slug as facility_slug,
  count(distinct g.id) as group_count,
  count(distinct h.id) as habit_count
from public.facilities f
left join public.groups g on g.facility_id = f.id
left join public.habits h on h.facility_id = f.id
group by f.id, f.name, f.slug
order by f.slug;
