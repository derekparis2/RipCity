-- Limit reusable programs to their creating coach unless the current user is a
-- facility admin, and support copying any direct group/member calendar
-- selection while preserving the spacing between assignment dates.

drop policy if exists "workout programs staff can read facility programs" on public.workout_programs;
create policy "workout programs owners and admins can read"
on public.workout_programs for select to authenticated
using (
  created_by = auth.uid()
  or app_private.is_facility_admin(facility_id)
);

drop policy if exists "workout program items staff can read facility items" on public.workout_program_items;
create policy "workout program items owners and admins can read"
on public.workout_program_items for select to authenticated
using (
  exists (
    select 1
    from public.workout_programs wp
    where wp.id = workout_program_items.program_id
      and (
        wp.created_by = auth.uid()
        or app_private.is_facility_admin(wp.facility_id)
      )
  )
);

drop policy if exists "workout program launches staff can read facility launches" on public.workout_program_launches;
create policy "workout program launches owners and admins can read"
on public.workout_program_launches for select to authenticated
using (
  assigned_by = auth.uid()
  or app_private.is_facility_admin(facility_id)
);

drop policy if exists "workout program launch workouts staff can read facility rows" on public.workout_program_launch_workouts;
create policy "workout program launch workouts owners and admins can read"
on public.workout_program_launch_workouts for select to authenticated
using (
  exists (
    select 1
    from public.workout_program_launches wpl
    where wpl.id = workout_program_launch_workouts.launch_id
      and (
        wpl.assigned_by = auth.uid()
        or app_private.is_facility_admin(wpl.facility_id)
      )
  )
);

create or replace function app_private.enforce_workout_program_owner_or_admin()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.created_by <> auth.uid()
     and not app_private.is_facility_admin(old.facility_id) then
    raise exception 'Only the program creator or a facility admin may change this program';
  end if;
  if new.created_by is distinct from old.created_by
     or new.facility_id is distinct from old.facility_id then
    raise exception 'Program ownership and facility cannot be changed';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_workout_program_owner_or_admin on public.workout_programs;
create trigger enforce_workout_program_owner_or_admin
before update on public.workout_programs
for each row execute function app_private.enforce_workout_program_owner_or_admin();

create or replace function app_private.enforce_workout_program_launch_owner_or_admin()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  source_program public.workout_programs%rowtype;
begin
  select * into source_program
  from public.workout_programs
  where id = new.program_id;

  if source_program.id is null
     or source_program.facility_id is distinct from new.facility_id then
    raise exception 'Program launch does not match its facility';
  end if;
  if source_program.created_by <> auth.uid()
     and not app_private.is_facility_admin(source_program.facility_id) then
    raise exception 'Only the program creator or a facility admin may launch this program';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_workout_program_launch_owner_or_admin on public.workout_program_launches;
create trigger enforce_workout_program_launch_owner_or_admin
before insert on public.workout_program_launches
for each row execute function app_private.enforce_workout_program_launch_owner_or_admin();

create or replace function public.copy_workout_programming_assignments(
  check_assignment_ids uuid[],
  check_source_start date,
  check_destination_start date
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  assignment_row record;
  expected_count integer;
  copied_count integer := 0;
  target_facility_id uuid;
  expected_target_type text;
  expected_group_id uuid;
  expected_member_id uuid;
  copied_workout_id uuid;
  copied_date date;
begin
  if coalesce(cardinality(check_assignment_ids), 0) = 0 then
    raise exception 'Choose at least one workout assignment to copy';
  end if;
  if check_source_start is null or check_destination_start is null then
    raise exception 'Source and destination dates are required';
  end if;
  if check_source_start = check_destination_start then
    raise exception 'Choose a different destination date';
  end if;

  select count(distinct selected.selected_id) into expected_count
  from unnest(check_assignment_ids) as selected(selected_id);

  select w.facility_id, wa.target_type, wa.target_group_id, wa.target_member_profile_id
  into target_facility_id, expected_target_type, expected_group_id, expected_member_id
  from public.workout_assignments wa
  join public.workouts w on w.id = wa.workout_id
  where wa.id = check_assignment_ids[1];

  if target_facility_id is null or not app_private.is_facility_coach(target_facility_id) then
    raise exception 'Not authorized to copy these workout assignments';
  end if;
  if expected_target_type not in ('group', 'member') then
    raise exception 'Only direct group or member assignments can be copied';
  end if;

  for assignment_row in
    select wa.*, w.facility_id
    from public.workout_assignments wa
    join public.workouts w on w.id = wa.workout_id
    where wa.id = any(check_assignment_ids)
    order by wa.assigned_date, wa.created_at, wa.id
  loop
    if assignment_row.facility_id is distinct from target_facility_id
       or assignment_row.target_type is distinct from expected_target_type
       or assignment_row.target_group_id is distinct from expected_group_id
       or assignment_row.target_member_profile_id is distinct from expected_member_id then
      raise exception 'Every copied workout must use the same direct calendar target';
    end if;
    if assignment_row.assigned_date < check_source_start then
      raise exception 'The source start cannot be after a selected workout';
    end if;

    copied_workout_id := app_private.clone_workout_for_program(assignment_row.workout_id, auth.uid());
    copied_date := check_destination_start + (assignment_row.assigned_date - check_source_start);
    insert into public.workout_assignments (
      workout_id, assigned_by, target_type, target_facility_id,
      target_group_id, target_member_profile_id, assigned_date, due_date
    ) values (
      copied_workout_id, auth.uid(), assignment_row.target_type, target_facility_id,
      assignment_row.target_group_id, assignment_row.target_member_profile_id,
      copied_date, copied_date
    );
    copied_count := copied_count + 1;
  end loop;

  if copied_count <> expected_count then
    raise exception 'One or more selected workout assignments were not available';
  end if;
  return copied_count;
end;
$$;

revoke all on function public.copy_workout_programming_assignments(uuid[], date, date) from public;
grant execute on function public.copy_workout_programming_assignments(uuid[], date, date) to authenticated;
