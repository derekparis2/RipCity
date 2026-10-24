-- V2 production preflight (read-only)
-- Run in the PRODUCTION Supabase SQL Editor before applying any V2 migration.
-- Expected project reference: fdzmfohcuratbuitkwoy.

with required_public_tables(table_name) as (
  values
    ('facilities'), ('profiles'), ('facility_members'), ('member_profiles'),
    ('groups'), ('group_members'), ('habits'), ('habit_logs'), ('workouts'),
    ('workout_blocks'), ('workout_exercises'), ('workout_assignments'),
    ('exercise_set_logs'), ('goals'), ('progress_entries'), ('coach_notes'),
    ('parent_links'), ('ai_summaries'), ('facility_invites'),
    ('exercise_templates'), ('exercise_substitutions')
),
required_private_functions(function_name) as (
  values
    ('is_facility_coach'), ('is_facility_admin'),
    ('member_profile_facility_id'), ('owns_member_profile'),
    ('can_view_member_profile'), ('can_view_workout_assignment')
),
checks as (
  select
    'required pre-V2 public tables'::text as check_name,
    '21'::text as expected,
    count(*)::text as actual,
    case when count(*) = 21 then 'PASS' else 'FAIL' end as result
  from required_public_tables required
  where exists (
    select 1
    from information_schema.tables found
    where found.table_schema = 'public'
      and found.table_name = required.table_name
  )

  union all

  select
    'required app_private helpers',
    '6',
    count(distinct required.function_name)::text,
    case when count(distinct required.function_name) = 6 then 'PASS' else 'FAIL' end
  from required_private_functions required
  where exists (
    select 1
    from information_schema.routines found
    where found.routine_schema = 'app_private'
      and found.routine_name = required.function_name
  )

  union all

  select
    'Rip City facilities',
    '1',
    count(*)::text,
    case when count(*) = 1 then 'PASS' else 'FAIL' end
  from public.facilities
  where slug = 'rip-city'

  union all

  select
    'unsupported existing goal statuses',
    '0',
    count(*)::text,
    case when count(*) = 0 then 'PASS' else 'FAIL' end
  from public.goals
  where status not in ('active', 'complete', 'completed', 'paused')

  union all

  select
    'Rip City medicine-ball templates',
    '3',
    count(*)::text,
    case when count(*) = 3 then 'PASS' else 'FAIL' end
  from public.exercise_templates et
  join public.facilities f on f.id = et.facility_id
  where f.slug = 'rip-city'
    and lower(et.name) in (
      'med ball chest pass', 'med ball shot put', 'med ball slam'
    )

  union all

  select
    'Rip City prescribed-distance templates',
    '10',
    count(*)::text,
    case when count(*) = 10 then 'PASS' else 'FAIL' end
  from public.exercise_templates et
  join public.facilities f on f.id = et.facility_id
  where f.slug = 'rip-city'
    and lower(et.name) = any (array[
      'lateral shuffle', 'carioca', 'a-skip', 'high knees', 'backpedal',
      'farmer carry', 'suitcase carry', 'bear crawl', 'sled push', 'sled pull'
    ])

  union all

  select
    'Rip City Each Side templates',
    '20',
    count(*)::text,
    case when count(*) = 20 then 'PASS' else 'FAIL' end
  from public.exercise_templates et
  join public.facilities f on f.id = et.facility_id
  where f.slug = 'rip-city'
    and lower(et.name) = any (array[
      'single-leg rdl', 'split squat', 'rear-foot elevated split squat',
      'lateral lunge', 'reverse lunge', 'step-up', 'half-kneeling db press',
      'med ball shot put', 'single-arm db row', 'skater jump', 'lateral bound',
      'pallof press', 'side plank', 'suitcase carry', 'bird dog',
      'thoracic open book', 'band external rotation', 'band internal rotation',
      'wrist pronation/supination', 'wrist flexion/extension'
    ])
),
v2_markers as (
  select 'table public.goal_checkins'::text as object_name,
    exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = 'goal_checkins'
    ) as already_exists
  union all
  select 'table public.coach_announcements', exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'coach_announcements'
  )
  union all
  select 'column exercise_templates.is_unilateral', exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'exercise_templates'
      and column_name = 'is_unilateral'
  )
  union all
  select 'column groups.created_by', exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'groups'
      and column_name = 'created_by'
  )
)
select check_name, expected, actual, result
from checks
union all
select
  'pre-existing V2 marker: ' || object_name,
  'false (or reconcile before continuing)',
  already_exists::text,
  case when already_exists then 'REVIEW' else 'PASS' end
from v2_markers
order by check_name;

-- Record these counts privately with the release checklist. Do not publish
-- member data or the resulting backup in Git.
select 'profiles' as table_name, count(*) as row_count from public.profiles
union all select 'facility_members', count(*) from public.facility_members
union all select 'member_profiles', count(*) from public.member_profiles
union all select 'groups', count(*) from public.groups
union all select 'group_members', count(*) from public.group_members
union all select 'habit_logs', count(*) from public.habit_logs
union all select 'workouts', count(*) from public.workouts
union all select 'workout_assignments', count(*) from public.workout_assignments
union all select 'exercise_set_logs', count(*) from public.exercise_set_logs
union all select 'goals', count(*) from public.goals
union all select 'exercise_templates', count(*) from public.exercise_templates
order by table_name;
