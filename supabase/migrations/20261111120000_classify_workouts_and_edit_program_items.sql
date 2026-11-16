-- Keep reusable workouts separate from generated calendar/program snapshots and
-- allow a program slot to receive its own isolated workout revision.

alter table public.workouts
  add column if not exists workout_kind text not null default 'saved',
  add column if not exists source_workout_id uuid references public.workouts(id) on delete set null,
  add column if not exists updated_at timestamptz not null default now();

alter table public.workouts
  drop constraint if exists workouts_workout_kind_check;

alter table public.workouts
  add constraint workouts_workout_kind_check
  check (workout_kind in ('saved', 'program_item', 'assignment_snapshot'));

create index if not exists workouts_facility_kind_created_idx
  on public.workouts(facility_id, workout_kind, created_at desc);

update public.workouts generated
set workout_kind = 'assignment_snapshot',
    source_workout_id = coalesce(generated.source_workout_id, item.source_workout_id)
from public.workout_program_launch_workouts link
left join public.workout_program_items item on item.id = link.program_item_id
where generated.id = link.workout_id;

create or replace function app_private.classify_program_launch_workout()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  source_id uuid;
begin
  select item.source_workout_id into source_id
  from public.workout_program_items item
  where item.id = new.program_item_id;

  update public.workouts target
  set workout_kind = 'assignment_snapshot',
      source_workout_id = coalesce(target.source_workout_id, source_id),
      updated_at = now()
  where target.id = new.workout_id;
  return new;
end;
$$;

drop trigger if exists classify_program_launch_workout on public.workout_program_launch_workouts;
create trigger classify_program_launch_workout
after insert or update of program_item_id, workout_id
on public.workout_program_launch_workouts
for each row execute function app_private.classify_program_launch_workout();

create or replace function public.replace_workout_program_item_source(
  check_program_item_id uuid,
  replacement_workout_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  item_row public.workout_program_items%rowtype;
  program_row public.workout_programs%rowtype;
  replacement_row public.workouts%rowtype;
  previous_source_id uuid;
  linked_row record;
begin
  select * into item_row
  from public.workout_program_items
  where id = check_program_item_id
  for update;
  if item_row.id is null then raise exception 'Program item not found'; end if;

  select * into program_row from public.workout_programs where id = item_row.program_id;
  if program_row.id is null then raise exception 'Program not found'; end if;
  if program_row.created_by <> auth.uid()
     and not app_private.is_facility_admin(program_row.facility_id) then
    raise exception 'Only the program creator or a facility admin can edit this program workout';
  end if;

  select * into replacement_row from public.workouts where id = replacement_workout_id;
  if replacement_row.id is null then raise exception 'Replacement workout not found'; end if;
  if replacement_row.facility_id <> program_row.facility_id then
    raise exception 'Replacement workout must belong to the program facility';
  end if;
  if replacement_row.workout_kind <> 'program_item' then
    raise exception 'Replacement workout must be an isolated program workout';
  end if;

  previous_source_id := item_row.source_workout_id;
  update public.workout_program_items
  set source_workout_id = replacement_workout_id
  where id = check_program_item_id;

  for linked_row in
    select link.workout_id, link.assignment_id
    from public.workout_program_launch_workouts link
    where link.program_item_id = check_program_item_id
      and link.assigned_date >= current_date
  loop
    if linked_row.assignment_id is null or not exists (
      select 1 from public.exercise_set_logs log
      where log.workout_assignment_id = linked_row.assignment_id
    ) then
      perform app_private.refresh_program_workout(linked_row.workout_id, replacement_workout_id);
      update public.workouts
      set workout_kind = 'assignment_snapshot',
          source_workout_id = replacement_workout_id,
          updated_at = now()
      where id = linked_row.workout_id;
    end if;
  end loop;

  if previous_source_id <> replacement_workout_id
     and exists (
       select 1 from public.workouts
       where id = previous_source_id and workout_kind = 'program_item'
     )
     and not exists (
       select 1 from public.workout_program_items where source_workout_id = previous_source_id
     )
     and not exists (
       select 1 from public.workout_assignments where workout_id = previous_source_id
     ) then
    delete from public.workouts where id = previous_source_id;
  end if;
end;
$$;

revoke all on function public.replace_workout_program_item_source(uuid, uuid) from public;
grant execute on function public.replace_workout_program_item_source(uuid, uuid) to authenticated;
