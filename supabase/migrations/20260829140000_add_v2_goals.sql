-- V2 Goals: fields, completion lifecycle, and creator-aware write access.

alter table public.goals
  add column if not exists timeline text not null default 'short_term',
  add column if not exists due_date date,
  add column if not exists completed_at timestamptz;

update public.goals
set status = 'completed'
where status = 'complete';

alter table public.goals
  drop constraint if exists goals_status_check,
  add constraint goals_status_check
    check (status in ('active', 'completed', 'paused')),
  add constraint goals_timeline_check
    check (timeline in ('short_term', 'medium_term', 'long_term', 'ongoing'));

update public.goals
set completed_at = coalesce(completed_at, updated_at)
where status = 'completed'
  and completed_at is null;

create or replace function app_private.enforce_goal_member_update()
returns trigger
language plpgsql
as $$
begin
  if app_private.is_facility_coach(app_private.member_profile_facility_id(old.member_profile_id)) then
    new.completed_at := case
      when new.status = 'completed' then coalesce(new.completed_at, now())
      else null
    end;
    return new;
  end if;

  if not app_private.owns_member_profile(old.member_profile_id) then
    raise exception 'Only the assigned member can update this goal';
  end if;

  if old.source = 'member' and old.created_by = auth.uid() then
    if new.member_profile_id is distinct from old.member_profile_id
      or new.created_by is distinct from old.created_by
      or new.source is distinct from old.source then
      raise exception 'A member goal cannot be reassigned or change ownership';
    end if;
  elsif new.name is distinct from old.name
    or new.description is distinct from old.description
    or new.timeline is distinct from old.timeline
    or new.current_value is distinct from old.current_value
    or new.target_value is distinct from old.target_value
    or new.unit is distinct from old.unit
    or new.due_date is distinct from old.due_date
    or new.member_profile_id is distinct from old.member_profile_id
    or new.created_by is distinct from old.created_by
    or new.source is distinct from old.source
    or new.visibility is distinct from old.visibility then
    raise exception 'Members can only update the status of coach-created goals';
  end if;

  new.completed_at := case
    when new.status = 'completed' then coalesce(old.completed_at, now())
    else null
  end;
  return new;
end;
$$;

drop trigger if exists goals_enforce_member_update on public.goals;
create trigger goals_enforce_member_update
before update on public.goals
for each row execute function app_private.enforce_goal_member_update();

drop policy if exists "goals coaches can insert facility goals" on public.goals;
drop policy if exists "goals coaches can update facility goals" on public.goals;
drop policy if exists "goals coaches can delete facility goals" on public.goals;

create policy "goals members can insert own goals"
on public.goals
for insert
to authenticated
with check (
  app_private.owns_member_profile(member_profile_id)
  and created_by = auth.uid()
  and source = 'member'
);

create policy "goals coaches can insert facility goals"
on public.goals
for insert
to authenticated
with check (
  app_private.is_facility_coach(app_private.member_profile_facility_id(member_profile_id))
  and created_by = auth.uid()
  and source = 'coach'
);

create policy "goals members can update own goals"
on public.goals
for update
to authenticated
using (app_private.owns_member_profile(member_profile_id))
with check (app_private.owns_member_profile(member_profile_id));

create policy "goals coaches can update facility goals"
on public.goals
for update
to authenticated
using (app_private.is_facility_coach(app_private.member_profile_facility_id(member_profile_id)))
with check (app_private.is_facility_coach(app_private.member_profile_facility_id(member_profile_id)));

create policy "goals members can delete own goals"
on public.goals
for delete
to authenticated
using (
  app_private.owns_member_profile(member_profile_id)
  and source = 'member'
  and created_by = auth.uid()
);

create policy "goals coaches can delete facility goals"
on public.goals
for delete
to authenticated
using (app_private.is_facility_coach(app_private.member_profile_facility_id(member_profile_id)));

create index if not exists goals_member_active_order_idx
  on public.goals(member_profile_id, status, due_date, created_at desc);