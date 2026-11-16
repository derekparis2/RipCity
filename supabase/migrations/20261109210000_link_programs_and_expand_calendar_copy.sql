-- Keep launched programs linked to their future, unstarted calendar workouts.
-- Calendar copies remain independent snapshots and may target multiple rosters
-- and destination dates in one transaction.

alter table public.workout_program_launch_workouts
  add column if not exists assignment_id uuid references public.workout_assignments(id) on delete cascade,
  add column if not exists assigned_date date;

update public.workout_program_launch_workouts link
set assignment_id = assignment.id,
    assigned_date = assignment.assigned_date
from public.workout_assignments assignment
where assignment.workout_id = link.workout_id
  and link.assignment_id is null;

alter table public.workout_program_launch_workouts
  drop constraint if exists workout_program_launch_workouts_program_item_id_fkey;

alter table public.workout_program_launch_workouts
  drop constraint if exists workout_program_launch_workouts_pkey;

alter table public.workout_program_launch_workouts
  alter column program_item_id drop not null;

alter table public.workout_program_launch_workouts
  add constraint workout_program_launch_workouts_pkey
  primary key (launch_id, workout_id);

alter table public.workout_program_launch_workouts
  add constraint workout_program_launch_workouts_program_item_id_fkey
  foreign key (program_item_id) references public.workout_program_items(id) on delete set null;

create unique index if not exists workout_program_launch_workouts_assignment_uidx
  on public.workout_program_launch_workouts(assignment_id)
  where assignment_id is not null;

