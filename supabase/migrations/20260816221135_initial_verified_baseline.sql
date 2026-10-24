-- RIP CITY VERIFIED INITIAL BASELINE
-- Verified in Rip City Staging on 2026-08-16.
-- Fresh empty projects only. Never run blindly on production.

begin;

-- =====================================================
-- ARCHIVED SOURCE: sql/archive/applied/supabase_schema.sql
-- =====================================================

create extension if not exists "pgcrypto";

-- =====================================================
-- FACILITIES
-- =====================================================

create table facilities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  logo_url text,
  primary_color text,
  secondary_color text,
  created_at timestamptz not null default now()
);

-- =====================================================
-- USER PROFILES
-- Supabase Auth will handle login.
-- This table stores app-specific profile data.
-- =====================================================

create table profiles (
  id uuid primary key,
  email text not null unique,
  full_name text not null,
  global_role text not null default 'member'
    check (global_role in ('member', 'coach', 'admin')),
  created_at timestamptz not null default now()
);

-- =====================================================
-- FACILITY MEMBERS
-- Connects users to Rip City or future facilities.
-- =====================================================

create table facility_members (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references facilities(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  role text not null check (role in ('athlete', 'h2k_member', 'coach', 'admin', 'parent')),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'inactive')),
  approved_by uuid references profiles(id) on delete set null,
  approved_at timestamptz,  created_at timestamptz not null default now(),
  unique (facility_id, profile_id)
);

-- =====================================================
-- MEMBER PROFILES
-- One profile for athletes and H2K members.
-- Baseball athletes and H2K members can have different dashboards.
-- =====================================================

create table member_profiles (
  id uuid primary key default gen_random_uuid(),
  facility_member_id uuid not null references facility_members(id) on delete cascade,

  member_type text not null check (member_type in ('athlete', 'h2k')),
  sport text,
  age_group text,
  position text,
  school text,
  graduation_year integer,
  body_weight numeric,

  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (facility_member_id)
);

-- =====================================================
-- GROUPS
-- H2K can start as one default group.
-- Athletes can expand later by sport, age, team, program, etc.
-- =====================================================

create table groups (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references facilities(id) on delete cascade,
  name text not null,
  group_type text not null default 'program'
    check (group_type in ('sport', 'age', 'team', 'program', 'h2k', 'custom')),
  member_type text not null check (member_type in ('athlete', 'h2k', 'both')),
  created_at timestamptz not null default now(),
  unique (facility_id, name)
);

create table group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  member_profile_id uuid not null references member_profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (group_id, member_profile_id)
);

-- =====================================================
-- HABITS
-- H2K uses 6 habits, 42 points/week, rolling 4-week average.
-- Athletes can use habits later if needed.
-- =====================================================

create table habits (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references facilities(id) on delete cascade,
  name text not null,
  description text,
  points_per_day integer not null default 1,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (facility_id, name)
);

create table habit_logs (
  id uuid primary key default gen_random_uuid(),
  member_profile_id uuid not null references member_profiles(id) on delete cascade,
  habit_id uuid not null references habits(id) on delete cascade,
  log_date date not null,
  completed boolean not null default false,
  points_earned integer not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  unique (member_profile_id, habit_id, log_date)
);

-- =====================================================
-- WORKOUTS
-- Supports TeamBuildr-style replacement later.
-- =====================================================

