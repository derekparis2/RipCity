-- RIP CITY V2 STAGING-ONLY LEADERBOARD DEMO DATA
--
-- Purpose:
-- - Add five display-only H2K members and five display-only athletes.
-- - Seed rolling habit scores, ties, streaks, workout attendance, and no-score
--   cases around the date this script is run.
-- - Keep rch2k@example.com and rcathlete@example.com as the login-capable
--   accounts used to verify the matching member dashboard cards.
--
-- Safe to rerun in Rip City Staging. Never run in production.

begin;

do $$
begin
  if not exists (
    select 1 from public.facilities where slug = 'test-facility-alpha'
  ) or not exists (
    select 1 from public.profiles where email = 'rccoach@example.com'
  ) or not exists (
    select 1 from public.profiles where email = 'rch2k@example.com'
  ) then
    raise exception 'Refusing leaderboard seed: this does not look like Rip City Staging.';
  end if;
end
$$;

-- These profiles intentionally have no matching auth.users rows. Coaches can
-- see them in staging leaderboards, but nobody can sign in as them.
insert into public.profiles (id, email, full_name, username, global_role)
values
  ('40000000-0000-4000-8000-000000000001', 'leader-h2k-1@example.com', 'H2K Test Leader', 'leader_h2k_1', 'member'),
  ('40000000-0000-4000-8000-000000000002', 'leader-h2k-2@example.com', 'H2K Test Consistent', 'leader_h2k_2', 'member'),
  ('40000000-0000-4000-8000-000000000003', 'leader-h2k-3@example.com', 'H2K Test Tie', 'leader_h2k_3', 'member'),
  ('40000000-0000-4000-8000-000000000004', 'leader-h2k-4@example.com', 'H2K Test Building', 'leader_h2k_4', 'member'),
  ('40000000-0000-4000-8000-000000000005', 'leader-h2k-5@example.com', 'H2K Test Starter', 'leader_h2k_5', 'member'),
  ('40000000-0000-4000-8000-000000000011', 'leader-athlete-1@example.com', 'Athlete Test Perfect', 'leader_athlete_1', 'member'),
  ('40000000-0000-4000-8000-000000000012', 'leader-athlete-2@example.com', 'Athlete Test Strong', 'leader_athlete_2', 'member'),
  ('40000000-0000-4000-8000-000000000013', 'leader-athlete-3@example.com', 'Athlete Test Tie', 'leader_athlete_3', 'member'),
  ('40000000-0000-4000-8000-000000000014', 'leader-athlete-4@example.com', 'Athlete Test Building', 'leader_athlete_4', 'member'),
  ('40000000-0000-4000-8000-000000000015', 'leader-athlete-5@example.com', 'Athlete Test No Workouts', 'leader_athlete_5', 'member')
on conflict (id) do update set
  email = excluded.email,
  full_name = excluded.full_name,
  username = excluded.username,
  global_role = excluded.global_role;

insert into public.facility_members (
  id, facility_id, profile_id, role, status, approved_by, approved_at
)
select
  fixture.membership_id::uuid,
  facility.id,
  fixture.profile_id::uuid,
  fixture.role,
  'approved',
  admin_profile.id,
  now()
from (values
  ('41000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', 'h2k_member'),
  ('41000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000002', 'h2k_member'),
  ('41000000-0000-4000-8000-000000000003', '40000000-0000-4000-8000-000000000003', 'h2k_member'),
  ('41000000-0000-4000-8000-000000000004', '40000000-0000-4000-8000-000000000004', 'h2k_member'),
  ('41000000-0000-4000-8000-000000000005', '40000000-0000-4000-8000-000000000005', 'h2k_member'),
  ('41000000-0000-4000-8000-000000000011', '40000000-0000-4000-8000-000000000011', 'athlete'),
  ('41000000-0000-4000-8000-000000000012', '40000000-0000-4000-8000-000000000012', 'athlete'),
  ('41000000-0000-4000-8000-000000000013', '40000000-0000-4000-8000-000000000013', 'athlete'),
  ('41000000-0000-4000-8000-000000000014', '40000000-0000-4000-8000-000000000014', 'athlete'),
  ('41000000-0000-4000-8000-000000000015', '40000000-0000-4000-8000-000000000015', 'athlete')
) as fixture(membership_id, profile_id, role)
cross join lateral (
  select id from public.facilities where slug = 'rip-city'
) facility
cross join lateral (
  select id from public.profiles where email = 'rcadmin@example.com'
) admin_profile
on conflict (id) do update set
  facility_id = excluded.facility_id,
  profile_id = excluded.profile_id,
  role = excluded.role,
  status = excluded.status,
  approved_by = excluded.approved_by,
  approved_at = excluded.approved_at;

