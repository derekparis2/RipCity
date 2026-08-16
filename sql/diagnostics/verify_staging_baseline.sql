-- =====================================================
-- RIP CITY STAGING BASELINE VERIFICATION
-- =====================================================
-- Read-only. Run after the verified initial migration in Rip City Staging.

with actual_counts as (
  select 'public tables' as check_name, 21::bigint as expected, count(*)::bigint as actual
  from pg_catalog.pg_tables
  where schemaname = 'public'

  union all

  select 'public columns', 194, count(*)
  from information_schema.columns
  where table_schema = 'public'

  union all

  select 'public indexes', 55, count(*)
  from pg_catalog.pg_indexes
  where schemaname = 'public'

  union all

  select 'RLS-enabled public tables', 21, count(*)
  from pg_catalog.pg_tables
  where schemaname = 'public'
    and rowsecurity

  union all

  select 'public-table RLS policies', 93, count(*)
  from pg_catalog.pg_policies
  where schemaname = 'public'

  union all

  select 'canonical exercise-substitution policies', 4, count(*)
  from pg_catalog.pg_policies
  where schemaname = 'public'
    and tablename = 'exercise_substitutions'
    and policyname in (
      'exercise substitutions coaches read facility rows',
      'exercise substitutions coaches insert facility rows',
      'exercise substitutions coaches update facility rows',
      'exercise substitutions coaches delete facility rows'
    )

  union all

  select 'app_private functions', 18, count(*)
  from information_schema.routines
  where routine_schema = 'app_private'

  union all

  select 'Rip City facilities', 1, count(*)
  from public.facilities
  where slug = 'rip-city'

  union all

  select 'Rip City groups', 5, count(*)
  from public.groups g
  join public.facilities f on f.id = g.facility_id
  where f.slug = 'rip-city'

  union all

  select 'Rip City habits', 6, count(*)
  from public.habits h
  join public.facilities f on f.id = h.facility_id
  where f.slug = 'rip-city'

  union all

  select 'Rip City starter exercise templates', 87, count(*)
  from public.exercise_templates et
  join public.facilities f on f.id = et.facility_id
  where f.slug = 'rip-city'

  union all

  select 'profile-picture buckets', 1, count(*)
  from storage.buckets
  where id = 'profile-pictures'

  union all

  select 'required anon signup grants', 2, count(*)
  from information_schema.role_table_grants
  where table_schema = 'public'
    and grantee = 'anon'
    and privilege_type = 'SELECT'
    and table_name in ('facilities', 'groups')

  union all

  select 'unexpected anon table grants', 0, count(*)
  from information_schema.role_table_grants
  where table_schema = 'public'
    and grantee = 'anon'
    and not (
      privilege_type = 'SELECT'
      and table_name in ('facilities', 'groups')
    )

  union all

  select 'truncated exercise-substitution policy names', 0, count(*)
  from pg_catalog.pg_policies
  where schemaname = 'public'
    and tablename = 'exercise_substitutions'
    and policyname in (
      'exercise_substitutions coaches can insert facility substitution',
      'exercise_substitutions coaches can update facility substitution',
      'exercise_substitutions coaches can delete facility substitution'
    )
)
select
  check_name,
  expected,
  actual,
  case when actual = expected then 'PASS' else 'FAIL' end as result
from actual_counts
order by check_name;
