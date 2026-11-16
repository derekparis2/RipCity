-- Reusable multi-week workout programs.
-- Program launches clone workout templates so later edits never rewrite the
-- program definition or a previously launched schedule.

create table if not exists public.workout_programs (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.facilities(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 120),
  description text,
  duration_weeks integer not null default 1 check (duration_weeks between 1 and 52),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create table if not exists public.workout_program_items (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.workout_programs(id) on delete cascade,
  source_workout_id uuid not null references public.workouts(id) on delete restrict,
  week_number integer not null check (week_number between 1 and 52),
  day_of_week integer not null check (day_of_week between 1 and 7),
  item_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (program_id, week_number, day_of_week, item_order)
);

create table if not exists public.workout_program_launches (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.workout_programs(id) on delete restrict,
  facility_id uuid not null references public.facilities(id) on delete cascade,
  target_type text not null check (target_type in ('group', 'member')),
  target_group_id uuid references public.groups(id) on delete restrict,
  target_member_profile_id uuid references public.member_profiles(id) on delete restrict,
  start_date date not null,
  assigned_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  check (
    (target_type = 'group' and target_group_id is not null and target_member_profile_id is null)
    or
    (target_type = 'member' and target_group_id is null and target_member_profile_id is not null)
  )
);

create table if not exists public.workout_program_launch_workouts (
  launch_id uuid not null references public.workout_program_launches(id) on delete cascade,
  program_item_id uuid not null references public.workout_program_items(id) on delete cascade,
  workout_id uuid not null references public.workouts(id) on delete restrict,
  primary key (launch_id, program_item_id),
  unique (workout_id)
);

create index if not exists workout_programs_facility_idx
  on public.workout_programs(facility_id, archived_at, created_at desc);
create index if not exists workout_program_items_program_idx
  on public.workout_program_items(program_id, week_number, day_of_week, item_order);
create index if not exists workout_program_launches_facility_idx
  on public.workout_program_launches(facility_id, start_date desc);

alter table public.workout_programs enable row level security;
alter table public.workout_program_items enable row level security;
alter table public.workout_program_launches enable row level security;
alter table public.workout_program_launch_workouts enable row level security;

create policy "workout programs staff can read facility programs"
on public.workout_programs for select to authenticated
using (app_private.is_facility_coach(facility_id));

create policy "workout program items staff can read facility items"
on public.workout_program_items for select to authenticated
using (
  exists (
    select 1 from public.workout_programs wp
    where wp.id = workout_program_items.program_id
      and app_private.is_facility_coach(wp.facility_id)
  )
);

create policy "workout program launches staff can read facility launches"
on public.workout_program_launches for select to authenticated
using (app_private.is_facility_coach(facility_id));

create policy "workout program launch workouts staff can read facility rows"
on public.workout_program_launch_workouts for select to authenticated
using (
  exists (
    select 1 from public.workout_program_launches wpl
    where wpl.id = workout_program_launch_workouts.launch_id
      and app_private.is_facility_coach(wpl.facility_id)
  )
);

create or replace function app_private.clone_workout_for_program(
  check_source_workout_id uuid,
  check_created_by uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  source_row public.workouts%rowtype;
  new_workout_id uuid := gen_random_uuid();
  source_block record;
  new_block_id uuid;
begin
  select * into source_row
  from public.workouts
  where id = check_source_workout_id;

  if source_row.id is null then
    raise exception 'Source workout not found';
  end if;

  insert into public.workouts (
    id, facility_id, title, focus, description, estimated_minutes, created_by
  ) values (
    new_workout_id, source_row.facility_id, source_row.title, source_row.focus,
    source_row.description, source_row.estimated_minutes, check_created_by
  );

  for source_block in
    select * from public.workout_blocks
    where workout_id = check_source_workout_id
    order by block_order, id
  loop
    new_block_id := gen_random_uuid();
    insert into public.workout_blocks (id, workout_id, name, block_order)
    values (new_block_id, new_workout_id, source_block.name, source_block.block_order);

    insert into public.workout_exercises (
      workout_id, block_id, name, description, tempo, sets, reps, percentage,
      rest_time, video_url, coach_note, input_type, exercise_order,
      exercise_template_id, is_unilateral
    )
    select
      new_workout_id, new_block_id, name, description, tempo, sets, reps,
      percentage, rest_time, video_url, coach_note, input_type, exercise_order,
      exercise_template_id, is_unilateral
    from public.workout_exercises
    where block_id = source_block.id
    order by exercise_order, id;
  end loop;

  return new_workout_id;
end;
$$;

revoke all on function app_private.clone_workout_for_program(uuid, uuid) from public;

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
  source_facility_id uuid;
  item_week integer;
  item_day integer;
begin
  if not app_private.is_facility_coach(check_facility_id) then
    raise exception 'Not authorized to manage programs for this facility';
  end if;
  if nullif(btrim(check_name), '') is null then
    raise exception 'Program name is required';
  end if;
  if check_duration_weeks not between 1 and 52 then
    raise exception 'Program duration must be between 1 and 52 weeks';
  end if;
  if jsonb_typeof(coalesce(check_items, '[]'::jsonb)) <> 'array'
     or jsonb_array_length(coalesce(check_items, '[]'::jsonb)) = 0 then
    raise exception 'Add at least one workout to the program';
  end if;

  if check_program_id is null then
    insert into public.workout_programs (
      facility_id, name, description, duration_weeks, created_by
    ) values (
      check_facility_id, btrim(check_name), nullif(btrim(check_description), ''),
      check_duration_weeks, auth.uid()
    ) returning id into saved_program_id;
  else
    update public.workout_programs
    set name = btrim(check_name),
        description = nullif(btrim(check_description), ''),
        duration_weeks = check_duration_weeks,
        updated_at = now()
    where id = check_program_id
      and facility_id = check_facility_id
      and archived_at is null
    returning id into saved_program_id;
    if saved_program_id is null then
      raise exception 'Program not found';
    end if;
    delete from public.workout_program_items where program_id = saved_program_id;
  end if;

  for item in select value from jsonb_array_elements(check_items)
  loop
    item_week := (item->>'week_number')::integer;
    item_day := (item->>'day_of_week')::integer;
    if item_week not between 1 and check_duration_weeks or item_day not between 1 and 7 then
      raise exception 'Program item falls outside the selected duration';
    end if;
    select facility_id into source_facility_id
    from public.workouts where id = (item->>'source_workout_id')::uuid;
    if source_facility_id is distinct from check_facility_id then
      raise exception 'Program workouts must belong to the same facility';
    end if;

    insert into public.workout_program_items (
      program_id, source_workout_id, week_number, day_of_week, item_order
    ) values (
      saved_program_id, (item->>'source_workout_id')::uuid,
      item_week, item_day, coalesce((item->>'item_order')::integer, 0)
    );
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
  assignment_date date;
  target_group uuid;
  target_member uuid;
begin
  select * into program_row from public.workout_programs
  where id = check_program_id and archived_at is null;
  if program_row.id is null then raise exception 'Program not found'; end if;
  if not app_private.is_facility_coach(program_row.facility_id) then
    raise exception 'Not authorized to launch this program';
  end if;
  if check_start_date is null then raise exception 'Start date is required'; end if;
  if extract(isodow from check_start_date) <> 1 then
    raise exception 'Week 1 must start on a Monday';
  end if;

  if check_target_type = 'group' then
    select id into target_group from public.groups
    where id = check_target_id and facility_id = program_row.facility_id;
    if target_group is null then raise exception 'Group not found in this facility'; end if;
  elsif check_target_type = 'member' then
    select mp.id into target_member
    from public.member_profiles mp
    join public.facility_members fm on fm.id = mp.facility_member_id
    where mp.id = check_target_id
      and fm.facility_id = program_row.facility_id
      and fm.status = 'approved';
    if target_member is null then raise exception 'Member not found in this facility'; end if;
  else
    raise exception 'Programs may be launched to a group or individual member';
  end if;

  insert into public.workout_program_launches (
    program_id, facility_id, target_type, target_group_id,
    target_member_profile_id, start_date, assigned_by
  ) values (
    program_row.id, program_row.facility_id, check_target_type, target_group,
    target_member, check_start_date, auth.uid()
  ) returning id into launch_id;

  for item_row in
    select * from public.workout_program_items
    where program_id = program_row.id
    order by week_number, day_of_week, item_order
  loop
    new_workout_id := app_private.clone_workout_for_program(item_row.source_workout_id, auth.uid());
    assignment_date := check_start_date + (((item_row.week_number - 1) * 7) + (item_row.day_of_week - 1));

    insert into public.workout_assignments (
      workout_id, assigned_by, target_type, target_facility_id,
      target_group_id, target_member_profile_id, assigned_date, due_date
    ) values (
      new_workout_id, auth.uid(), check_target_type, program_row.facility_id,
      target_group, target_member, assignment_date, assignment_date
    );

    insert into public.workout_program_launch_workouts (launch_id, program_item_id, workout_id)
    values (launch_id, item_row.id, new_workout_id);
  end loop;

  return launch_id;
end;
$$;

create or replace function public.archive_workout_program(
  check_program_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_facility_id uuid;
begin
  select facility_id into target_facility_id
  from public.workout_programs
  where id = check_program_id and archived_at is null;

  if target_facility_id is null then
    raise exception 'Program not found';
  end if;
  if not app_private.is_facility_coach(target_facility_id) then
    raise exception 'Not authorized to archive this program';
  end if;

  update public.workout_programs
  set archived_at = now(), updated_at = now()
  where id = check_program_id;
end;
$$;

create or replace function public.copy_group_programming_week(
  check_group_id uuid,
  check_source_week_start date,
  check_destination_week_start date
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_facility_id uuid;
  assignment_row record;
  copied_workout_id uuid;
  copied_count integer := 0;
begin
  select facility_id into target_facility_id
  from public.groups
  where id = check_group_id;

  if target_facility_id is null or not app_private.is_facility_coach(target_facility_id) then
    raise exception 'Not authorized to copy programming for this group';
  end if;
  if check_source_week_start is null or check_destination_week_start is null then
    raise exception 'Source and destination weeks are required';
  end if;
  if check_source_week_start = check_destination_week_start then
    raise exception 'Choose a different destination week';
  end if;
  if extract(isodow from check_source_week_start) <> 1
     or extract(isodow from check_destination_week_start) <> 1 then
    raise exception 'Programming weeks must start on a Monday';
  end if;

  for assignment_row in
    select wa.*, w.facility_id
    from public.workout_assignments wa
    join public.workouts w on w.id = wa.workout_id
    where wa.target_type = 'group'
      and wa.target_group_id = check_group_id
      and wa.assigned_date between check_source_week_start and check_source_week_start + 6
      and w.facility_id = target_facility_id
    order by wa.assigned_date, wa.created_at, wa.id
  loop
    copied_workout_id := app_private.clone_workout_for_program(assignment_row.workout_id, auth.uid());
    insert into public.workout_assignments (
      workout_id, assigned_by, target_type, target_facility_id,
      target_group_id, target_member_profile_id, assigned_date, due_date
    ) values (
      copied_workout_id, auth.uid(), 'group', target_facility_id,
      check_group_id, null,
      check_destination_week_start + (assignment_row.assigned_date - check_source_week_start),
      check_destination_week_start + (assignment_row.assigned_date - check_source_week_start)
    );
    copied_count := copied_count + 1;
  end loop;

  if copied_count = 0 then
    raise exception 'No group workouts were found in the selected source week';
  end if;
  return copied_count;
end;
$$;

revoke all on function public.save_workout_program(uuid, uuid, text, text, integer, jsonb) from public;
revoke all on function public.launch_workout_program(uuid, text, uuid, date) from public;
revoke all on function public.archive_workout_program(uuid) from public;
revoke all on function public.copy_group_programming_week(uuid, date, date) from public;
grant execute on function public.save_workout_program(uuid, uuid, text, text, integer, jsonb) to authenticated;
grant execute on function public.launch_workout_program(uuid, text, uuid, date) to authenticated;
grant execute on function public.archive_workout_program(uuid) to authenticated;
grant execute on function public.copy_group_programming_week(uuid, date, date) to authenticated;

grant select on public.workout_programs to authenticated;
grant select on public.workout_program_items to authenticated;
grant select on public.workout_program_launches to authenticated;
grant select on public.workout_program_launch_workouts to authenticated;
