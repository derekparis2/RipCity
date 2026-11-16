-- Coaches may view shared facility workouts, but only the workout creator or a
-- facility admin may assign, reassign, unassign, or delete a workout.

create or replace function app_private.can_create_workout(
  check_facility_id uuid,
  check_created_by uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select check_created_by = auth.uid()
    and exists (
      select 1
      from public.facility_members membership
      where membership.facility_id = check_facility_id
        and membership.profile_id = auth.uid()
        and membership.status = 'approved'
        and membership.role in ('coach', 'admin')
    );
$$;

revoke all on function app_private.can_create_workout(uuid, uuid) from public;
grant execute on function app_private.can_create_workout(uuid, uuid) to authenticated;

drop policy if exists "workouts coaches can insert facility workouts" on public.workouts;

create policy "workouts coaches can insert facility workouts"
on public.workouts
for insert
to authenticated
with check (app_private.can_create_workout(facility_id, created_by));

create or replace function app_private.can_assign_workout(check_workout_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.workouts workout
    where workout.id = check_workout_id
      and app_private.is_facility_coach(workout.facility_id)
      and (
        workout.created_by = auth.uid()
        or app_private.is_facility_admin(workout.facility_id)
      )
  );
$$;

drop policy if exists "workouts coaches can delete facility workouts" on public.workouts;
drop policy if exists "workouts creators and admins can delete facility workouts" on public.workouts;

create policy "workouts creators and admins can delete facility workouts"
on public.workouts
for delete
to authenticated
using (app_private.can_assign_workout(id));

-- Several calendar/program functions run as SECURITY DEFINER. Keep deletion
-- ownership enforced at the table boundary so those functions cannot bypass it.
create or replace function app_private.enforce_workout_delete_ownership()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is not null
     and not app_private.can_assign_workout(old.id) then
    raise exception 'Only the workout creator or a facility admin can delete this workout';
  end if;

  return old;
end;
$$;

drop trigger if exists enforce_workout_delete_ownership on public.workouts;
create trigger enforce_workout_delete_ownership
before delete on public.workouts
for each row execute function app_private.enforce_workout_delete_ownership();

drop policy if exists "workout_assignments coaches can insert assignments" on public.workout_assignments;
drop policy if exists "workout_assignments coaches can update assignments" on public.workout_assignments;
drop policy if exists "workout_assignments coaches can delete assignments" on public.workout_assignments;

create policy "workout_assignments coaches can insert assignments"
on public.workout_assignments
for insert
to authenticated
with check (
  app_private.can_assign_workout(workout_id)
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
using (app_private.can_assign_workout(workout_id))
with check (
  app_private.can_assign_workout(workout_id)
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
using (app_private.can_assign_workout(workout_id));

-- SECURITY DEFINER calendar/program RPCs bypass RLS. This trigger keeps the
-- same ownership boundary in force for every assignment mutation path.
create or replace function app_private.enforce_workout_assignment_ownership()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  if tg_op in ('UPDATE', 'DELETE')
     and not app_private.can_assign_workout(old.workout_id) then
    raise exception 'Only the workout creator or a facility admin can change this assignment';
  end if;

  if tg_op in ('INSERT', 'UPDATE')
     and not app_private.can_assign_workout(new.workout_id) then
    raise exception 'Only the workout creator or a facility admin can assign this workout';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_workout_assignment_ownership on public.workout_assignments;
create trigger enforce_workout_assignment_ownership
before insert or update or delete on public.workout_assignments
for each row execute function app_private.enforce_workout_assignment_ownership();

create or replace function public.get_workout_programming_action_states(
  check_assignment_ids uuid[]
)
returns table (
  assignment_id uuid,
  can_edit boolean,
  can_unassign boolean,
  can_delete_workout boolean,
  is_started boolean,
  is_program_linked boolean,
  other_assignment_count integer,
  reason text
)
language sql
security definer
set search_path = public, pg_temp
as $$
  select
    assignment.id,
    state.can_manage and not state.started and not state.program_linked as can_edit,
    state.can_manage and not state.started and not state.program_linked as can_unassign,
    state.can_manage
      and not state.started
      and not state.program_linked
      and state.other_assignments = 0
      and not state.program_source as can_delete_workout,
    state.started,
    state.program_linked,
    state.other_assignments,
    case
      when not state.can_manage then 'Only the workout creator or a facility admin can change this assignment.'
      when state.started then 'This workout already has member results.'
      when state.program_linked then 'This occurrence is linked to a program. Edit the program instead.'
      when state.other_assignments > 0 then 'This workout is assigned elsewhere, so only this occurrence can be unassigned.'
      when state.program_source then 'This workout is used by a program and cannot be deleted.'
      else null
    end
  from public.workout_assignments assignment
  join public.workouts workout on workout.id = assignment.workout_id
  cross join lateral (
    select
      app_private.can_assign_workout(workout.id) as can_manage,
      exists (
        select 1 from public.exercise_set_logs log
        where log.workout_assignment_id = assignment.id
      ) as started,
      exists (
        select 1 from public.workout_program_launch_workouts link
        where link.assignment_id = assignment.id
      ) as program_linked,
      exists (
        select 1 from public.workout_program_items item
        where item.source_workout_id = workout.id
      ) as program_source,
      (
        select count(*)::integer from public.workout_assignments other
        where other.workout_id = workout.id and other.id <> assignment.id
      ) as other_assignments
  ) state
  where assignment.id = any(coalesce(check_assignment_ids, '{}'::uuid[]))
    and app_private.is_facility_coach(workout.facility_id);
$$;

create or replace function public.remove_workout_programming_assignment(
  check_assignment_id uuid,
  check_delete_workout boolean default false
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  assignment_row public.workout_assignments%rowtype;
  other_assignments integer;
begin
  select assignment.* into assignment_row
  from public.workout_assignments assignment
  where assignment.id = check_assignment_id;

  if assignment_row.id is null
     or not app_private.can_assign_workout(assignment_row.workout_id) then
    raise exception 'Only the workout creator or a facility admin can change this assignment';
  end if;
  if exists (select 1 from public.exercise_set_logs where workout_assignment_id = check_assignment_id) then
    raise exception 'Started workouts cannot be unassigned or deleted';
  end if;
  if exists (select 1 from public.workout_program_launch_workouts where assignment_id = check_assignment_id) then
    raise exception 'Linked program workouts must be changed from the program';
  end if;

  select count(*) into other_assignments
  from public.workout_assignments
  where workout_id = assignment_row.workout_id and id <> check_assignment_id;

  delete from public.workout_assignments where id = check_assignment_id;
  if check_delete_workout then
    if other_assignments > 0 then
      raise exception 'Workout is still assigned elsewhere and cannot be deleted';
    end if;
    delete from public.workouts where id = assignment_row.workout_id;
  end if;
end;
$$;

create or replace function public.remove_workout_programming_assignments(
  check_assignment_ids uuid[]
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  requested_count integer;
  available_count integer;
  removed_count integer;
begin
  select count(distinct requested_id) into requested_count
  from unnest(coalesce(check_assignment_ids, '{}'::uuid[])) requested_id;
  if requested_count = 0 then raise exception 'Select at least one workout'; end if;

  select count(*) into available_count
  from public.workout_assignments assignment
  join public.workouts workout on workout.id = assignment.workout_id
  where assignment.id = any(check_assignment_ids)
    and app_private.can_assign_workout(workout.id);
  if available_count <> requested_count then
    raise exception 'Only the workout creator or a facility admin can change every selected assignment';
  end if;

  if exists (
    select 1 from public.exercise_set_logs log
    where log.workout_assignment_id = any(check_assignment_ids)
  ) then raise exception 'Started workouts cannot be unassigned'; end if;
  if exists (
    select 1 from public.workout_program_launch_workouts link
    where link.assignment_id = any(check_assignment_ids)
  ) then raise exception 'Linked program workouts must be changed from the program'; end if;

  delete from public.workout_assignments assignment
  where assignment.id = any(check_assignment_ids);
  get diagnostics removed_count = row_count;
  return removed_count;
end;
$$;

create or replace function public.replace_workout_programming_assignment(
  check_assignment_id uuid,
  replacement_workout_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  assignment_row public.workout_assignments%rowtype;
  original_workout_id uuid;
  original_facility_id uuid;
  replacement_facility_id uuid;
begin
  select assignment.* into assignment_row
  from public.workout_assignments assignment
  where assignment.id = check_assignment_id;

  original_workout_id := assignment_row.workout_id;
  select facility_id into original_facility_id from public.workouts where id = original_workout_id;
  select facility_id into replacement_facility_id from public.workouts where id = replacement_workout_id;

  if assignment_row.id is null
     or not app_private.can_assign_workout(original_workout_id) then
    raise exception 'Only the workout creator or a facility admin can edit this assignment';
  end if;
  if not app_private.can_assign_workout(replacement_workout_id) then
    raise exception 'Only the workout creator or a facility admin can assign the replacement workout';
  end if;
  if replacement_facility_id is distinct from original_facility_id then
    raise exception 'Replacement workout must belong to the same facility';
  end if;
  if exists (select 1 from public.exercise_set_logs where workout_assignment_id = check_assignment_id) then
    raise exception 'Started workouts cannot be edited';
  end if;
  if exists (select 1 from public.workout_program_launch_workouts where assignment_id = check_assignment_id) then
    raise exception 'Linked program workouts must be changed from the program';
  end if;

  update public.workout_assignments
  set workout_id = replacement_workout_id
  where id = check_assignment_id;

  delete from public.workouts workout
  where workout.id = original_workout_id
    and not exists (
      select 1 from public.workout_assignments assignment
      where assignment.workout_id = original_workout_id
    )
    and not exists (
      select 1 from public.workout_program_items item
      where item.source_workout_id = original_workout_id
    );
end;
$$;

revoke all on function app_private.can_assign_workout(uuid) from public;
revoke all on function public.get_workout_programming_action_states(uuid[]) from public;
revoke all on function public.remove_workout_programming_assignment(uuid, boolean) from public;
revoke all on function public.remove_workout_programming_assignments(uuid[]) from public;
revoke all on function public.replace_workout_programming_assignment(uuid, uuid) from public;
grant execute on function app_private.can_assign_workout(uuid) to authenticated;
grant execute on function public.get_workout_programming_action_states(uuid[]) to authenticated;
grant execute on function public.remove_workout_programming_assignment(uuid, boolean) to authenticated;
grant execute on function public.remove_workout_programming_assignments(uuid[]) to authenticated;
grant execute on function public.replace_workout_programming_assignment(uuid, uuid) to authenticated;
