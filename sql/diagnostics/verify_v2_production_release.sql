-- V2 production verification (read-only)
-- Run in production after all approved V2 migrations and before deploying the
-- V2 frontend.

with required_columns(table_name, column_name) as (
  values
    ('goals', 'timeline'),
    ('goals', 'due_date'),
    ('goals', 'completed_at'),
    ('exercise_templates', 'is_unilateral'),
    ('workout_exercises', 'is_unilateral'),
    ('groups', 'created_by'),
    ('coach_announcements', 'audience_type')
),
required_tables(table_name) as (
  values
    ('goal_checkins'),
    ('coach_announcements'),
    ('coach_announcement_groups'),
    ('coach_announcement_members'),
    ('coach_announcement_dismissals')
),
required_functions(function_name) as (
  values
    ('lookup_coach_invite'),
    ('claim_coach_invite'),
    ('create_coach_invite'),
    ('create_coach_announcement'),
    ('get_workout_attributions')
),
checks as (
  select
    'required V2 columns'::text as check_name,
    '7'::text as expected,
    count(*)::text as actual,
    case when count(*) = 7 then 'PASS' else 'FAIL' end as result
  from required_columns required
  where exists (
    select 1 from information_schema.columns found
    where found.table_schema = 'public'
      and found.table_name = required.table_name
      and found.column_name = required.column_name
  )

  union all

  select
    'required V2 tables',
    '5',
    count(*)::text,
    case when count(*) = 5 then 'PASS' else 'FAIL' end
  from required_tables required
  where exists (
    select 1 from information_schema.tables found
    where found.table_schema = 'public'
      and found.table_name = required.table_name
  )

  union all

  select
    'RLS-enabled V2 tables',
    '5',
    count(*)::text,
    case when count(*) = 5 then 'PASS' else 'FAIL' end
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  join required_tables required on required.table_name = c.relname
  where n.nspname = 'public'
    and c.relrowsecurity

  union all

  select
    'required public V2 functions',
    '5',
    count(distinct required.function_name)::text,
    case when count(distinct required.function_name) = 5 then 'PASS' else 'FAIL' end
  from required_functions required
  where exists (
    select 1 from information_schema.routines found
    where found.routine_schema = 'public'
      and found.routine_name = required.function_name
  )

  union all

  select
    'null exercise-template unilateral flags',
    '0',
    count(*)::text,
    case when count(*) = 0 then 'PASS' else 'FAIL' end
  from public.exercise_templates
  where is_unilateral is null

  union all

  select
    'null workout-exercise unilateral flags',
    '0',
    count(*)::text,
    case when count(*) = 0 then 'PASS' else 'FAIL' end
  from public.workout_exercises
  where is_unilateral is null

  union all

  select
    'unsupported goal statuses',
    '0',
    count(*)::text,
    case when count(*) = 0 then 'PASS' else 'FAIL' end
  from public.goals
  where status not in ('active', 'completed', 'paused')

  union all

  select
    'Rip City corrected medicine-ball templates',
    '3',
    count(*)::text,
    case when count(*) = 3 then 'PASS' else 'FAIL' end
  from public.exercise_templates et
  join public.facilities f on f.id = et.facility_id
  where f.slug = 'rip-city'
    and lower(et.name) in (
      'med ball chest pass', 'med ball shot put', 'med ball slam'
    )
    and et.input_type = 'weight_reps'

  union all

  select
    'Rip City Vertical Jump distance template',
    'at least 1',
    count(*)::text,
    case when count(*) >= 1 then 'PASS' else 'FAIL' end
  from public.exercise_templates et
  join public.facilities f on f.id = et.facility_id
  where f.slug = 'rip-city'
    and lower(et.name) = 'vertical jump'
    and et.input_type = 'distance'
)
select check_name, expected, actual, result
from checks
order by check_name;
