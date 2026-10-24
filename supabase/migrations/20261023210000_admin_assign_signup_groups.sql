-- Athletes no longer choose their own training group during signup. A facility
-- admin selects the initial group while approving the pending membership.

drop policy if exists "groups anon can read rip city signup groups"
on public.groups;

drop policy if exists "groups pending users can read signup facility groups"
on public.groups;

drop policy if exists "group_members users can insert own signup group membership"
on public.group_members;

create or replace function app_private.require_athlete_group_for_approval()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_member_profile_id uuid;
begin
  if new.status = 'approved'
     and new.role = 'athlete'
     and (
       old.status is distinct from 'approved'
       or old.role is distinct from 'athlete'
     ) then
    select mp.id
      into target_member_profile_id
    from public.member_profiles mp
    where mp.facility_member_id = new.id
      and mp.member_type = 'athlete'
    limit 1;

    if target_member_profile_id is null then
      raise exception 'An athlete member profile is required before approval.';
    end if;

    if not exists (
      select 1
      from public.group_members gm
      join public.groups g on g.id = gm.group_id
      where gm.member_profile_id = target_member_profile_id
        and g.facility_id = new.facility_id
        and g.member_type in ('athlete', 'both')
    ) then
      raise exception 'Select an athlete training group before approval.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists require_athlete_group_before_approval
on public.facility_members;

create trigger require_athlete_group_before_approval
before update of status, role on public.facility_members
for each row
execute function app_private.require_athlete_group_for_approval();

create or replace function public.approve_pending_athlete(
  pending_facility_member_id uuid,
  initial_group_id uuid
)
returns table (
  facility_member_id uuid,
  member_profile_id uuid,
  status text,
  group_id uuid
)
language plpgsql
security definer
set search_path = public, app_private, pg_temp
as $$
declare
  target_membership public.facility_members%rowtype;
  target_member_profile public.member_profiles%rowtype;
  target_group public.groups%rowtype;
begin
  select fm.*
    into target_membership
  from public.facility_members fm
  where fm.id = pending_facility_member_id
  for update;

  if target_membership.id is null then
    raise exception 'Pending athlete membership was not found.';
  end if;

  if target_membership.role <> 'athlete'
     or target_membership.status <> 'pending' then
    raise exception 'Only a pending athlete can use this approval flow.';
  end if;

  if not app_private.is_facility_admin(target_membership.facility_id) then
    raise exception 'Only a facility administrator can approve this athlete.';
  end if;

  select mp.*
    into target_member_profile
  from public.member_profiles mp
  where mp.facility_member_id = target_membership.id
    and mp.member_type = 'athlete'
  limit 1;

  if target_member_profile.id is null then
    raise exception 'The athlete member profile was not found.';
  end if;

  select g.*
    into target_group
  from public.groups g
  where g.id = initial_group_id
    and g.facility_id = target_membership.facility_id
    and g.member_type in ('athlete', 'both')
  limit 1;

  if target_group.id is null then
    raise exception 'Select an athlete group from the same facility.';
  end if;

  insert into public.group_members (group_id, member_profile_id)
  values (target_group.id, target_member_profile.id)
  on conflict do nothing;

  update public.facility_members fm
  set status = 'approved',
      approved_by = auth.uid(),
      approved_at = now()
  where fm.id = target_membership.id;

  return query
  select
    target_membership.id,
    target_member_profile.id,
    'approved'::text,
    target_group.id;
end;
$$;

revoke all on function public.approve_pending_athlete(uuid, uuid) from public;
grant execute on function public.approve_pending_athlete(uuid, uuid) to authenticated;

comment on function public.approve_pending_athlete(uuid, uuid) is
  'Atomically assigns an initial same-facility athlete group and approves a pending athlete. Facility-admin only.';