insert into public.member_profiles (
  id, facility_member_id, member_type, sport, age_group, position
)
values
  ('42000000-0000-4000-8000-000000000001', '41000000-0000-4000-8000-000000000001', 'h2k', null, null, null),
  ('42000000-0000-4000-8000-000000000002', '41000000-0000-4000-8000-000000000002', 'h2k', null, null, null),
  ('42000000-0000-4000-8000-000000000003', '41000000-0000-4000-8000-000000000003', 'h2k', null, null, null),
  ('42000000-0000-4000-8000-000000000004', '41000000-0000-4000-8000-000000000004', 'h2k', null, null, null),
  ('42000000-0000-4000-8000-000000000005', '41000000-0000-4000-8000-000000000005', 'h2k', null, null, null),
  ('42000000-0000-4000-8000-000000000011', '41000000-0000-4000-8000-000000000011', 'athlete', 'Baseball', '14-15', 'Catcher'),
  ('42000000-0000-4000-8000-000000000012', '41000000-0000-4000-8000-000000000012', 'athlete', 'Baseball', '14-15', 'Pitcher'),
  ('42000000-0000-4000-8000-000000000013', '41000000-0000-4000-8000-000000000013', 'athlete', 'Baseball', '14-15', 'Shortstop'),
  ('42000000-0000-4000-8000-000000000014', '41000000-0000-4000-8000-000000000014', 'athlete', 'Baseball', '14-15', 'Outfield'),
  ('42000000-0000-4000-8000-000000000015', '41000000-0000-4000-8000-000000000015', 'athlete', 'Baseball', '14-15', 'First Base')
on conflict (id) do update set
  facility_member_id = excluded.facility_member_id,
  member_type = excluded.member_type,
  sport = excluded.sport,
  age_group = excluded.age_group,
  position = excluded.position;

insert into public.group_members (id, group_id, member_profile_id)
select
  fixture.group_membership_id::uuid,
  group_row.id,
  fixture.member_profile_id::uuid
from (values
  ('43000000-0000-4000-8000-000000000001', '42000000-0000-4000-8000-000000000001', 'H2K'),
  ('43000000-0000-4000-8000-000000000002', '42000000-0000-4000-8000-000000000002', 'H2K'),
  ('43000000-0000-4000-8000-000000000003', '42000000-0000-4000-8000-000000000003', 'H2K'),
  ('43000000-0000-4000-8000-000000000004', '42000000-0000-4000-8000-000000000004', 'H2K'),
  ('43000000-0000-4000-8000-000000000005', '42000000-0000-4000-8000-000000000005', 'H2K'),
  ('43000000-0000-4000-8000-000000000011', '42000000-0000-4000-8000-000000000011', '14-15'),
  ('43000000-0000-4000-8000-000000000012', '42000000-0000-4000-8000-000000000012', '14-15'),
  ('43000000-0000-4000-8000-000000000013', '42000000-0000-4000-8000-000000000013', '14-15'),
  ('43000000-0000-4000-8000-000000000014', '42000000-0000-4000-8000-000000000014', '14-15'),
  ('43000000-0000-4000-8000-000000000015', '42000000-0000-4000-8000-000000000015', '14-15')
) as fixture(group_membership_id, member_profile_id, group_name)
join public.groups group_row on group_row.name = fixture.group_name
join public.facilities facility on facility.id = group_row.facility_id and facility.slug = 'rip-city'
on conflict (id) do update set
  group_id = excluded.group_id,
  member_profile_id = excluded.member_profile_id;