create table workouts (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references facilities(id) on delete cascade,
  title text not null,
  focus text,
  description text,
  estimated_minutes integer,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table workout_blocks (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references workouts(id) on delete cascade,
  name text not null,
  block_order integer not null default 0
);

create table workout_exercises (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references workouts(id) on delete cascade,
  block_id uuid references workout_blocks(id) on delete set null,

  name text not null,
  description text,
  tempo text,
  sets integer,
  reps text,
  percentage text,
  rest_time text,
  video_url text,
  coach_note text,

  input_type text not null default 'completion'
    check (input_type in ('weight_reps', 'band_color', 'completion', 'time', 'distance', 'custom')),

  exercise_order integer not null default 0
);

-- =====================================================
-- WORKOUT ASSIGNMENTS
-- Can assign to one athlete/member, one group, or everyone.
-- =====================================================

create table workout_assignments (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references workouts(id) on delete cascade,
  assigned_by uuid references profiles(id) on delete set null,

  target_type text not null check (target_type in ('facility', 'group', 'member')),
  target_facility_id uuid references facilities(id) on delete cascade,
  target_group_id uuid references groups(id) on delete cascade,
  target_member_profile_id uuid references member_profiles(id) on delete cascade,

  assigned_date date not null,
  due_date date,
  created_at timestamptz not null default now()
);

-- =====================================================
-- WORKOUT LOGS
-- Athletes can log each set.
-- Weight, reps, band color, or completion depends on exercise type.
-- =====================================================

create table exercise_set_logs (
  id uuid primary key default gen_random_uuid(),
  workout_assignment_id uuid not null references workout_assignments(id) on delete cascade,
  member_profile_id uuid not null references member_profiles(id) on delete cascade,
  exercise_id uuid not null references workout_exercises(id) on delete cascade,

  set_number integer not null,
  completed boolean not null default false,

  weight numeric,
  reps_completed integer,
  band_color text,
  time_value text,
  distance_value text,
  difficulty_rating integer check (difficulty_rating between 1 and 10),
  athlete_note text,

  logged_at timestamptz not null default now(),

  unique (workout_assignment_id, member_profile_id, exercise_id, set_number)
);

-- =====================================================
-- GOALS
-- Goals mostly come from coaches, based on Rip City's answer.
-- =====================================================

create table goals (
  id uuid primary key default gen_random_uuid(),
  member_profile_id uuid not null references member_profiles(id) on delete cascade,
  created_by uuid references profiles(id) on delete set null,

  source text not null default 'coach'
    check (source in ('coach', 'member')),

  name text not null,
  description text,
  current_value numeric,
  target_value numeric,
  unit text,
  status text not null default 'active'
    check (status in ('active', 'complete', 'paused')),

  visibility text not null default 'coach_member'
    check (visibility in ('coach_member', 'team', 'public')),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =====================================================
-- PROGRESS METRICS
-- For body weight, velo, strength numbers, sprint times, etc.
-- =====================================================

create table progress_entries (
  id uuid primary key default gen_random_uuid(),
  member_profile_id uuid not null references member_profiles(id) on delete cascade,
  recorded_by uuid references profiles(id) on delete set null,

  metric_name text not null,
  value numeric not null,
  unit text not null,
  recorded_date date not null,
  notes text,

  verified_by_coach boolean not null default false,
  created_at timestamptz not null default now()
);

-- =====================================================
-- COACH NOTES
-- Notes can go to everyone, groups, or individuals.
-- =====================================================

create table coach_notes (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references facilities(id) on delete cascade,
  created_by uuid references profiles(id) on delete set null,

  target_type text not null check (target_type in ('facility', 'group', 'member')),
  target_group_id uuid references groups(id) on delete cascade,
  target_member_profile_id uuid references member_profiles(id) on delete cascade,

  title text,
  body text not null,
  note_date date not null default current_date,
  created_at timestamptz not null default now()
);

-- =====================================================
-- PARENT ACCESS
-- For later.
-- =====================================================

create table parent_links (
  id uuid primary key default gen_random_uuid(),
  parent_profile_id uuid not null references profiles(id) on delete cascade,
  member_profile_id uuid not null references member_profiles(id) on delete cascade,
  relationship text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (parent_profile_id, member_profile_id)
);

-- =====================================================
-- AI SUMMARIES
-- Stores coach summaries generated later.
-- =====================================================

create table ai_summaries (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references facilities(id) on delete cascade,
  created_for uuid references profiles(id) on delete set null,

  summary_type text not null check (summary_type in ('daily_coach', 'weekly_coach', 'athlete_risk', 'parent_summary')),
  summary_date date not null default current_date,
  body text not null,
  created_at timestamptz not null default now()
);

-- Add signup Links
create table facility_invites (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references facilities(id) on delete cascade,
  created_by uuid references profiles(id) on delete set null,

  invite_code text not null unique,
  default_role text not null check (default_role in ('athlete', 'h2k_member', 'parent')),
  default_member_type text check (default_member_type in ('athlete', 'h2k')),
  default_group_id uuid references groups(id) on delete set null,

  active boolean not null default true,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

-- =====================================================
-- INDEXES
-- =====================================================

create index facility_members_facility_id_idx on facility_members(facility_id);
create index facility_members_profile_id_idx on facility_members(profile_id);

create index member_profiles_member_type_idx on member_profiles(member_type);
create index member_profiles_age_group_idx on member_profiles(age_group);
create index member_profiles_sport_idx on member_profiles(sport);

create index group_members_group_id_idx on group_members(group_id);
create index group_members_member_profile_id_idx on group_members(member_profile_id);

create index habit_logs_member_date_idx on habit_logs(member_profile_id, log_date);
create index habit_logs_habit_date_idx on habit_logs(habit_id, log_date);

create index workout_assignments_date_idx on workout_assignments(assigned_date);
create index workout_assignments_target_idx on workout_assignments(target_type, target_group_id, target_member_profile_id);

create index exercise_set_logs_member_idx on exercise_set_logs(member_profile_id);
create index exercise_set_logs_assignment_idx on exercise_set_logs(workout_assignment_id);

create index goals_member_status_idx on goals(member_profile_id, status);

create index progress_entries_member_metric_date_idx on progress_entries(member_profile_id, metric_name, recorded_date);

create index coach_notes_facility_date_idx on coach_notes(facility_id, note_date);

create index ai_summaries_facility_date_idx on ai_summaries(facility_id, summary_date);

-- =====================================================
-- ARCHIVED SOURCE: sql/archive/applied/profile_fields_v1.sql
-- =====================================================

-- =====================================================
-- Profile fields used by the current Rip City profile UI
-- =====================================================
-- Purpose:
-- Keep clean database rebuilds aligned with the application.
--
-- Notes:
-- - This migration is non-destructive.
-- - The current live Supabase project appears to already have these columns.
-- - Do not run this automatically; apply it manually in Supabase only when
--   bringing a database up to the current app shape.

alter table public.profiles
  add column if not exists username text,
  add column if not exists bio text,
  add column if not exists birthday date,
  add column if not exists profile_picture_url text;

alter table public.member_profiles
  add column if not exists height text,
  add column if not exists training_focus text,
  add column if not exists favorite_lift text;

-- The canonical case-insensitive username index is created by
-- username_login_v1.sql. Keeping it there avoids two equivalent indexes in a
-- fresh database rebuild.


-- =====================================================
-- ARCHIVED SOURCE: sql/archive/applied/profile_gender_v1.sql
-- =====================================================

-- =====================================================
-- RIP CITY PROFILE GENDER FIELD
-- =====================================================
-- Non-destructive migration proposal. Run this in Supabase before expecting
-- profile.html to save the optional Gender dropdown.

alter table public.member_profiles
  add column if not exists gender text;

alter table public.member_profiles
  drop constraint if exists member_profiles_gender_check;

alter table public.member_profiles
  add constraint member_profiles_gender_check
  check (
    gender is null
    or gender in ('female', 'male', 'nonbinary', 'other')
  );


-- =====================================================
-- ARCHIVED SOURCE: sql/archive/applied/profile_gender_v2_remove_nonbinary.sql
-- =====================================================

-- =====================================================
-- RIP CITY PROFILE GENDER OPTIONS V2
-- =====================================================
-- Non-destructive follow-up to profile_gender_v1.sql.
-- Removes "nonbinary" from the allowed Gender dropdown values.

update public.member_profiles
set gender = null
where gender = 'nonbinary';

alter table public.member_profiles
  drop constraint if exists member_profiles_gender_check;

alter table public.member_profiles
  add constraint member_profiles_gender_check
  check (
    gender is null
    or gender in ('female', 'male', 'other')
  );


-- =====================================================
-- ARCHIVED SOURCE: sql/archive/applied/rls_policies_v1.sql
-- =====================================================

-- =====================================================
-- RIP CITY RLS POLICIES V1
-- =====================================================
-- Proposed migration only. Do not run until reviewed in a staging project.
--
-- Goals:
-- - Enable RLS on all public app tables.
-- - Keep anon access extremely narrow.
-- - Let pending signups create their own initial profile/membership rows.
-- - Let approved members access only their own/member-authorized data.
-- - Let coaches/admins manage data only inside their own facility.
-- - Avoid recursive RLS by doing membership checks through SECURITY DEFINER
--   helper functions.

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================
-- These functions are intentionally SECURITY DEFINER so policies can check
-- membership without recursively triggering RLS on facility_members.

create schema if not exists app_private;

create or replace function app_private.is_approved_facility_member(check_facility_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.facility_members fm
    where fm.facility_id = check_facility_id
      and fm.profile_id = auth.uid()
      and fm.status = 'approved'
      and fm.role in ('athlete', 'h2k_member', 'coach', 'admin')
  );
$$;

create or replace function app_private.is_facility_coach(check_facility_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.facility_members fm
    where fm.facility_id = check_facility_id
      and fm.profile_id = auth.uid()
      and fm.status = 'approved'
      and fm.role in ('coach', 'admin')
  );
$$;

create or replace function app_private.is_facility_admin(check_facility_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.facility_members fm
    where fm.facility_id = check_facility_id
      and fm.profile_id = auth.uid()
      and fm.status = 'approved'
      and fm.role = 'admin'
  );
$$;

create or replace function app_private.owns_member_profile(check_member_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.member_profiles mp
    join public.facility_members fm on fm.id = mp.facility_member_id
    where mp.id = check_member_profile_id
      and fm.profile_id = auth.uid()
  );
$$;

create or replace function app_private.member_profile_facility_id(check_member_profile_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select fm.facility_id
  from public.member_profiles mp
  join public.facility_members fm on fm.id = mp.facility_member_id
  where mp.id = check_member_profile_id
  limit 1;
$$;

create or replace function app_private.profile_global_role(check_profile_id uuid)
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.global_role
  from public.profiles p
  where p.id = check_profile_id
  limit 1;
$$;

create or replace function app_private.can_view_member_profile(check_member_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    app_private.owns_member_profile(check_member_profile_id)
    or app_private.is_facility_coach(app_private.member_profile_facility_id(check_member_profile_id));
$$;

create or replace function app_private.is_group_member(check_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.group_members gm
    join public.member_profiles mp on mp.id = gm.member_profile_id
    join public.facility_members fm on fm.id = mp.facility_member_id
    where gm.group_id = check_group_id
      and fm.profile_id = auth.uid()
      and fm.status = 'approved'
  );
$$;

create or replace function app_private.workout_facility_id(check_workout_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select w.facility_id
  from public.workouts w
  where w.id = check_workout_id
  limit 1;
$$;

create or replace function app_private.can_manage_workout(check_workout_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select app_private.is_facility_coach(app_private.workout_facility_id(check_workout_id));
$$;

create or replace function app_private.block_belongs_to_workout(check_block_id uuid, check_workout_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select check_block_id is null or exists (
    select 1
    from public.workout_blocks wb
    where wb.id = check_block_id
      and wb.workout_id = check_workout_id
  );
$$;

create or replace function app_private.valid_workout_assignment_scope(
  check_workout_id uuid,
  check_target_type text,
  check_target_facility_id uuid,
  check_target_group_id uuid,
  check_target_member_profile_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with workout_facility as (
    select w.facility_id
    from public.workouts w
    where w.id = check_workout_id
  )
  select case
    when check_target_type = 'facility' then
      check_target_facility_id = (select facility_id from workout_facility)
      and check_target_group_id is null
      and check_target_member_profile_id is null

    when check_target_type = 'group' then
      check_target_facility_id is null
      and check_target_member_profile_id is null
      and exists (
        select 1
        from public.groups g
        where g.id = check_target_group_id
          and g.facility_id = (select facility_id from workout_facility)
      )

    when check_target_type = 'member' then
      check_target_facility_id is null
      and check_target_group_id is null
      and app_private.member_profile_facility_id(check_target_member_profile_id) =
        (select facility_id from workout_facility)

    else false
  end;
$$;

create or replace function app_private.can_view_workout_assignment(check_assignment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.workout_assignments wa
    join public.workouts w on w.id = wa.workout_id
    where wa.id = check_assignment_id
      and (
        app_private.is_facility_coach(w.facility_id)
        or (
          app_private.is_approved_facility_member(w.facility_id)
          and (
            (wa.target_type = 'facility' and wa.target_facility_id = w.facility_id)
            or (wa.target_type = 'member' and app_private.owns_member_profile(wa.target_member_profile_id))
            or (wa.target_type = 'group' and app_private.is_group_member(wa.target_group_id))
          )
        )
      )
  );
$$;

create or replace function app_private.can_view_workout(check_workout_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    app_private.can_manage_workout(check_workout_id)
    or exists (
      select 1
      from public.workouts w
      where w.id = check_workout_id
        and w.created_by = auth.uid()
    )
    or exists (
      select 1
      from public.workout_assignments wa
      where wa.workout_id = check_workout_id
        and app_private.can_view_workout_assignment(wa.id)
    );
$$;

create or replace function app_private.exercise_belongs_to_assignment_workout(
  check_exercise_id uuid,
  check_assignment_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.workout_exercises we
    join public.workout_assignments wa on wa.workout_id = we.workout_id
    where we.id = check_exercise_id
      and wa.id = check_assignment_id
  );
$$;

create or replace function app_private.can_view_coach_note(check_note_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.coach_notes cn
    where cn.id = check_note_id
      and (
        app_private.is_facility_coach(cn.facility_id)
        or (
          app_private.is_approved_facility_member(cn.facility_id)
          and (
            cn.target_type = 'facility'
            or (cn.target_type = 'member' and app_private.owns_member_profile(cn.target_member_profile_id))
            or (cn.target_type = 'group' and app_private.is_group_member(cn.target_group_id))
          )
        )
      )
  );
$$;

create or replace function app_private.can_manage_coach_note_scope(
  check_facility_id uuid,
  check_target_type text,
  check_target_group_id uuid,
  check_target_member_profile_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case
    when check_target_type = 'facility' then
      check_target_group_id is null
      and check_target_member_profile_id is null

    when check_target_type = 'group' then
      check_target_member_profile_id is null
      and exists (
        select 1
        from public.groups g
        where g.id = check_target_group_id
          and g.facility_id = check_facility_id
      )

    when check_target_type = 'member' then
      check_target_group_id is null
      and app_private.member_profile_facility_id(check_target_member_profile_id) = check_facility_id

    else false
  end;
$$;

revoke all on schema app_private from public;
grant usage on schema app_private to authenticated;

revoke all on all functions in schema app_private from public;
grant execute on all functions in schema app_private to authenticated;

-- =====================================================
-- ENABLE RLS
-- =====================================================

alter table public.facilities enable row level security;
alter table public.profiles enable row level security;
alter table public.facility_members enable row level security;
alter table public.member_profiles enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.habits enable row level security;
alter table public.habit_logs enable row level security;
alter table public.workouts enable row level security;
alter table public.workout_blocks enable row level security;
alter table public.workout_exercises enable row level security;
alter table public.workout_assignments enable row level security;
alter table public.exercise_set_logs enable row level security;
alter table public.goals enable row level security;
alter table public.progress_entries enable row level security;
alter table public.coach_notes enable row level security;
alter table public.parent_links enable row level security;
alter table public.ai_summaries enable row level security;
alter table public.facility_invites enable row level security;

-- =====================================================
-- ROLE PRIVILEGES
-- =====================================================
-- RLS filters rows, but table privileges still decide which roles may attempt
-- a query at all. The live project currently has broad anon grants, so this
-- migration narrows anon before policies are created.
--
-- Public signup only needs to read the seeded Rip City facility before an auth
-- session exists. All other frontend app access should happen as authenticated
-- users and then be filtered by the policies below.

revoke all privileges on all tables in schema public from anon;
revoke all privileges on all sequences in schema public from anon;
revoke all privileges on all functions in schema public from anon;
revoke all privileges on all tables in schema public from authenticated;
revoke all privileges on all sequences in schema public from authenticated;

-- Future public objects start closed to the browser API. Each migration must
-- grant only the operations required by its reviewed RLS policies.
alter default privileges for role postgres in schema public
  revoke all privileges on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all privileges on sequences from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke execute on functions from anon, authenticated;

grant select on public.facilities, public.groups to anon;

grant select, insert, update, delete on
  public.facilities,
  public.profiles,
  public.facility_members,
  public.member_profiles,
  public.groups,
  public.group_members,
  public.habits,
  public.habit_logs,
  public.workouts,
  public.workout_blocks,
  public.workout_exercises,
  public.workout_assignments,
  public.exercise_set_logs,
  public.goals,
  public.progress_entries,
  public.coach_notes,
  public.parent_links,
  public.ai_summaries,
  public.facility_invites
to authenticated;

-- =====================================================
-- DROP EXISTING POLICIES BY NAME
-- =====================================================
-- This keeps the migration repeatable while still requiring a careful review
-- before first execution.

drop policy if exists "facilities anon can read rip city signup facility" on public.facilities;
drop policy if exists "facilities authenticated can read rip city signup facility" on public.facilities;
drop policy if exists "facilities members can read own facilities" on public.facilities;
drop policy if exists "facilities admins can update own facility" on public.facilities;

drop policy if exists "profiles users can insert own profile" on public.profiles;
drop policy if exists "profiles users can read own profile" on public.profiles;
drop policy if exists "profiles coaches can read facility profiles" on public.profiles;
drop policy if exists "profiles users can update own profile" on public.profiles;

drop policy if exists "facility_members users can insert own pending member row" on public.facility_members;
drop policy if exists "facility_members users can read own rows" on public.facility_members;
drop policy if exists "facility_members coaches can read facility rows" on public.facility_members;
drop policy if exists "facility_members coaches can update non coach rows" on public.facility_members;
drop policy if exists "facility_members admins can update facility rows" on public.facility_members;
drop policy if exists "facility_members admins can delete facility rows" on public.facility_members;

drop policy if exists "member_profiles users can insert own pending profile" on public.member_profiles;
drop policy if exists "member_profiles users can read own profile" on public.member_profiles;
drop policy if exists "member_profiles coaches can read facility profiles" on public.member_profiles;
drop policy if exists "member_profiles users can update own profile" on public.member_profiles;
drop policy if exists "member_profiles coaches can update facility profiles" on public.member_profiles;

drop policy if exists "groups members can read own facility groups" on public.groups;
drop policy if exists "groups anon can read rip city signup groups" on public.groups;
drop policy if exists "groups pending users can read signup facility groups" on public.groups;
drop policy if exists "groups coaches can insert facility groups" on public.groups;
drop policy if exists "groups coaches can update facility groups" on public.groups;
drop policy if exists "groups coaches can delete facility groups" on public.groups;

drop policy if exists "group_members users can read own group memberships" on public.group_members;
drop policy if exists "group_members users can insert own signup group membership" on public.group_members;
drop policy if exists "group_members coaches can read facility group memberships" on public.group_members;
drop policy if exists "group_members coaches can insert facility group memberships" on public.group_members;
drop policy if exists "group_members coaches can update facility group memberships" on public.group_members;
drop policy if exists "group_members coaches can delete facility group memberships" on public.group_members;

drop policy if exists "habits members can read facility habits" on public.habits;
drop policy if exists "habits coaches can insert facility habits" on public.habits;
drop policy if exists "habits coaches can update facility habits" on public.habits;
drop policy if exists "habits coaches can delete facility habits" on public.habits;

drop policy if exists "habit_logs users can read own logs" on public.habit_logs;
drop policy if exists "habit_logs coaches can read facility logs" on public.habit_logs;
drop policy if exists "habit_logs users can insert own logs" on public.habit_logs;
drop policy if exists "habit_logs users can update own logs" on public.habit_logs;
drop policy if exists "habit_logs users can delete own logs" on public.habit_logs;

drop policy if exists "workouts authorized users can read workouts" on public.workouts;
drop policy if exists "workouts coaches can insert facility workouts" on public.workouts;
drop policy if exists "workouts coaches can update facility workouts" on public.workouts;
drop policy if exists "workouts coaches can delete facility workouts" on public.workouts;

drop policy if exists "workout_blocks authorized users can read blocks" on public.workout_blocks;
drop policy if exists "workout_blocks coaches can insert blocks" on public.workout_blocks;
drop policy if exists "workout_blocks coaches can update blocks" on public.workout_blocks;
drop policy if exists "workout_blocks coaches can delete blocks" on public.workout_blocks;

drop policy if exists "workout_exercises authorized users can read exercises" on public.workout_exercises;
drop policy if exists "workout_exercises coaches can insert exercises" on public.workout_exercises;
drop policy if exists "workout_exercises coaches can update exercises" on public.workout_exercises;
drop policy if exists "workout_exercises coaches can delete exercises" on public.workout_exercises;

drop policy if exists "workout_assignments authorized users can read assignments" on public.workout_assignments;
drop policy if exists "workout_assignments coaches can insert assignments" on public.workout_assignments;
drop policy if exists "workout_assignments coaches can update assignments" on public.workout_assignments;
drop policy if exists "workout_assignments coaches can delete assignments" on public.workout_assignments;

drop policy if exists "exercise_set_logs users can read own logs" on public.exercise_set_logs;
drop policy if exists "exercise_set_logs coaches can read facility logs" on public.exercise_set_logs;
drop policy if exists "exercise_set_logs users can insert own logs" on public.exercise_set_logs;
drop policy if exists "exercise_set_logs users can update own logs" on public.exercise_set_logs;
drop policy if exists "exercise_set_logs users can delete own logs" on public.exercise_set_logs;

drop policy if exists "goals members and coaches can read goals" on public.goals;
drop policy if exists "goals members can insert own member goals" on public.goals;
drop policy if exists "goals coaches can insert facility goals" on public.goals;
drop policy if exists "goals members can update own goals" on public.goals;
drop policy if exists "goals coaches can update facility goals" on public.goals;
drop policy if exists "goals members can delete own member goals" on public.goals;
drop policy if exists "goals coaches can delete facility goals" on public.goals;

drop policy if exists "progress_entries members and coaches can read entries" on public.progress_entries;
drop policy if exists "progress_entries members can insert own entries" on public.progress_entries;
drop policy if exists "progress_entries coaches can insert facility entries" on public.progress_entries;
drop policy if exists "progress_entries members can update own unverified entries" on public.progress_entries;
drop policy if exists "progress_entries coaches can update facility entries" on public.progress_entries;
drop policy if exists "progress_entries members can delete own unverified entries" on public.progress_entries;
drop policy if exists "progress_entries coaches can delete facility entries" on public.progress_entries;

drop policy if exists "coach_notes authorized users can read notes" on public.coach_notes;
drop policy if exists "coach_notes coaches can insert facility notes" on public.coach_notes;
drop policy if exists "coach_notes coaches can update facility notes" on public.coach_notes;
drop policy if exists "coach_notes coaches can delete facility notes" on public.coach_notes;

drop policy if exists "parent_links coaches can read facility parent links" on public.parent_links;
drop policy if exists "parent_links coaches can insert facility parent links" on public.parent_links;
drop policy if exists "parent_links coaches can update facility parent links" on public.parent_links;
drop policy if exists "parent_links coaches can delete facility parent links" on public.parent_links;

drop policy if exists "ai_summaries coaches can read facility summaries" on public.ai_summaries;
drop policy if exists "ai_summaries coaches can insert facility summaries" on public.ai_summaries;
drop policy if exists "ai_summaries coaches can update facility summaries" on public.ai_summaries;
drop policy if exists "ai_summaries coaches can delete facility summaries" on public.ai_summaries;

drop policy if exists "facility_invites coaches can read facility invites" on public.facility_invites;
drop policy if exists "facility_invites coaches can insert facility invites" on public.facility_invites;
drop policy if exists "facility_invites coaches can update facility invites" on public.facility_invites;
drop policy if exists "facility_invites coaches can delete facility invites" on public.facility_invites;

-- =====================================================
-- FACILITIES
-- =====================================================

-- Current signup reads the seeded Rip City facility before signUp.
create policy "facilities anon can read rip city signup facility"
on public.facilities
for select
to anon
using (slug = 'rip-city');

-- Newly signed-up users need to read the signup facility before their pending
-- facility_members row exists.
create policy "facilities authenticated can read rip city signup facility"
on public.facilities
for select
to authenticated
using (slug = 'rip-city');

-- Authenticated users can read facilities where they have a membership row.
create policy "facilities members can read own facilities"
on public.facilities
for select
to authenticated
using (
  exists (
    select 1
    from public.facility_members fm
    where fm.facility_id = facilities.id
      and fm.profile_id = auth.uid()
  )
);

-- Only admins can update their own facility branding/config.
create policy "facilities admins can update own facility"
on public.facilities
for update
to authenticated
using (app_private.is_facility_admin(id))
with check (app_private.is_facility_admin(id));

-- No INSERT/DELETE policies: facilities should be provisioned by service role.

-- =====================================================
-- PROFILES
-- =====================================================

-- Signup may create exactly the authenticated user's own profile.
create policy "profiles users can insert own profile"
on public.profiles
for insert
to authenticated
with check (id = auth.uid());

-- Users can read their own profile.
create policy "profiles users can read own profile"
on public.profiles
for select
to authenticated
using (id = auth.uid());

-- Coaches/admins can read profiles belonging to members in their facility.
create policy "profiles coaches can read facility profiles"
on public.profiles
for select
to authenticated
using (
  exists (
    select 1
    from public.facility_members fm
    where fm.profile_id = profiles.id
      and app_private.is_facility_coach(fm.facility_id)
  )
);

-- Users can edit their own shared profile fields.
-- The global_role check prevents a member from promoting themself through a
-- direct API update. Role changes should happen only through trusted admin or
-- server workflows.
create policy "profiles users can update own profile"
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (
  id = auth.uid()
  and global_role = app_private.profile_global_role(id)
);

-- No DELETE policy: account/profile deletion should be an admin/server workflow.

-- =====================================================
-- FACILITY MEMBERS
-- =====================================================

-- Signup may create a pending member row for the authenticated user.
-- This preserves the current client signup flow while blocking self-approval.
create policy "facility_members users can insert own pending member row"
on public.facility_members
for insert
to authenticated
with check (
  profile_id = auth.uid()
  and status = 'pending'
  and role in ('athlete', 'h2k_member')
  and approved_by is null
  and approved_at is null
  and exists (
    select 1
    from public.facilities f
    where f.id = facility_members.facility_id
      and f.slug = 'rip-city'
  )
);

-- Users can read their own facility membership status.
create policy "facility_members users can read own rows"
on public.facility_members
for select
to authenticated
using (profile_id = auth.uid());

-- Coaches/admins can read all membership rows in their own facility.
create policy "facility_members coaches can read facility rows"
on public.facility_members
for select
to authenticated
using (app_private.is_facility_coach(facility_id));

-- Coaches can approve/reject ordinary members in their facility, but cannot
-- create or modify coach/admin membership rows.
create policy "facility_members coaches can update non coach rows"
on public.facility_members
for update
to authenticated
using (
  app_private.is_facility_coach(facility_id)
  and role in ('athlete', 'h2k_member', 'parent')
)
with check (
  app_private.is_facility_coach(facility_id)
  and role in ('athlete', 'h2k_member', 'parent')
);

-- Admins can update any membership row in their own facility.
create policy "facility_members admins can update facility rows"
on public.facility_members
for update
to authenticated
using (app_private.is_facility_admin(facility_id))
with check (app_private.is_facility_admin(facility_id));

-- Admins can delete membership rows in their facility for cleanup.
create policy "facility_members admins can delete facility rows"
on public.facility_members
for delete
to authenticated
using (app_private.is_facility_admin(facility_id));

-- =====================================================
-- MEMBER PROFILES
-- =====================================================

-- Signup may create a member profile connected to the user's own membership row.
create policy "member_profiles users can insert own pending profile"
on public.member_profiles
for insert
to authenticated
with check (
  exists (
    select 1
    from public.facility_members fm
    where fm.id = member_profiles.facility_member_id
      and fm.profile_id = auth.uid()
      and fm.status = 'pending'
      and fm.role in ('athlete', 'h2k_member')
      and (
        (fm.role = 'athlete' and member_profiles.member_type = 'athlete')
        or (fm.role = 'h2k_member' and member_profiles.member_type = 'h2k')
      )
  )
);

-- Users can read their own member profile.
create policy "member_profiles users can read own profile"
on public.member_profiles
for select
to authenticated
using (app_private.owns_member_profile(id));

-- Coaches/admins can read member profiles in their facility.
create policy "member_profiles coaches can read facility profiles"
on public.member_profiles
for select
to authenticated
using (app_private.is_facility_coach(app_private.member_profile_facility_id(id)));

-- Users can update their own member profile fields.
-- The role/type check keeps members from changing their program type through a
-- direct API update. Coaches can update facility member profiles through the
-- coach policy below.
create policy "member_profiles users can update own profile"
on public.member_profiles
for update
to authenticated
using (app_private.owns_member_profile(id))
with check (
  app_private.owns_member_profile(id)
  and exists (
    select 1
    from public.facility_members fm
    where fm.id = member_profiles.facility_member_id
      and fm.profile_id = auth.uid()
      and (
        (fm.role = 'athlete' and member_profiles.member_type = 'athlete')
        or (fm.role = 'h2k_member' and member_profiles.member_type = 'h2k')
      )
  )
);

-- Coaches/admins can update member profiles in their facility.
create policy "member_profiles coaches can update facility profiles"
on public.member_profiles
for update
to authenticated
using (app_private.is_facility_coach(app_private.member_profile_facility_id(id)))
with check (app_private.is_facility_coach(app_private.member_profile_facility_id(id)));

-- No DELETE policy: member profile deletion should happen through facility_members cleanup.

-- =====================================================
-- GROUPS / GROUP MEMBERS
-- =====================================================

-- Public signup may list only Rip City athlete groups so athletes can choose
-- the group that will drive group-assigned workout visibility after approval.
create policy "groups anon can read rip city signup groups"
on public.groups
for select
to anon
using (
  member_type in ('athlete', 'both')
  and exists (
    select 1
    from public.facilities f
    where f.id = groups.facility_id
      and f.slug = 'rip-city'
  )
);

-- Newly signed-up pending users may still need to read their signup facility's
-- groups during the profile/membership creation flow.
create policy "groups pending users can read signup facility groups"
on public.groups
for select
to authenticated
using (
  member_type in ('athlete', 'both')
  and exists (
    select 1
    from public.facility_members fm
    where fm.facility_id = groups.facility_id
      and fm.profile_id = auth.uid()
      and fm.status = 'pending'
      and fm.role = 'athlete'
  )
);

-- Approved members and coaches can read groups in their own facility.
create policy "groups members can read own facility groups"
on public.groups
for select
to authenticated
using (
  app_private.is_approved_facility_member(facility_id)
  or app_private.is_facility_coach(facility_id)
);

create policy "groups coaches can insert facility groups"
on public.groups
for insert
to authenticated
with check (app_private.is_facility_coach(facility_id));

create policy "groups coaches can update facility groups"
on public.groups
for update
to authenticated
using (app_private.is_facility_coach(facility_id))
with check (app_private.is_facility_coach(facility_id));

create policy "groups coaches can delete facility groups"
on public.groups
for delete
to authenticated
using (app_private.is_facility_coach(facility_id));

-- Users can read their own group memberships.
create policy "group_members users can read own group memberships"
on public.group_members
for select
to authenticated
using (app_private.owns_member_profile(member_profile_id));

-- Signup may place an athlete into their own selected athlete group while their
-- facility membership is still pending. Coaches can adjust groups later.
create policy "group_members users can insert own signup group membership"
on public.group_members
for insert
to authenticated
with check (
  app_private.owns_member_profile(member_profile_id)
  and exists (
    select 1
    from public.member_profiles mp
    join public.facility_members fm on fm.id = mp.facility_member_id
    where mp.id = group_members.member_profile_id
      and fm.profile_id = auth.uid()
      and fm.status = 'pending'
      and fm.role = 'athlete'
      and mp.member_type = 'athlete'
  )
  and exists (
    select 1
    from public.groups g
    where g.id = group_members.group_id
      and g.facility_id = app_private.member_profile_facility_id(group_members.member_profile_id)
      and g.member_type in ('athlete', 'both')
  )
);

-- Coaches/admins can read group memberships in their facility.
create policy "group_members coaches can read facility group memberships"
on public.group_members
for select
to authenticated
using (
  app_private.is_facility_coach(app_private.member_profile_facility_id(member_profile_id))
);

create policy "group_members coaches can insert facility group memberships"
on public.group_members
for insert
to authenticated
with check (
  app_private.is_facility_coach(app_private.member_profile_facility_id(member_profile_id))
  and exists (
    select 1
    from public.groups g
    where g.id = group_members.group_id
      and g.facility_id = app_private.member_profile_facility_id(group_members.member_profile_id)
  )
);

create policy "group_members coaches can update facility group memberships"
on public.group_members
for update
to authenticated
using (
  app_private.is_facility_coach(app_private.member_profile_facility_id(member_profile_id))
)
with check (
  app_private.is_facility_coach(app_private.member_profile_facility_id(member_profile_id))
  and exists (
    select 1
    from public.groups g
    where g.id = group_members.group_id
      and g.facility_id = app_private.member_profile_facility_id(group_members.member_profile_id)
  )
);

create policy "group_members coaches can delete facility group memberships"
on public.group_members
for delete
to authenticated
using (
  app_private.is_facility_coach(app_private.member_profile_facility_id(member_profile_id))
);

-- =====================================================
-- HABITS / HABIT LOGS
-- =====================================================

-- Approved members and coaches can read active/configured habits in their facility.
create policy "habits members can read facility habits"
on public.habits
for select
to authenticated
using (
  app_private.is_approved_facility_member(facility_id)
  or app_private.is_facility_coach(facility_id)
);

create policy "habits coaches can insert facility habits"
on public.habits
for insert
to authenticated
with check (app_private.is_facility_coach(facility_id));

create policy "habits coaches can update facility habits"
on public.habits
for update
to authenticated
using (app_private.is_facility_coach(facility_id))
with check (app_private.is_facility_coach(facility_id));

create policy "habits coaches can delete facility habits"
on public.habits
for delete
to authenticated
using (app_private.is_facility_coach(facility_id));

-- Members can read their own habit logs.
create policy "habit_logs users can read own logs"
on public.habit_logs
for select
to authenticated
using (app_private.owns_member_profile(member_profile_id));

-- Coaches/admins can read habit logs for members in their facility.
create policy "habit_logs coaches can read facility logs"
on public.habit_logs
for select
to authenticated
using (app_private.is_facility_coach(app_private.member_profile_facility_id(member_profile_id)));

-- Members can create logs only for their own profile and habits in their facility.
create policy "habit_logs users can insert own logs"
on public.habit_logs
for insert
to authenticated
with check (
  app_private.owns_member_profile(member_profile_id)
  and exists (
    select 1
    from public.habits h
    where h.id = habit_logs.habit_id
      and h.facility_id = app_private.member_profile_facility_id(habit_logs.member_profile_id)
  )
);

create policy "habit_logs users can update own logs"
on public.habit_logs
for update
to authenticated
using (app_private.owns_member_profile(member_profile_id))
with check (
  app_private.owns_member_profile(member_profile_id)
  and exists (
    select 1
    from public.habits h
    where h.id = habit_logs.habit_id
      and h.facility_id = app_private.member_profile_facility_id(habit_logs.member_profile_id)
  )
);

create policy "habit_logs users can delete own logs"
on public.habit_logs
for delete
to authenticated
using (app_private.owns_member_profile(member_profile_id));

-- =====================================================
-- WORKOUTS / BLOCKS / EXERCISES / ASSIGNMENTS
-- =====================================================

-- Members can read workouts assigned to them/group/facility; coaches can read
-- all workouts in their facility.
create policy "workouts authorized users can read workouts"
on public.workouts
for select
to authenticated
using (app_private.can_view_workout(id));

create policy "workouts coaches can insert facility workouts"
on public.workouts
for insert
to authenticated
with check (
  app_private.is_facility_coach(facility_id)
  and created_by = auth.uid()
);

create policy "workouts coaches can update facility workouts"
on public.workouts
for update
to authenticated
using (app_private.is_facility_coach(facility_id))
with check (app_private.is_facility_coach(facility_id));

create policy "workouts coaches can delete facility workouts"
on public.workouts
for delete
to authenticated
using (app_private.is_facility_coach(facility_id));

create policy "workout_blocks authorized users can read blocks"
on public.workout_blocks
for select
to authenticated
using (app_private.can_view_workout(workout_id));

create policy "workout_blocks coaches can insert blocks"
on public.workout_blocks
for insert
to authenticated
with check (app_private.can_manage_workout(workout_id));

create policy "workout_blocks coaches can update blocks"
on public.workout_blocks
for update
to authenticated
using (app_private.can_manage_workout(workout_id))
with check (app_private.can_manage_workout(workout_id));

create policy "workout_blocks coaches can delete blocks"
on public.workout_blocks
for delete
to authenticated
using (app_private.can_manage_workout(workout_id));

create policy "workout_exercises authorized users can read exercises"
on public.workout_exercises
for select
to authenticated
using (app_private.can_view_workout(workout_id));

create policy "workout_exercises coaches can insert exercises"
on public.workout_exercises
for insert
to authenticated
with check (
  app_private.can_manage_workout(workout_id)
  and app_private.block_belongs_to_workout(block_id, workout_id)
);

create policy "workout_exercises coaches can update exercises"
on public.workout_exercises
for update
to authenticated
using (app_private.can_manage_workout(workout_id))
with check (
  app_private.can_manage_workout(workout_id)
  and app_private.block_belongs_to_workout(block_id, workout_id)
);

create policy "workout_exercises coaches can delete exercises"
on public.workout_exercises
for delete
to authenticated
using (app_private.can_manage_workout(workout_id));

create policy "workout_assignments authorized users can read assignments"
on public.workout_assignments
for select
to authenticated
using (app_private.can_view_workout_assignment(id));

create policy "workout_assignments coaches can insert assignments"
on public.workout_assignments
for insert
to authenticated
with check (
  app_private.can_manage_workout(workout_id)
  and assigned_by = auth.uid()
  and app_private.valid_workout_assignment_scope(
    workout_id,
    target_type,
    target_facility_id,
    target_group_id,
    target_member_profile_id
  )
);

create policy "workout_assignments coaches can update assignments"
on public.workout_assignments
for update
to authenticated
using (app_private.can_manage_workout(workout_id))
with check (
  app_private.can_manage_workout(workout_id)
  and app_private.valid_workout_assignment_scope(
    workout_id,
    target_type,
    target_facility_id,
    target_group_id,
    target_member_profile_id
  )
);

create policy "workout_assignments coaches can delete assignments"
on public.workout_assignments
for delete
to authenticated
using (app_private.can_manage_workout(workout_id));

-- =====================================================
-- EXERCISE SET LOGS
-- =====================================================

create policy "exercise_set_logs users can read own logs"
on public.exercise_set_logs
for select
to authenticated
using (app_private.owns_member_profile(member_profile_id));

create policy "exercise_set_logs coaches can read facility logs"
on public.exercise_set_logs
for select
to authenticated
using (
  app_private.is_facility_coach(app_private.member_profile_facility_id(member_profile_id))
);

-- Members can log actual results only for themselves, only for assignments
-- they can view, and only for exercises in the assigned workout.
create policy "exercise_set_logs users can insert own logs"
on public.exercise_set_logs
for insert
to authenticated
with check (
  app_private.owns_member_profile(member_profile_id)
  and app_private.can_view_workout_assignment(workout_assignment_id)
  and app_private.exercise_belongs_to_assignment_workout(exercise_id, workout_assignment_id)
);

create policy "exercise_set_logs users can update own logs"
on public.exercise_set_logs
for update
to authenticated
using (app_private.owns_member_profile(member_profile_id))
with check (
  app_private.owns_member_profile(member_profile_id)
  and app_private.can_view_workout_assignment(workout_assignment_id)
  and app_private.exercise_belongs_to_assignment_workout(exercise_id, workout_assignment_id)
);

create policy "exercise_set_logs users can delete own logs"
on public.exercise_set_logs
for delete
to authenticated
using (app_private.owns_member_profile(member_profile_id));

-- =====================================================
-- GOALS
-- =====================================================

create policy "goals members and coaches can read goals"
on public.goals
for select
to authenticated
using (app_private.can_view_member_profile(member_profile_id));

-- Members can read their goals, but only coaches/admins can write goals for now.
-- This keeps member write access limited to profile/member profile, habits, and
-- exercise logs until the product adds a dedicated member goal workflow.
create policy "goals coaches can insert facility goals"
on public.goals
for insert
to authenticated
with check (
  app_private.is_facility_coach(app_private.member_profile_facility_id(member_profile_id))
  and source = 'coach'
  and created_by = auth.uid()
);

create policy "goals coaches can update facility goals"
on public.goals
for update
to authenticated
using (app_private.is_facility_coach(app_private.member_profile_facility_id(member_profile_id)))
with check (app_private.is_facility_coach(app_private.member_profile_facility_id(member_profile_id)));

create policy "goals coaches can delete facility goals"
on public.goals
for delete
to authenticated
using (app_private.is_facility_coach(app_private.member_profile_facility_id(member_profile_id)));

-- =====================================================
-- PROGRESS ENTRIES
-- =====================================================

create policy "progress_entries members and coaches can read entries"
on public.progress_entries
for select
to authenticated
using (app_private.can_view_member_profile(member_profile_id));

-- Members can read their progress entries, but progress writes stay coach/admin
-- only until a secure member progress workflow exists.
create policy "progress_entries coaches can insert facility entries"
on public.progress_entries
for insert
to authenticated
with check (
  app_private.is_facility_coach(app_private.member_profile_facility_id(member_profile_id))
  and recorded_by = auth.uid()
);

create policy "progress_entries coaches can update facility entries"
on public.progress_entries
for update
to authenticated
using (app_private.is_facility_coach(app_private.member_profile_facility_id(member_profile_id)))
with check (app_private.is_facility_coach(app_private.member_profile_facility_id(member_profile_id)));

create policy "progress_entries coaches can delete facility entries"
on public.progress_entries
for delete
to authenticated
using (app_private.is_facility_coach(app_private.member_profile_facility_id(member_profile_id)));

-- =====================================================
-- COACH NOTES
-- =====================================================

create policy "coach_notes authorized users can read notes"
on public.coach_notes
for select
to authenticated
using (app_private.can_view_coach_note(id));

create policy "coach_notes coaches can insert facility notes"
on public.coach_notes
for insert
to authenticated
with check (
  app_private.is_facility_coach(facility_id)
  and created_by = auth.uid()
  and app_private.can_manage_coach_note_scope(
    facility_id,
    target_type,
    target_group_id,
    target_member_profile_id
  )
);

create policy "coach_notes coaches can update facility notes"
on public.coach_notes
for update
to authenticated
using (app_private.is_facility_coach(facility_id))
with check (
  app_private.is_facility_coach(facility_id)
  and app_private.can_manage_coach_note_scope(
    facility_id,
    target_type,
    target_group_id,
    target_member_profile_id
  )
);

create policy "coach_notes coaches can delete facility notes"
on public.coach_notes
for delete
to authenticated
using (app_private.is_facility_coach(facility_id));

-- =====================================================
-- PARENT LINKS
-- =====================================================
-- Parent access is not enabled yet. Parents receive no direct access here.

create policy "parent_links coaches can read facility parent links"
on public.parent_links
for select
to authenticated
using (
  app_private.is_facility_coach(app_private.member_profile_facility_id(member_profile_id))
);

create policy "parent_links coaches can insert facility parent links"
on public.parent_links
for insert
to authenticated
with check (
  app_private.is_facility_coach(app_private.member_profile_facility_id(member_profile_id))
);

create policy "parent_links coaches can update facility parent links"
on public.parent_links
for update
to authenticated
using (
  app_private.is_facility_coach(app_private.member_profile_facility_id(member_profile_id))
)
with check (
  app_private.is_facility_coach(app_private.member_profile_facility_id(member_profile_id))
);

create policy "parent_links coaches can delete facility parent links"
on public.parent_links
for delete
to authenticated
using (
  app_private.is_facility_coach(app_private.member_profile_facility_id(member_profile_id))
);

-- =====================================================
-- AI SUMMARIES
-- =====================================================
-- AI summaries may contain sensitive coach analysis, so only coaches/admins
-- in the facility can access them for now.

create policy "ai_summaries coaches can read facility summaries"
on public.ai_summaries
for select
to authenticated
using (app_private.is_facility_coach(facility_id));

create policy "ai_summaries coaches can insert facility summaries"
on public.ai_summaries
for insert
to authenticated
with check (
  app_private.is_facility_coach(facility_id)
  and created_for = auth.uid()
);

create policy "ai_summaries coaches can update facility summaries"
on public.ai_summaries
for update
to authenticated
using (app_private.is_facility_coach(facility_id))
with check (app_private.is_facility_coach(facility_id));

create policy "ai_summaries coaches can delete facility summaries"
on public.ai_summaries
for delete
to authenticated
using (app_private.is_facility_coach(facility_id));

-- =====================================================
-- FACILITY INVITES
-- =====================================================
-- The current signup flow does not use invite codes yet. Keep invites private
-- to coaches/admins until the app has a secure invite lookup flow.

create policy "facility_invites coaches can read facility invites"
on public.facility_invites
for select
to authenticated
using (app_private.is_facility_coach(facility_id));

create policy "facility_invites coaches can insert facility invites"
on public.facility_invites
for insert
to authenticated
with check (
  app_private.is_facility_coach(facility_id)
  and created_by = auth.uid()
);

create policy "facility_invites coaches can update facility invites"
on public.facility_invites
for update
to authenticated
using (app_private.is_facility_coach(facility_id))
with check (app_private.is_facility_coach(facility_id));

create policy "facility_invites coaches can delete facility invites"
on public.facility_invites
for delete
to authenticated
using (app_private.is_facility_coach(facility_id));

-- =====================================================
-- SIGNUP NOTES
-- =====================================================
-- The current client signup flow:
-- 1. anon SELECT facilities where slug = 'rip-city'
-- 2. auth.signUp(...)
-- 3. authenticated INSERT profiles
-- 4. authenticated INSERT facility_members with status = 'pending'
-- 5. authenticated INSERT member_profiles linked to that pending membership
--
-- This migration preserves that flow only when Supabase returns an authenticated
-- session immediately after signUp. If email confirmation is enabled and the
-- user does not have a session yet, steps 3-5 will fail under RLS. In that case,
-- move profile/membership creation into a secure server-side signup handler or
-- an auth.users trigger that uses the service role/table owner.
--
-- The member_profiles insert policy also requires the selected signup type to
-- match the facility_members role: athlete -> athlete, h2k_member -> h2k.
--
-- Coaches/admins still approve users by updating facility_members.status.

-- =====================================================
-- TESTING CHECKLIST
-- =====================================================
-- Anon:
-- - Can SELECT only the Rip City facility row needed for current signup.
-- - Cannot SELECT profiles, memberships, workouts, habits, logs, notes,
--   parent links, AI summaries, or facility invites.
--
-- Fresh/pending signup:
-- - Can create own profiles row with id = auth.uid().
-- - Can create own pending facility_members row only for athlete/h2k_member.
-- - Can create own member_profiles row linked to that pending membership.
-- - Cannot self-approve, create coach/admin role, or read facility data broadly.
--
-- Approved H2K/athlete member:
-- - Can read own profile/member_profile and update own profile fields.
-- - Can read habits in own facility and CRUD only own habit_logs.
-- - Can read groups they belong to.
-- - Can read workouts assigned to their member profile, group, or facility.
-- - Can insert/update only their own exercise_set_logs for accessible assignments.
-- - Cannot create/update/delete workouts, blocks, exercises, or assignments.
-- - Cannot read another member's private logs/goals/progress unless assigned via
--   a future shared visibility feature.
--
-- Coach:
-- - Can read pending/approved members in their facility.
-- - Can approve/reject ordinary athlete/h2k/parent users in their facility.
-- - Cannot create or promote coach/admin membership rows unless also admin.
-- - Can create/manage workouts, blocks, exercises, assignments, groups, habits,
--   goals, progress entries, coach notes, invites, parent links, and AI summaries
--   only inside their facility.
--
-- Admin:
-- - Can do coach actions.
-- - Can update/delete facility membership rows in their facility, including
--   coach/admin rows.
--
-- Parent:
-- - No direct parent access is granted yet.


-- =====================================================
-- ARCHIVED SOURCE: sql/archive/applied/signup_group_selection_v1.sql
-- =====================================================

-- =====================================================
-- Signup group selection support
-- =====================================================
-- Purpose:
-- Allow athlete signups to choose an initial Rip City training group, then save
-- that selection into group_members while the member is still pending approval.
--
-- Safe to run after rls_policies_v1.sql.

grant select on public.groups to anon;

drop policy if exists "groups anon can read rip city signup groups" on public.groups;
drop policy if exists "groups pending users can read signup facility groups" on public.groups;
drop policy if exists "group_members users can insert own signup group membership" on public.group_members;

create policy "groups anon can read rip city signup groups"
on public.groups
for select
to anon
using (
  member_type in ('athlete', 'both')
  and exists (
    select 1
    from public.facilities f
    where f.id = groups.facility_id
      and f.slug = 'rip-city'
  )
);

create policy "groups pending users can read signup facility groups"
on public.groups
for select
to authenticated
using (
  member_type in ('athlete', 'both')
  and exists (
    select 1
    from public.facility_members fm
    where fm.facility_id = groups.facility_id
      and fm.profile_id = auth.uid()
      and fm.status = 'pending'
      and fm.role = 'athlete'
  )
);

create policy "group_members users can insert own signup group membership"
on public.group_members
for insert
to authenticated
with check (
  app_private.owns_member_profile(member_profile_id)
  and exists (
    select 1
    from public.member_profiles mp
    join public.facility_members fm on fm.id = mp.facility_member_id
    where mp.id = group_members.member_profile_id
      and fm.profile_id = auth.uid()
      and fm.status = 'pending'
      and fm.role = 'athlete'
      and mp.member_type = 'athlete'
  )
  and exists (
    select 1
    from public.groups g
    where g.id = group_members.group_id
      and g.facility_id = app_private.member_profile_facility_id(group_members.member_profile_id)
      and g.member_type in ('athlete', 'both')
  )
);


-- =====================================================
-- ARCHIVED SOURCE: sql/archive/applied/username_login_v1.sql
-- =====================================================

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


-- =====================================================
-- ARCHIVED SOURCE: sql/archive/applied/h2k_band_color_v1.sql
-- =====================================================

-- =====================================================
-- H2K BAND COLOR V1
-- =====================================================
-- Proposed migration only. Do not run from Codex.
--
-- Purpose:
-- - Add a coach-managed H2K band color to member_profiles.
-- - H2K band color works like a karate belt/rank for training level.
-- - Members can read their own band color, but only approved facility
--   coaches/admins should be able to change it.

alter table public.member_profiles
  add column if not exists h2k_band_color text;

alter table public.member_profiles
  drop constraint if exists member_profiles_h2k_band_color_check;

alter table public.member_profiles
  add constraint member_profiles_h2k_band_color_check
  check (
    h2k_band_color is null
    or h2k_band_color in (
      'White',
      'Grey',
      'Green',
      'Blue',
      'Black',
      'Red'
    )
  );

-- Prevent members from changing their own H2K band color through the existing
-- "users can update own profile" policy. Coaches/admins in the member's
-- facility are allowed to change it from the roster.
create or replace function app_private.prevent_member_h2k_band_self_update()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  profile_facility_id uuid;
begin
  if tg_op = 'INSERT' and new.h2k_band_color is null then
    return new;
  end if;

  if tg_op = 'UPDATE' and new.h2k_band_color is not distinct from old.h2k_band_color then
    return new;
  end if;

  select fm.facility_id
  into profile_facility_id
  from public.facility_members fm
  where fm.id = new.facility_member_id;

  if app_private.is_facility_coach(profile_facility_id) then
    return new;
  end if;

  raise exception 'Only facility coaches can update H2K band color.';
end;
$$;

drop trigger if exists prevent_member_h2k_band_self_update
on public.member_profiles;

create trigger prevent_member_h2k_band_self_update
before insert or update of h2k_band_color
on public.member_profiles
for each row
execute function app_private.prevent_member_h2k_band_self_update();

-- Trigger execution does not require callers to invoke this SECURITY DEFINER
-- function directly. Remove the default PUBLIC execute privilege instead of
-- relying only on the private-schema boundary.
revoke all on function app_private.prevent_member_h2k_band_self_update() from public, anon, authenticated;


-- =====================================================
-- ARCHIVED SOURCE: sql/archive/applied/h2k_band_color_v2_levels.sql
-- =====================================================

-- =====================================================
-- H2K BAND COLOR LEVELS V2
-- =====================================================
-- Proposed migration only. Do not run from Codex.
--
-- Purpose:
-- - Correct the allowed H2K band order/levels to:
--   No Band, White, Grey, Green, Blue, Black, Red.
-- - "No Band" is stored as null.

alter table public.member_profiles
  drop constraint if exists member_profiles_h2k_band_color_check;

alter table public.member_profiles
  add constraint member_profiles_h2k_band_color_check
  check (
    h2k_band_color is null
    or h2k_band_color in (
      'White',
      'Grey',
      'Green',
      'Blue',
      'Black',
      'Red'
    )
  );


-- =====================================================
-- ARCHIVED SOURCE: sql/archive/applied/exercise_library_v1.sql
-- =====================================================

-- =====================================================
-- EXERCISE LIBRARY V1
-- =====================================================
-- Proposed migration only. Do not run until reviewed in staging/Supabase.
--
-- Purpose:
-- - Let coaches choose standardized exercises instead of typing every name.
-- - Keep exercise names consistent for history, PRs, progress, and future AI.
-- - Allow facility-specific libraries so each tenant controls its own exercise
--   terminology, equipment, videos, and substitution options.
--
-- RLS note:
-- This migration enables RLS, but the main rls_policies_v1.sql file should be
-- updated before production to include policies for these tables. Until then,
-- run this only in a reviewed environment with matching policies.

create table if not exists public.exercise_templates (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.facilities(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null,

  name text not null,
  category text,
  equipment text,
  movement_pattern text,
  input_type text not null default 'completion'
    check (input_type in ('weight_reps', 'band_color', 'completion', 'time', 'distance', 'custom')),

  description text,
  video_url text,
  coach_note text,
  active boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists exercise_templates_facility_name_idx
  on public.exercise_templates (facility_id, lower(name));

create index if not exists exercise_templates_facility_active_idx
  on public.exercise_templates (facility_id, active, name);

create table if not exists public.exercise_substitutions (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.facilities(id) on delete cascade,
  exercise_template_id uuid not null references public.exercise_templates(id) on delete cascade,
  substitute_exercise_template_id uuid not null references public.exercise_templates(id) on delete cascade,
  reason text,
  active boolean not null default true,
  created_at timestamptz not null default now(),

  check (exercise_template_id <> substitute_exercise_template_id),
  unique (exercise_template_id, substitute_exercise_template_id)
);

create index if not exists exercise_substitutions_facility_active_idx
  on public.exercise_substitutions (facility_id, active);

alter table public.exercise_templates enable row level security;
alter table public.exercise_substitutions enable row level security;

-- Supabase projects may give newly created public tables broad default API
-- privileges. Keep these tables closed to anon and grant authenticated users
-- only the operations that their RLS policies can authorize.
revoke all privileges on public.exercise_templates from anon, authenticated;
revoke all privileges on public.exercise_substitutions from anon, authenticated;
grant select, insert, update, delete on public.exercise_templates to authenticated;
grant select, insert, update, delete on public.exercise_substitutions to authenticated;

alter table public.workout_exercises
  add column if not exists exercise_template_id uuid
  references public.exercise_templates(id) on delete set null;

create index if not exists workout_exercises_template_idx
  on public.workout_exercises (exercise_template_id);

-- Coaches/admins can read and manage exercise templates inside their facility.
drop policy if exists "exercise_templates coaches can read facility templates" on public.exercise_templates;
drop policy if exists "exercise_templates coaches can insert facility templates" on public.exercise_templates;
drop policy if exists "exercise_templates coaches can update facility templates" on public.exercise_templates;
drop policy if exists "exercise_templates coaches can delete facility templates" on public.exercise_templates;

create policy "exercise_templates coaches can read facility templates"
on public.exercise_templates
for select
to authenticated
using (
  exists (
    select 1
    from public.facility_members fm
    where fm.facility_id = exercise_templates.facility_id
      and fm.profile_id = auth.uid()
      and fm.status = 'approved'
      and fm.role in ('coach', 'admin')
  )
);

create policy "exercise_templates coaches can insert facility templates"
on public.exercise_templates
for insert
to authenticated
with check (
  exists (
    select 1
    from public.facility_members fm
    where fm.facility_id = exercise_templates.facility_id
      and fm.profile_id = auth.uid()
      and fm.status = 'approved'
      and fm.role in ('coach', 'admin')
  )
  and created_by = auth.uid()
);

create policy "exercise_templates coaches can update facility templates"
on public.exercise_templates
for update
to authenticated
using (
  exists (
    select 1
    from public.facility_members fm
    where fm.facility_id = exercise_templates.facility_id
      and fm.profile_id = auth.uid()
      and fm.status = 'approved'
      and fm.role in ('coach', 'admin')
  )
)
with check (
  exists (
    select 1
    from public.facility_members fm
    where fm.facility_id = exercise_templates.facility_id
      and fm.profile_id = auth.uid()
      and fm.status = 'approved'
      and fm.role in ('coach', 'admin')
  )
);

create policy "exercise_templates coaches can delete facility templates"
on public.exercise_templates
for delete
to authenticated
using (
  exists (
    select 1
    from public.facility_members fm
    where fm.facility_id = exercise_templates.facility_id
      and fm.profile_id = auth.uid()
      and fm.status = 'approved'
      and fm.role in ('coach', 'admin')
  )
);

-- Substitution options stay coach-managed for now. Athlete swap UI should read
-- these later, but unrestricted athlete-created substitutions should not be
-- allowed without a product/security pass.
drop policy if exists "exercise_substitutions coaches can read facility substitutions" on public.exercise_substitutions;
drop policy if exists "exercise_substitutions coaches can insert facility substitutions" on public.exercise_substitutions;
drop policy if exists "exercise_substitutions coaches can update facility substitutions" on public.exercise_substitutions;
drop policy if exists "exercise_substitutions coaches can delete facility substitutions" on public.exercise_substitutions;
drop policy if exists "exercise substitutions coaches read facility rows" on public.exercise_substitutions;
drop policy if exists "exercise substitutions coaches insert facility rows" on public.exercise_substitutions;
drop policy if exists "exercise substitutions coaches update facility rows" on public.exercise_substitutions;
drop policy if exists "exercise substitutions coaches delete facility rows" on public.exercise_substitutions;

create policy "exercise substitutions coaches read facility rows"
on public.exercise_substitutions
for select
to authenticated
using (
  exists (
    select 1
    from public.facility_members fm
    where fm.facility_id = exercise_substitutions.facility_id
      and fm.profile_id = auth.uid()
      and fm.status = 'approved'
      and fm.role in ('coach', 'admin')
  )
);

create policy "exercise substitutions coaches insert facility rows"
on public.exercise_substitutions
for insert
to authenticated
with check (
  exists (
    select 1
    from public.facility_members fm
    where fm.facility_id = exercise_substitutions.facility_id
      and fm.profile_id = auth.uid()
      and fm.status = 'approved'
      and fm.role in ('coach', 'admin')
  )
  and exists (
    select 1
    from public.exercise_templates original
    join public.exercise_templates substitute
      on substitute.id = exercise_substitutions.substitute_exercise_template_id
    where original.id = exercise_substitutions.exercise_template_id
      and original.facility_id = exercise_substitutions.facility_id
      and substitute.facility_id = exercise_substitutions.facility_id
  )
);

create policy "exercise substitutions coaches update facility rows"
on public.exercise_substitutions
for update
to authenticated
using (
  exists (
    select 1
    from public.facility_members fm
    where fm.facility_id = exercise_substitutions.facility_id
      and fm.profile_id = auth.uid()
      and fm.status = 'approved'
      and fm.role in ('coach', 'admin')
  )
)
with check (
  exists (
    select 1
    from public.facility_members fm
    where fm.facility_id = exercise_substitutions.facility_id
      and fm.profile_id = auth.uid()
      and fm.status = 'approved'
      and fm.role in ('coach', 'admin')
  )
);

create policy "exercise substitutions coaches delete facility rows"
on public.exercise_substitutions
for delete
to authenticated
using (
  exists (
    select 1
    from public.facility_members fm
    where fm.facility_id = exercise_substitutions.facility_id
      and fm.profile_id = auth.uid()
      and fm.status = 'approved'
      and fm.role in ('coach', 'admin')
  )
);

-- Future athlete substitution direction:
-- Add performed_exercise_template_id and substitution_reason to set logs, or
-- create a workout_exercise_substitutions table. Start with coach-approved
-- substitution options, not unrestricted athlete swaps.


-- =====================================================
-- ARCHIVED SOURCE: sql/archive/applied/profile_picture_storage_v1.sql
-- =====================================================

-- =====================================================
-- Profile picture storage bucket and policies
-- =====================================================
-- Purpose:
-- Let approved/authenticated members upload their own profile picture files
-- into Supabase Storage. The public.profiles.profile_picture_url column stores
-- the resulting public URL.
--
-- Notes:
-- - Run this manually in the Supabase SQL Editor.
-- - This does not change public table structure.
-- - Files are stored under a folder named by auth.uid(), so members can only
--   write/delete their own images.

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'profile-pictures',
  'profile-pictures',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "profile pictures public read" on storage.objects;
create policy "profile pictures public read"
on storage.objects
for select
to anon, authenticated
using (
  bucket_id = 'profile-pictures'
);

drop policy if exists "members upload own profile pictures" on storage.objects;
create policy "members upload own profile pictures"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'profile-pictures'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "members update own profile pictures" on storage.objects;
create policy "members update own profile pictures"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'profile-pictures'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'profile-pictures'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "members delete own profile pictures" on storage.objects;
create policy "members delete own profile pictures"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'profile-pictures'
  and (storage.foldername(name))[1] = auth.uid()::text
);


-- =====================================================
-- ARCHIVED SOURCE: sql/archive/applied/seed_rip_city.sql
-- =====================================================

-- Seed Rip City facility
insert into facilities (name, slug, primary_color, secondary_color)
values ('Rip City', 'rip-city', '#ffffff', '#000000')
on conflict (slug) do nothing;

-- Seed Rip City groups
insert into groups (facility_id, name, group_type, member_type)
select id, 'H2K', 'h2k', 'h2k'
from facilities
where slug = 'rip-city'
on conflict (facility_id, name) do nothing;

insert into groups (facility_id, name, group_type, member_type)
select id, '12-13', 'age', 'athlete'
from facilities
where slug = 'rip-city'
on conflict (facility_id, name) do nothing;

insert into groups (facility_id, name, group_type, member_type)
select id, '14-15', 'age', 'athlete'
from facilities
where slug = 'rip-city'
on conflict (facility_id, name) do nothing;

insert into groups (facility_id, name, group_type, member_type)
select id, '16-18', 'age', 'athlete'
from facilities
where slug = 'rip-city'
on conflict (facility_id, name) do nothing;

insert into groups (facility_id, name, group_type, member_type)
select id, 'Older Elite', 'program', 'athlete'
from facilities
where slug = 'rip-city'
on conflict (facility_id, name) do nothing;

-- Seed H2K habits
insert into habits (facility_id, name, description, points_per_day)
select id, 'Sleep 7+ hours', 'Complete if you slept at least 7 hours.', 1
from facilities
where slug = 'rip-city'
on conflict (facility_id, name) do nothing;

insert into habits (facility_id, name, description, points_per_day)
select id, 'Training', 'Complete if you trained or completed your assigned physical work.', 1
from facilities
where slug = 'rip-city'
on conflict (facility_id, name) do nothing;

insert into habits (facility_id, name, description, points_per_day)
select id, 'Order of Environment', 'Complete if you kept your room, schedule, or environment organized.', 1
from facilities
where slug = 'rip-city'
on conflict (facility_id, name) do nothing;

insert into habits (facility_id, name, description, points_per_day)
select id, 'Skill Development', 'Complete if you worked on improving a skill.', 1
from facilities
where slug = 'rip-city'
on conflict (facility_id, name) do nothing;

insert into habits (facility_id, name, description, points_per_day)
select id, 'Relationship Building', 'Complete if you intentionally built or strengthened a relationship.', 1
from facilities
where slug = 'rip-city'
on conflict (facility_id, name) do nothing;

insert into habits (facility_id, name, description, points_per_day)
select id, 'Handling Responsibilities', 'Complete if you handled your responsibilities for the day.', 1
from facilities
where slug = 'rip-city'
on conflict (facility_id, name) do nothing;

-- =====================================================
-- ARCHIVED SOURCE: sql/archive/applied/exercise_library_seed_rip_city_v1.sql
-- =====================================================

-- =====================================================
-- RIP CITY STARTER EXERCISE LIBRARY V1
-- =====================================================
-- Proposed seed migration only. Do not run from Codex.
--
-- Run after sql/exercise_library_v1.sql.
--
-- Purpose:
-- - Give coaches a strong starter list of exercises for workout building.
-- - Coaches can still add their own facility-specific exercises in the app.
-- - This intentionally is not "every possible exercise"; it is a broad,
--   practical beta library for Rip City strength, speed, mobility, arm care,
--   H2K, and general athletic development.

with rip_city as (
  select id as facility_id
  from public.facilities
  where slug = 'rip-city'
),
starter_exercises(name, category, equipment, movement_pattern, input_type, description) as (
  values
    ('Trap Bar Deadlift', 'Strength', 'Trap bar', 'Hinge', 'weight_reps', 'Full-body strength hinge. Keep the ribs down, push the floor away, and finish tall.'),
    ('Barbell Deadlift', 'Strength', 'Barbell', 'Hinge', 'weight_reps', 'Hinge from the hips with a braced trunk and smooth bar path.'),
    ('Romanian Deadlift', 'Strength', 'Barbell or dumbbells', 'Hinge', 'weight_reps', 'Control the lowering phase and keep tension through hamstrings and glutes.'),
    ('Single-Leg RDL', 'Strength', 'Dumbbell or kettlebell', 'Single-leg hinge', 'weight_reps', 'Reach long through the back leg and keep hips square.'),
    ('Kettlebell Swing', 'Power', 'Kettlebell', 'Hinge', 'weight_reps', 'Explosive hip snap with a neutral spine and relaxed arms.'),
    ('Back Squat', 'Strength', 'Barbell', 'Squat', 'weight_reps', 'Brace, sit between the hips, and drive evenly through both feet.'),
    ('Front Squat', 'Strength', 'Barbell', 'Squat', 'weight_reps', 'Tall torso squat with elbows high and a strong brace.'),
    ('Goblet Squat', 'Strength', 'Dumbbell or kettlebell', 'Squat', 'weight_reps', 'Use as a clean squat pattern with depth and control.'),
    ('Split Squat', 'Strength', 'Dumbbells', 'Single-leg squat', 'weight_reps', 'Lower under control and drive through the front foot.'),
    ('Rear-Foot Elevated Split Squat', 'Strength', 'Bench and dumbbells', 'Single-leg squat', 'weight_reps', 'Single-leg strength with a stable front knee and tall posture.'),
    ('Lateral Lunge', 'Strength', 'Bodyweight or dumbbells', 'Lateral squat', 'weight_reps', 'Shift into one hip while the opposite leg stays long.'),
    ('Reverse Lunge', 'Strength', 'Bodyweight or dumbbells', 'Single-leg squat', 'weight_reps', 'Step back under control and drive through the front leg.'),
    ('Step-Up', 'Strength', 'Box and dumbbells', 'Single-leg squat', 'weight_reps', 'Use the working leg to stand tall without pushing off the back foot.'),
    ('Hip Thrust', 'Strength', 'Barbell or bodyweight', 'Hip extension', 'weight_reps', 'Finish with glutes, not low back.'),
    ('Glute Bridge', 'Activation', 'Bodyweight or band', 'Hip extension', 'completion', 'Create glute tension and keep ribs down.'),

    ('Bench Press', 'Strength', 'Barbell', 'Horizontal push', 'weight_reps', 'Controlled press with stable shoulders and strong leg drive.'),
    ('Dumbbell Bench Press', 'Strength', 'Dumbbells', 'Horizontal push', 'weight_reps', 'Press with even tempo and shoulder control.'),
    ('Incline Dumbbell Press', 'Strength', 'Dumbbells', 'Upper push', 'weight_reps', 'Press on an incline while keeping ribs down.'),
    ('Push-Up', 'Strength', 'Bodyweight', 'Horizontal push', 'completion', 'Straight body line, controlled lower, strong lockout.'),
    ('Tempo Push-Up', 'Strength', 'Bodyweight', 'Horizontal push', 'completion', 'Slow controlled lowering to build strength and position.'),
    ('Landmine Press', 'Strength', 'Landmine', 'Angled push', 'weight_reps', 'Press up and forward with trunk control.'),
    ('Half-Kneeling DB Press', 'Strength', 'Dumbbell', 'Vertical push', 'weight_reps', 'Press overhead from a stable half-kneeling position.'),
    ('Med Ball Chest Pass', 'Power', 'Medicine ball', 'Upper power', 'distance', 'Explosive chest pass with full-body intent.'),
    ('Med Ball Shot Put', 'Power', 'Medicine ball', 'Rotational power', 'distance', 'Rotate through the hips and throw with intent.'),
    ('Med Ball Slam', 'Power', 'Medicine ball', 'Total-body power', 'completion', 'Reach tall, slam hard, and reset each rep.'),

    ('Pull-Up', 'Strength', 'Pull-up bar', 'Vertical pull', 'completion', 'Pull with controlled shoulders and full-body tension.'),
    ('Assisted Pull-Up', 'Strength', 'Band or machine', 'Vertical pull', 'band_color', 'Use the lightest assistance that allows clean reps.'),
    ('Lat Pulldown', 'Strength', 'Cable machine', 'Vertical pull', 'weight_reps', 'Pull elbows down with a tall chest and quiet ribs.'),
    ('Seated Cable Row', 'Strength', 'Cable machine', 'Horizontal pull', 'weight_reps', 'Pull shoulder blades back without leaning through the torso.'),
    ('Chest-Supported Row', 'Strength', 'Bench and dumbbells', 'Horizontal pull', 'weight_reps', 'Keep chest supported and pull elbows toward hips.'),
    ('Single-Arm DB Row', 'Strength', 'Dumbbell', 'Horizontal pull', 'weight_reps', 'Row with control and avoid twisting.'),
    ('Band Row', 'Strength', 'Band', 'Horizontal pull', 'band_color', 'Squeeze shoulder blades back and control the return.'),
    ('Face Pull', 'Shoulder Health', 'Cable or band', 'Scapular control', 'weight_reps', 'Pull toward the face with elbows high and shoulder control.'),
    ('Band Pull-Apart', 'Shoulder Health', 'Band', 'Scapular control', 'band_color', 'Keep arms long and squeeze upper back.'),

    ('Box Jump', 'Power', 'Box', 'Jump', 'completion', 'Jump explosively and land quietly with control.'),
    ('Broad Jump', 'Power', 'Bodyweight', 'Jump', 'distance', 'Jump forward with full intent and stick the landing.'),
    ('Skater Jump', 'Power', 'Bodyweight', 'Lateral jump', 'completion', 'Drive side to side and land stable on one leg.'),
    ('Pogo Jump', 'Elasticity', 'Bodyweight', 'Ankle stiffness', 'completion', 'Quick contacts through the balls of the feet.'),
    ('Snap Down', 'Landing', 'Bodyweight', 'Landing mechanics', 'completion', 'Drop quickly into an athletic position and stick the landing.'),
    ('Depth Drop', 'Landing', 'Box', 'Landing mechanics', 'completion', 'Step off, absorb, and hold a strong landing.'),
    ('Countermovement Jump', 'Power', 'Bodyweight', 'Jump', 'completion', 'Explode vertically and land with control.'),
    ('Lateral Bound', 'Power', 'Bodyweight', 'Lateral power', 'completion', 'Push the ground away and own the landing.'),

    ('Sprint Start', 'Speed', 'Open space', 'Acceleration', 'time', 'Explode from a strong start position.'),
    ('10-Yard Sprint', 'Speed', 'Open space', 'Acceleration', 'time', 'Accelerate hard through the line.'),
    ('Flying 10', 'Speed', 'Open space', 'Max velocity', 'time', 'Build in, then sprint through a timed 10-yard zone.'),
    ('Shuttle Run', 'Conditioning', 'Cones', 'Change of direction', 'time', 'Change direction with low hips and sharp footwork.'),
    ('Pro Agility 5-10-5', 'Speed', 'Cones', 'Change of direction', 'time', 'Explode, plant, and redirect efficiently.'),
    ('Lateral Shuffle', 'Speed', 'Open space', 'Lateral movement', 'distance', 'Stay low and move side to side without crossing feet.'),
    ('Carioca', 'Warmup', 'Open space', 'Coordination', 'distance', 'Rotate hips while keeping shoulders controlled.'),
    ('A-Skip', 'Warmup', 'Open space', 'Sprint mechanics', 'distance', 'Rhythmical skip with tall posture and active foot strike.'),
    ('High Knees', 'Warmup', 'Open space', 'Sprint mechanics', 'distance', 'Tall posture with quick contacts.'),
    ('Backpedal', 'Speed', 'Open space', 'Backward movement', 'distance', 'Stay athletic and push through the floor.'),

    ('Pallof Press', 'Core', 'Cable or band', 'Anti-rotation', 'weight_reps', 'Press straight out while resisting rotation.'),
    ('Dead Bug', 'Core', 'Bodyweight', 'Anti-extension', 'completion', 'Move opposite arm and leg while keeping low back controlled.'),
    ('Bird Dog', 'Core', 'Bodyweight', 'Stability', 'completion', 'Reach long without shifting hips.'),
    ('Front Plank', 'Core', 'Bodyweight', 'Anti-extension', 'time', 'Brace hard with glutes tight and ribs down.'),
    ('Side Plank', 'Core', 'Bodyweight', 'Lateral core', 'time', 'Hold a straight line from head to feet.'),
    ('Hollow Hold', 'Core', 'Bodyweight', 'Anti-extension', 'time', 'Keep low back controlled while reaching long.'),
    ('Farmer Carry', 'Core', 'Dumbbells or kettlebells', 'Carry', 'distance', 'Walk tall with heavy handles and quiet shoulders.'),
    ('Suitcase Carry', 'Core', 'Dumbbell or kettlebell', 'Anti-lateral flexion', 'distance', 'Carry one side without leaning.'),
    ('Bear Crawl', 'Core', 'Bodyweight', 'Crawl', 'distance', 'Move opposite hand and foot with hips low.'),

    ('World''s Greatest Stretch', 'Mobility', 'Bodyweight', 'Hip and thoracic mobility', 'completion', 'Move slowly through lunge, rotation, and hamstring positions.'),
    ('90/90 Hip Switch', 'Mobility', 'Bodyweight', 'Hip mobility', 'completion', 'Rotate hips under control without rushing.'),
    ('Couch Stretch', 'Mobility', 'Bodyweight', 'Hip flexor mobility', 'time', 'Squeeze glute and breathe into the stretch.'),
    ('Ankle Rocks', 'Mobility', 'Bodyweight', 'Ankle mobility', 'completion', 'Drive knee forward while heel stays down.'),
    ('Thoracic Open Book', 'Mobility', 'Bodyweight', 'T-spine mobility', 'completion', 'Rotate through the upper back while hips stay stacked.'),
    ('Wall Slide', 'Shoulder Health', 'Wall', 'Scapular control', 'completion', 'Slide arms overhead while keeping ribs down.'),
    ('Scap Push-Up', 'Shoulder Health', 'Bodyweight', 'Scapular control', 'completion', 'Move shoulder blades without bending elbows.'),
    ('Band External Rotation', 'Shoulder Health', 'Band', 'Rotator cuff', 'band_color', 'Rotate with elbow pinned and shoulder quiet.'),
    ('Band Internal Rotation', 'Shoulder Health', 'Band', 'Rotator cuff', 'band_color', 'Rotate inward with steady shoulder position.'),
    ('Shoulder Taps', 'Core', 'Bodyweight', 'Anti-rotation', 'completion', 'Tap shoulders without rocking hips.'),

    ('J-Band Routine', 'Arm Care', 'J-Bands', 'Arm care', 'band_color', 'Complete the assigned arm care sequence with control.'),
    ('Band No Money', 'Arm Care', 'Band', 'External rotation', 'band_color', 'Rotate both hands out while keeping elbows near the ribs.'),
    ('Prone Y', 'Arm Care', 'Bench or floor', 'Lower trap', 'weight_reps', 'Lift thumbs toward the ceiling without shrugging.'),
    ('Prone T', 'Arm Care', 'Bench or floor', 'Upper back', 'weight_reps', 'Reach wide and squeeze shoulder blades.'),
    ('Prone W', 'Arm Care', 'Bench or floor', 'Scapular control', 'weight_reps', 'Pull elbows down and back with control.'),
    ('Serratus Wall Slide', 'Arm Care', 'Wall and band', 'Serratus', 'band_color', 'Slide up while reaching through the shoulder blades.'),
    ('Wrist Pronation/Supination', 'Arm Care', 'Dumbbell', 'Forearm', 'weight_reps', 'Rotate slowly through the forearm.'),
    ('Wrist Flexion/Extension', 'Arm Care', 'Dumbbell', 'Forearm', 'weight_reps', 'Control wrist movement through full range.'),

    ('Bike Sprint', 'Conditioning', 'Bike', 'Conditioning', 'time', 'Hard effort for the assigned interval.'),
    ('Row Sprint', 'Conditioning', 'Rower', 'Conditioning', 'time', 'Drive hard with legs, then finish with arms.'),
    ('Sled Push', 'Conditioning', 'Sled', 'Push', 'distance', 'Drive through the floor with a forward body angle.'),
    ('Sled Pull', 'Conditioning', 'Sled', 'Pull', 'distance', 'Pull with strong posture and steady steps.'),
    ('Battle Ropes', 'Conditioning', 'Ropes', 'Conditioning', 'time', 'Move with intent for the assigned work interval.'),
    ('Jump Rope', 'Conditioning', 'Jump rope', 'Elasticity', 'time', 'Stay light on the feet with steady rhythm.'),
    ('Walking Recovery', 'Recovery', 'Open space', 'Recovery', 'time', 'Easy pace recovery work.'),
    ('Breathing Reset', 'Recovery', 'Bodyweight', 'Recovery', 'time', 'Slow nasal breathing to downshift after training.')
)
insert into public.exercise_templates (
  facility_id,
  name,
  category,
  equipment,
  movement_pattern,
  input_type,
  description
)
select
  rip_city.facility_id,
  starter_exercises.name,
  starter_exercises.category,
  starter_exercises.equipment,
  starter_exercises.movement_pattern,
  starter_exercises.input_type,
  starter_exercises.description
from rip_city
cross join starter_exercises
on conflict do nothing;


commit;
