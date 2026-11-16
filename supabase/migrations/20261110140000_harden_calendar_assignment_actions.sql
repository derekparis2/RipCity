-- Make calendar actions explicit and safe. Coaches can inspect action state,
-- bulk-unassign independent unstarted occurrences, or replace exactly one
-- occurrence with an edited workout snapshot.

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
    not state.started and not state.program_linked as can_edit,
    not state.started and not state.program_linked as can_unassign,
    not state.started
      and not state.program_linked
      and state.other_assignments = 0
      and not state.program_source as can_delete_workout,
    state.started,
    state.program_linked,
    state.other_assignments,
    case
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
    and app_private.is_facility_coach(workout.facility_id);
  if available_count <> requested_count then
    raise exception 'One or more assignments are unavailable';
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
  select assignment.*
  into assignment_row
  from public.workout_assignments assignment
  where assignment.id = check_assignment_id;

  original_workout_id := assignment_row.workout_id;

  select facility_id into original_facility_id
  from public.workouts
  where id = assignment_row.workout_id;

  select facility_id into replacement_facility_id
  from public.workouts
  where id = replacement_workout_id;

  if assignment_row.id is null
     or not app_private.is_facility_coach(original_facility_id) then
    raise exception 'Assignment not found or unavailable';
  end if;
  if replacement_facility_id is distinct from original_facility_id then
    raise exception 'Replacement workout must belong to the same facility';
  end if;
  if exists (
    select 1 from public.exercise_set_logs
    where workout_assignment_id = check_assignment_id
  ) then raise exception 'Started workouts cannot be edited'; end if;
  if exists (
    select 1 from public.workout_program_launch_workouts
    where assignment_id = check_assignment_id
  ) then raise exception 'Linked program workouts must be changed from the program'; end if;

  update public.workout_assignments
  set workout_id = replacement_workout_id
  where id = check_assignment_id;

  -- Editing one occurrence creates a replacement snapshot. Remove the old
  -- snapshot only when nothing else still uses it; shared assignments and
  -- program source workouts must remain intact.
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

revoke all on function public.get_workout_programming_action_states(uuid[]) from public;
revoke all on function public.remove_workout_programming_assignments(uuid[]) from public;
revoke all on function public.replace_workout_programming_assignment(uuid, uuid) from public;
grant execute on function public.get_workout_programming_action_states(uuid[]) to authenticated;
grant execute on function public.remove_workout_programming_assignments(uuid[]) to authenticated;
grant execute on function public.replace_workout_programming_assignment(uuid, uuid) to authenticated;