-- Remove only prior rows owned by this repeatable leaderboard fixture.
delete from public.habit_logs where notes = 'leaderboard-fixture-v1';

with h2k_members (member_profile_id, weekly_score, current_streak) as (
  values
    ('20000000-0000-4000-8000-000000000004'::uuid, 30, 3),
    ('42000000-0000-4000-8000-000000000001'::uuid, 42, 7),
    ('42000000-0000-4000-8000-000000000002'::uuid, 36, 5),
    ('42000000-0000-4000-8000-000000000003'::uuid, 30, 3),
    ('42000000-0000-4000-8000-000000000004'::uuid, 20, 1),
    ('42000000-0000-4000-8000-000000000005'::uuid, 8, 0)
),
ranked_habits as (
  select
    h.id,
    row_number() over (order by h.name, h.id) as habit_number,
    count(*) over () as habit_count
  from public.habits h
  join public.facilities f on f.id = h.facility_id
  where f.slug = 'rip-city' and h.active = true
),
weekly_slots as (
  select
    member.member_profile_id,
    habit.id as habit_id,
    (date_trunc('week', (now() at time zone 'America/New_York')::date)::date - (week_number * 7) + day_offset)::date as log_date,
    ((day_offset * habit.habit_count) + habit.habit_number) as score_slot,
    member.weekly_score
  from h2k_members member
  cross join generate_series(1, 4) week_number
  cross join generate_series(0, 6) day_offset
  cross join ranked_habits habit
),
current_streak_slots as (
  select
    member.member_profile_id,
    habit.id as habit_id,
    ((now() at time zone 'America/New_York')::date - day_offset)::date as log_date
  from h2k_members member
  cross join lateral generate_series(0, greatest(member.current_streak - 1, -1)) day_offset
  cross join ranked_habits habit
  where member.current_streak > 0 and habit.habit_number <= 4
),
fixture_logs as (
  select member_profile_id, habit_id, log_date
  from weekly_slots
  where score_slot <= weekly_score
  union
  select member_profile_id, habit_id, log_date
  from current_streak_slots
)
insert into public.habit_logs (
  member_profile_id, habit_id, log_date, completed, points_earned, notes
)
select member_profile_id, habit_id, log_date, true, 1, 'leaderboard-fixture-v1'
from fixture_logs
on conflict (member_profile_id, habit_id, log_date) do update set
  completed = excluded.completed,
  points_earned = excluded.points_earned,
  notes = excluded.notes;

-- One one-set fixture workout makes attendance deterministic and lightweight.
delete from public.workouts where id = '44000000-0000-4000-8000-000000000001';

insert into public.workouts (
  id, facility_id, title, focus, description, estimated_minutes, created_by
)
select
  '44000000-0000-4000-8000-000000000001',
  facility.id,
  'STAGING Leaderboard Attendance Fixture',
  'Leaderboard QA',
  'Fake staging-only workout used to verify attendance ranking.',
  10,
  coach.id
from public.facilities facility
cross join lateral (select id from public.profiles where email = 'rccoach@example.com') coach
where facility.slug = 'rip-city';

insert into public.workout_blocks (id, workout_id, name, block_order)
values (
  '44000000-0000-4000-8000-000000000002',
  '44000000-0000-4000-8000-000000000001',
  'Attendance Check',
  1
);

insert into public.workout_exercises (
  id, workout_id, block_id, name, description, sets, reps, input_type, exercise_order
)
values (
  '44000000-0000-4000-8000-000000000003',
  '44000000-0000-4000-8000-000000000001',
  '44000000-0000-4000-8000-000000000002',
  'STAGING Attendance Check',
  'Fake completion-only exercise.',
  1,
  '1',
  'completion',
  1
);

