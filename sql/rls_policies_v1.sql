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