create or replace function app_private.refresh_program_workout(
  check_workout_id uuid,
  check_source_workout_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  source_row public.workouts%rowtype;
  source_block record;
  new_block_id uuid;
begin
  select * into source_row from public.workouts where id = check_source_workout_id;
  if source_row.id is null then raise exception 'Source workout not found'; end if;

  update public.workouts
  set title = source_row.title,
      focus = source_row.focus,
      description = source_row.description,
      estimated_minutes = source_row.estimated_minutes
  where id = check_workout_id and facility_id = source_row.facility_id;
  if not found then raise exception 'Linked workout not found in the source facility'; end if;

  delete from public.workout_blocks where workout_id = check_workout_id;
  for source_block in
    select * from public.workout_blocks
    where workout_id = check_source_workout_id
    order by block_order, id
  loop
    new_block_id := gen_random_uuid();
    insert into public.workout_blocks (id, workout_id, name, block_order)
    values (new_block_id, check_workout_id, source_block.name, source_block.block_order);

    insert into public.workout_exercises (
      workout_id, block_id, name, description, tempo, sets, reps, percentage,
      rest_time, video_url, coach_note, input_type, exercise_order,
      exercise_template_id, is_unilateral
    )
    select
      check_workout_id, new_block_id, name, description, tempo, sets, reps,
      percentage, rest_time, video_url, coach_note, input_type, exercise_order,
      exercise_template_id, is_unilateral
    from public.workout_exercises
    where block_id = source_block.id
    order by exercise_order, id;
  end loop;
end;
$$;

revoke all on function app_private.refresh_program_workout(uuid, uuid) from public;

create or replace function public.save_workout_program(
  check_program_id uuid,
  check_facility_id uuid,
  check_name text,
  check_description text,
  check_duration_weeks integer,
  check_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  saved_program_id uuid;
  item jsonb;
  item_id uuid;
  desired_item_ids uuid[] := '{}'::uuid[];
  source_facility_id uuid;
  item_week integer;
  item_day integer;
  removed_item record;
  link_row record;
  launch_row record;
  current_item record;
  occurrence_date date;
  new_workout_id uuid;
  new_assignment_id uuid;
  is_locked boolean;
begin
  if not app_private.is_facility_coach(check_facility_id) then
    raise exception 'Not authorized to manage programs for this facility';
  end if;
  if nullif(btrim(check_name), '') is null then raise exception 'Program name is required'; end if;
  if check_duration_weeks not between 1 and 52 then raise exception 'Program duration must be between 1 and 52 weeks'; end if;
  if jsonb_typeof(coalesce(check_items, '[]'::jsonb)) <> 'array'
     or jsonb_array_length(coalesce(check_items, '[]'::jsonb)) = 0 then
    raise exception 'Add at least one workout to the program';
  end if;

  if check_program_id is null then
    insert into public.workout_programs (facility_id, name, description, duration_weeks, created_by)
    values (check_facility_id, btrim(check_name), nullif(btrim(check_description), ''), check_duration_weeks, auth.uid())
    returning id into saved_program_id;
  else
    update public.workout_programs
    set name = btrim(check_name), description = nullif(btrim(check_description), ''),
        duration_weeks = check_duration_weeks, updated_at = now()
    where id = check_program_id and facility_id = check_facility_id and archived_at is null
    returning id into saved_program_id;
    if saved_program_id is null then raise exception 'Program not found'; end if;
    update public.workout_program_items set item_order = item_order + 10000 where program_id = saved_program_id;
  end if;

  for item in select value from jsonb_array_elements(check_items)
  loop
    item_week := (item->>'week_number')::integer;
    item_day := (item->>'day_of_week')::integer;
    if item_week not between 1 and check_duration_weeks or item_day not between 1 and 7 then
      raise exception 'Program item falls outside the selected duration';
    end if;
    select facility_id into source_facility_id from public.workouts where id = (item->>'source_workout_id')::uuid;
    if source_facility_id is distinct from check_facility_id then raise exception 'Program workouts must belong to the same facility'; end if;

    item_id := case when nullif(item->>'id', '') is null then gen_random_uuid() else (item->>'id')::uuid end;
    if nullif(item->>'id', '') is not null
       and not exists (
         select 1
         from public.workout_program_items existing_item
         where existing_item.id = item_id
           and existing_item.program_id = saved_program_id
       ) then
      raise exception 'Program item does not belong to this program';
    end if;
    desired_item_ids := array_append(desired_item_ids, item_id);
    insert into public.workout_program_items (id, program_id, source_workout_id, week_number, day_of_week, item_order)
    values (item_id, saved_program_id, (item->>'source_workout_id')::uuid, item_week, item_day, coalesce((item->>'item_order')::integer, 0))
    on conflict (id) do update
    set source_workout_id = excluded.source_workout_id,
        week_number = excluded.week_number,
        day_of_week = excluded.day_of_week,
        item_order = excluded.item_order
    where workout_program_items.program_id = saved_program_id;
  end loop;

  for removed_item in
    select * from public.workout_program_items
    where program_id = saved_program_id and not (id = any(desired_item_ids))
  loop
    for link_row in
      select link.*, assignment.assigned_date
      from public.workout_program_launch_workouts link
      left join public.workout_assignments assignment on assignment.id = link.assignment_id
      where link.program_item_id = removed_item.id
    loop
      select exists (
        select 1 from public.exercise_set_logs where workout_assignment_id = link_row.assignment_id
      ) or coalesce(link_row.assigned_date, current_date) < current_date into is_locked;
      if is_locked then
        update public.workout_program_launch_workouts set program_item_id = null
        where launch_id = link_row.launch_id and workout_id = link_row.workout_id;
      else
        delete from public.workout_assignments where id = link_row.assignment_id;
        delete from public.workout_program_launch_workouts where launch_id = link_row.launch_id and workout_id = link_row.workout_id;
        delete from public.workouts where id = link_row.workout_id;
      end if;
    end loop;
    delete from public.workout_program_items where id = removed_item.id;
  end loop;

  for launch_row in select * from public.workout_program_launches where program_id = saved_program_id
  loop
    for current_item in select * from public.workout_program_items where program_id = saved_program_id
    loop
      occurrence_date := launch_row.start_date + (((current_item.week_number - 1) * 7) + (current_item.day_of_week - 1));
      select link.*, assignment.assigned_date
      into link_row
      from public.workout_program_launch_workouts link
      left join public.workout_assignments assignment on assignment.id = link.assignment_id
      where link.launch_id = launch_row.id and link.program_item_id = current_item.id;

      if link_row.workout_id is not null then
        select exists (
          select 1 from public.exercise_set_logs where workout_assignment_id = link_row.assignment_id
        ) or coalesce(link_row.assigned_date, occurrence_date) < current_date into is_locked;
        if not is_locked then
          if occurrence_date < current_date then
            -- Do not manufacture historical workouts when a future program slot
            -- is moved into the past. It can be recreated if moved forward later.
            delete from public.workout_assignments where id = link_row.assignment_id;
            delete from public.workout_program_launch_workouts
            where launch_id = launch_row.id and workout_id = link_row.workout_id;
            delete from public.workouts where id = link_row.workout_id;
          else
            perform app_private.refresh_program_workout(link_row.workout_id, current_item.source_workout_id);
            update public.workout_assignments
            set assigned_date = occurrence_date, due_date = occurrence_date
            where id = link_row.assignment_id;
            update public.workout_program_launch_workouts set assigned_date = occurrence_date
            where launch_id = launch_row.id and program_item_id = current_item.id;
          end if;
        end if;
      elsif occurrence_date >= current_date then
        new_workout_id := app_private.clone_workout_for_program(current_item.source_workout_id, auth.uid());
        insert into public.workout_assignments (
          workout_id, assigned_by, target_type, target_facility_id, target_group_id,
          target_member_profile_id, assigned_date, due_date
        ) values (
          new_workout_id, auth.uid(), launch_row.target_type, launch_row.facility_id,
          launch_row.target_group_id, launch_row.target_member_profile_id, occurrence_date, occurrence_date
        ) returning id into new_assignment_id;
        insert into public.workout_program_launch_workouts (
          launch_id, program_item_id, workout_id, assignment_id, assigned_date
        ) values (launch_row.id, current_item.id, new_workout_id, new_assignment_id, occurrence_date);
      end if;
    end loop;
  end loop;

  return saved_program_id;
end;
$$;

create or replace function public.launch_workout_program(
  check_program_id uuid,
  check_target_type text,
  check_target_id uuid,
  check_start_date date
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  program_row public.workout_programs%rowtype;
  launch_id uuid;
  item_row record;
  new_workout_id uuid;
  new_assignment_id uuid;
  assignment_date date;
  target_group uuid;
  target_member uuid;
begin
  select * into program_row from public.workout_programs where id = check_program_id and archived_at is null;
  if program_row.id is null then raise exception 'Program not found'; end if;
  if not app_private.is_facility_coach(program_row.facility_id) then raise exception 'Not authorized to launch this program'; end if;
  if check_start_date is null then raise exception 'Start date is required'; end if;
  if extract(isodow from check_start_date) <> 1 then raise exception 'Week 1 must start on a Monday'; end if;

  if check_target_type = 'group' then
    select id into target_group from public.groups where id = check_target_id and facility_id = program_row.facility_id;
    if target_group is null then raise exception 'Group not found in this facility'; end if;
  elsif check_target_type = 'member' then
    select mp.id into target_member from public.member_profiles mp
    join public.facility_members fm on fm.id = mp.facility_member_id
    where mp.id = check_target_id and fm.facility_id = program_row.facility_id and fm.status = 'approved';
    if target_member is null then raise exception 'Member not found in this facility'; end if;
  else
    raise exception 'Programs may be launched to a group or individual member';
  end if;

  insert into public.workout_program_launches (
    program_id, facility_id, target_type, target_group_id, target_member_profile_id, start_date, assigned_by
  ) values (
    program_row.id, program_row.facility_id, check_target_type, target_group, target_member, check_start_date, auth.uid()
  ) returning id into launch_id;

  for item_row in select * from public.workout_program_items where program_id = program_row.id order by week_number, day_of_week, item_order
  loop
    new_workout_id := app_private.clone_workout_for_program(item_row.source_workout_id, auth.uid());
    assignment_date := check_start_date + (((item_row.week_number - 1) * 7) + (item_row.day_of_week - 1));
    insert into public.workout_assignments (
      workout_id, assigned_by, target_type, target_facility_id, target_group_id,
      target_member_profile_id, assigned_date, due_date
    ) values (
      new_workout_id, auth.uid(), check_target_type, program_row.facility_id,
      target_group, target_member, assignment_date, assignment_date
    ) returning id into new_assignment_id;
    insert into public.workout_program_launch_workouts (
      launch_id, program_item_id, workout_id, assignment_id, assigned_date
    ) values (launch_id, item_row.id, new_workout_id, new_assignment_id, assignment_date);
  end loop;
  return launch_id;
end;
$$;

-- The original calendar-copy RPC accepted one date and implicitly reused the
-- current target. Remove it so clients cannot bypass destination previews.
drop function if exists public.copy_workout_programming_assignments(uuid[], date, date);

create or replace function public.copy_workout_programming_assignments(
  check_assignment_ids uuid[],
  check_source_start date,
  check_destinations jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  assignment_row record;
  destination jsonb;
  source_facility_id uuid;
  destination_type text;
  destination_id uuid;
  destination_start date;
  copied_date date;
  copied_workout_id uuid;
  copied_count integer := 0;
  expected_count integer;
begin
  if coalesce(cardinality(check_assignment_ids), 0) = 0 then raise exception 'Choose at least one workout assignment to copy'; end if;
  if check_source_start is null then raise exception 'Source start is required'; end if;
  if jsonb_typeof(coalesce(check_destinations, '[]'::jsonb)) <> 'array'
     or jsonb_array_length(coalesce(check_destinations, '[]'::jsonb)) = 0 then
    raise exception 'Choose at least one destination';
  end if;

  select count(distinct selected_id) into expected_count from unnest(check_assignment_ids) selected(selected_id);
  select w.facility_id into source_facility_id
  from public.workout_assignments wa join public.workouts w on w.id = wa.workout_id
  where wa.id = check_assignment_ids[1];
  if source_facility_id is null or not app_private.is_facility_coach(source_facility_id) then
    raise exception 'Not authorized to copy these workout assignments';
  end if;
  if (select count(*) from public.workout_assignments wa join public.workouts w on w.id = wa.workout_id
      where wa.id = any(check_assignment_ids) and w.facility_id = source_facility_id) <> expected_count then
    raise exception 'One or more selected workout assignments were not available';
  end if;

  for destination in select value from jsonb_array_elements(check_destinations)
  loop
    destination_type := destination->>'target_type';
    destination_id := (destination->>'target_id')::uuid;
    destination_start := (destination->>'destination_start')::date;
    if destination_type = 'group' then
      if not exists (select 1 from public.groups where id = destination_id and facility_id = source_facility_id) then
        raise exception 'Destination group is not in this facility';
      end if;
    elsif destination_type = 'member' then
      if not exists (
        select 1 from public.member_profiles mp join public.facility_members fm on fm.id = mp.facility_member_id
        where mp.id = destination_id and fm.facility_id = source_facility_id and fm.status = 'approved'
      ) then raise exception 'Destination member is not in this facility'; end if;
    else
      raise exception 'Calendar copies may target a group or member';
    end if;

    for assignment_row in
      select wa.*, w.facility_id from public.workout_assignments wa
      join public.workouts w on w.id = wa.workout_id
      where wa.id = any(check_assignment_ids)
      order by wa.assigned_date, wa.created_at, wa.id
    loop
      if assignment_row.assigned_date < check_source_start then raise exception 'The source start cannot be after a selected workout'; end if;
      copied_date := destination_start + (assignment_row.assigned_date - check_source_start);
      if exists (
        select 1 from public.workout_assignments existing
        where existing.assigned_date = copied_date
          and existing.target_type = destination_type
          and ((destination_type = 'group' and existing.target_group_id = destination_id)
            or (destination_type = 'member' and existing.target_member_profile_id = destination_id))
      ) then
        raise exception 'A destination already has a workout on %. Nothing was copied.', copied_date;
      end if;
      copied_workout_id := app_private.clone_workout_for_program(assignment_row.workout_id, auth.uid());
      insert into public.workout_assignments (
        workout_id, assigned_by, target_type, target_facility_id, target_group_id,
        target_member_profile_id, assigned_date, due_date
      ) values (
        copied_workout_id, auth.uid(), destination_type, source_facility_id,
        case when destination_type = 'group' then destination_id end,
        case when destination_type = 'member' then destination_id end,
        copied_date, copied_date
      );
      copied_count := copied_count + 1;
    end loop;
  end loop;
  return jsonb_build_object('copied_count', copied_count);
end;
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
  target_facility_id uuid;
  other_assignments integer;
begin
  select wa.* into assignment_row
  from public.workout_assignments wa
  where wa.id = check_assignment_id;
  select w.facility_id into target_facility_id
  from public.workout_assignments wa join public.workouts w on w.id = wa.workout_id
  where wa.id = check_assignment_id;
  if assignment_row.id is null or not app_private.is_facility_coach(target_facility_id) then
    raise exception 'Assignment not found or unavailable';
  end if;
  if exists (select 1 from public.exercise_set_logs where workout_assignment_id = check_assignment_id) then
    raise exception 'Started workouts cannot be unassigned or deleted';
  end if;
  if exists (select 1 from public.workout_program_launch_workouts where assignment_id = check_assignment_id) then
    raise exception 'Linked program workouts must be changed from the program';
  end if;
  select count(*) into other_assignments from public.workout_assignments
  where workout_id = assignment_row.workout_id and id <> check_assignment_id;
  delete from public.workout_assignments where id = check_assignment_id;
  if check_delete_workout then
    if other_assignments > 0 then raise exception 'Workout is still assigned elsewhere and cannot be deleted'; end if;
    delete from public.workouts where id = assignment_row.workout_id;
  end if;
end;
$$;

revoke all on function public.copy_workout_programming_assignments(uuid[], date, jsonb) from public;
revoke all on function public.remove_workout_programming_assignment(uuid, boolean) from public;
grant execute on function public.copy_workout_programming_assignments(uuid[], date, jsonb) to authenticated;
grant execute on function public.remove_workout_programming_assignment(uuid, boolean) to authenticated;