with athlete_members (member_profile_id) as (
  values
    ('20000000-0000-4000-8000-000000000003'::uuid),
    ('42000000-0000-4000-8000-000000000011'::uuid),
    ('42000000-0000-4000-8000-000000000012'::uuid),
    ('42000000-0000-4000-8000-000000000013'::uuid),
    ('42000000-0000-4000-8000-000000000014'::uuid)
),
assignment_dates as (
  select (date_trunc('week', (now() at time zone 'America/New_York')::date)::date - (week_number * 7) + day_offset)::date as assigned_date
  from generate_series(1, 4) week_number
  cross join (values (1), (4)) offsets(day_offset)
  union
  select date_trunc('week', (now() at time zone 'America/New_York')::date)::date
  union
  select (now() at time zone 'America/New_York')::date
)
insert into public.workout_assignments (
  id,
  workout_id,
  assigned_by,
  target_type,
  target_member_profile_id,
  assigned_date,
  due_date
)
select
  md5(member.member_profile_id::text || ':' || date_row.assigned_date::text)::uuid,
  '44000000-0000-4000-8000-000000000001',
  coach.id,
  'member',
  member.member_profile_id,
  date_row.assigned_date,
  date_row.assigned_date
from athlete_members member
cross join assignment_dates date_row
cross join lateral (select id from public.profiles where email = 'rccoach@example.com') coach;

with completion_targets (member_profile_id, completed_previous, completed_current) as (
  values
    ('20000000-0000-4000-8000-000000000003'::uuid, 6, 2),
    ('42000000-0000-4000-8000-000000000011'::uuid, 8, 2),
    ('42000000-0000-4000-8000-000000000012'::uuid, 7, 1),
    ('42000000-0000-4000-8000-000000000013'::uuid, 6, 2),
    ('42000000-0000-4000-8000-000000000014'::uuid, 4, 0)
),
ranked_assignments as (
  select
    assignment.*,
    case
      when assignment.assigned_date < date_trunc('week', (now() at time zone 'America/New_York')::date)::date
      then row_number() over (
        partition by assignment.target_member_profile_id,
          (assignment.assigned_date < date_trunc('week', (now() at time zone 'America/New_York')::date)::date)
        order by assignment.assigned_date desc
      )
      else row_number() over (
        partition by assignment.target_member_profile_id,
          (assignment.assigned_date >= date_trunc('week', (now() at time zone 'America/New_York')::date)::date)
        order by assignment.assigned_date asc
      )
    end as period_rank,
    assignment.assigned_date < date_trunc('week', (now() at time zone 'America/New_York')::date)::date as is_previous
  from public.workout_assignments assignment
  where assignment.workout_id = '44000000-0000-4000-8000-000000000001'
),
completed_assignments as (
  select ranked.*
  from ranked_assignments ranked
  join completion_targets target
    on target.member_profile_id = ranked.target_member_profile_id
  where
    (ranked.is_previous and ranked.period_rank <= target.completed_previous)
    or
    (not ranked.is_previous and ranked.period_rank <= target.completed_current)
)
insert into public.exercise_set_logs (
  workout_assignment_id,
  member_profile_id,
  exercise_id,
  set_number,
  completed,
  logged_at
)
select
  assignment.id,
  assignment.target_member_profile_id,
  '44000000-0000-4000-8000-000000000003',
  1,
  true,
  assignment.assigned_date::timestamp + interval '18 hours'
from completed_assignments assignment;

commit;

select
  (select count(*) from public.profiles where email like 'leader-%@example.com') as display_only_members,
  (select count(*) from public.habit_logs where notes = 'leaderboard-fixture-v1') as fixture_habit_logs,
  (select count(*) from public.workout_assignments where workout_id = '44000000-0000-4000-8000-000000000001') as fixture_assignments,
  (select count(*) from public.exercise_set_logs where exercise_id = '44000000-0000-4000-8000-000000000003') as completed_fixture_assignments;
