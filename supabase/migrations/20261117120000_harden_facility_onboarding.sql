-- Forward-only fixes for facility onboarding and configuration review.
begin;

-- Member signup now validates facility, program, and lifecycle through the RPC.
-- Keep coach/admin invite flows in their existing SECURITY DEFINER operations.
drop policy if exists "facility_members users can insert own pending member row"
  on public.facility_members;

-- RLS policies on modules/programs invoke this boolean helper as authenticated.
grant execute on function app_private.is_platform_owner() to authenticated;

-- Provision shared product definitions, never copy another facility's data.
create or replace function app_private.seed_facility_habit_definitions(check_facility_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- Facilities with a customized habit catalog keep their existing definitions.
  if exists (select 1 from public.habits where facility_id = check_facility_id) then
    return;
  end if;
  insert into public.habits (facility_id, name, description, points_per_day)
  select check_facility_id, definition.name, definition.description, 1
  from (values
    ('Sleep 7+ hours', 'Complete if you slept at least 7 hours.'),
    ('Training', 'Complete if you trained or completed your assigned physical work.'),
    ('Order of Environment', 'Complete if you kept your room, schedule, or environment organized.'),
    ('Skill Development', 'Complete if you worked on improving a skill.'),
    ('Relationship Building', 'Complete if you intentionally built or strengthened a relationship.'),
    ('Handling Responsibilities', 'Complete if you handled your responsibilities for the day.')
  ) as definition(name, description)
  on conflict (facility_id, name) do nothing;
end;
$$;
revoke all on function app_private.seed_facility_habit_definitions(uuid) from public, anon, authenticated;

create or replace function app_private.provision_enabled_facility_habits()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.module_key = 'habits' and new.enabled then
    perform app_private.seed_facility_habit_definitions(new.facility_id);
  end if;
  return new;
end;
$$;
revoke all on function app_private.provision_enabled_facility_habits() from public, anon, authenticated;
create trigger provision_enabled_facility_habits
  after insert or update of enabled on public.facility_modules
  for each row execute function app_private.provision_enabled_facility_habits();

-- Repair empty catalogs for facilities provisioned before this migration.
do $$
declare facility_row record;
begin
  for facility_row in
    select module.facility_id from public.facility_modules module
    join public.facilities facility on facility.id = module.facility_id
    where module.module_key = 'habits' and module.enabled and facility.status = 'active'
  loop
    perform app_private.seed_facility_habit_definitions(facility_row.facility_id);
  end loop;
end;
$$;

-- Preserve the original membership while an owner explicitly enters support.
create table app_private.platform_support_memberships (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  facility_id uuid not null references public.facilities(id) on delete cascade,
  previous_membership jsonb,
  primary key (profile_id, facility_id)
);
alter table app_private.platform_support_memberships enable row level security;
revoke all on app_private.platform_support_memberships from public, anon, authenticated;

-- Recover grants from the original entry audit, before repeated entry overwrote
-- the previous role with admin. Original audit did not capture approval metadata.
insert into app_private.platform_support_memberships (profile_id, facility_id, previous_membership)
select distinct on (event.actor_profile_id, event.facility_id)
  event.actor_profile_id, event.facility_id,
  case when event.details->>'previous_role' is null then null
       else jsonb_build_object('role', event.details->>'previous_role',
                              'status', event.details->>'previous_status') end
from app_private.platform_audit_events event
join public.facility_members fm on fm.profile_id = event.actor_profile_id
 and fm.facility_id = event.facility_id and fm.role = 'admin' and fm.status = 'approved'
where event.action = 'facility.admin_mode_entered'
order by event.actor_profile_id, event.facility_id, event.created_at;

create or replace function public.exit_platform_facility_admin()
returns integer
language plpgsql security definer set search_path = public, app_private, pg_temp as $$
declare support_row record; exited integer := 0;
begin
  if auth.uid() is null then raise exception 'Authentication required.' using errcode = '42501'; end if;
  -- Serialize simultaneous entry/exit by the same owner.
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 1711));
  for support_row in select * from app_private.platform_support_memberships
    where profile_id = auth.uid() for update
  loop
    if support_row.previous_membership is null then
      delete from public.facility_members
      where profile_id = auth.uid() and facility_id = support_row.facility_id;
    else
      update public.facility_members
      set role = support_row.previous_membership->>'role',
          status = support_row.previous_membership->>'status',
          approved_by = (support_row.previous_membership->>'approved_by')::uuid,
          approved_at = (support_row.previous_membership->>'approved_at')::timestamptz
      where profile_id = auth.uid() and facility_id = support_row.facility_id;
    end if;
    delete from app_private.platform_support_memberships
    where profile_id = auth.uid() and facility_id = support_row.facility_id;
    insert into app_private.platform_audit_events (actor_profile_id, facility_id, action, details)
    values (auth.uid(), support_row.facility_id, 'facility.admin_mode_exited',
      jsonb_build_object('previous_membership_restored', support_row.previous_membership is not null));
    exited := exited + 1;
  end loop;
  return exited;
end;
$$;
revoke all on function public.exit_platform_facility_admin() from public, anon;
grant execute on function public.exit_platform_facility_admin() to authenticated;

create or replace function public.enter_platform_facility_admin(p_facility_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, app_private, pg_temp
as $$
declare
  membership_id uuid;
  previous_membership jsonb;
  previous_role text;
  previous_status text;
begin
  if auth.uid() is null or not app_private.is_platform_owner() then
    raise exception 'Platform owner access is required.' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.facilities
    where id = p_facility_id and status = 'active'
  ) then
    raise exception 'Active facility not found.' using errcode = 'P0002';
  end if;

  perform public.exit_platform_facility_admin();
  select to_jsonb(fm) into previous_membership from public.facility_members fm
  where fm.facility_id = p_facility_id and fm.profile_id = auth.uid();
  insert into app_private.platform_support_memberships (profile_id, facility_id, previous_membership)
  values (auth.uid(), p_facility_id, previous_membership);

  select role, status
  into previous_role, previous_status
  from public.facility_members
  where facility_id = p_facility_id and profile_id = auth.uid();

  insert into public.facility_members (
    facility_id,
    profile_id,
    role,
    status,
    approved_by,
    approved_at
  ) values (
    p_facility_id,
    auth.uid(),
    'admin',
    'approved',
    auth.uid(),
    now()
  )
  on conflict (facility_id, profile_id) do update
  set role = 'admin',
      status = 'approved',
      approved_by = auth.uid(),
      approved_at = now()
  returning id into membership_id;

  insert into app_private.platform_audit_events (
    actor_profile_id,
    facility_id,
    action,
    details
  ) values (
    auth.uid(),
    p_facility_id,
    'facility.admin_mode_entered',
    jsonb_build_object(
      'membership_id', membership_id,
      'previous_role', previous_role,
      'previous_status', previous_status
    )
  );

  return membership_id;
end;
$$;

create or replace function public.create_platform_facility(
  p_name text,
  p_slug text,
  p_logo_url text,
  p_primary_color text,
  p_secondary_color text,
  p_time_zone text,
  p_terminology jsonb,
  p_modules jsonb,
  p_programs jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, app_private, pg_temp
as $$
declare
  new_facility_id uuid;
  normalized_slug text := lower(btrim(coalesce(p_slug, '')));
  result jsonb;
begin
  if auth.uid() is null or not app_private.is_platform_owner() then
    raise exception 'Platform owner access is required.' using errcode = '42501';
  end if;

  if btrim(coalesce(p_name, '')) = '' then
    raise exception 'Facility name is required.' using errcode = '22023';
  end if;

  if normalized_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    raise exception 'Facility slug must contain lowercase letters, numbers, and single hyphens only.'
      using errcode = '22023';
  end if;

  insert into public.facilities (
    name,
    slug,
    logo_url,
    primary_color,
    secondary_color,
    time_zone,
    terminology,
    updated_by
  ) values (
    btrim(p_name),
    normalized_slug,
    nullif(btrim(coalesce(p_logo_url, '')), ''),
    nullif(btrim(coalesce(p_primary_color, '')), ''),
    nullif(btrim(coalesce(p_secondary_color, '')), ''),
    p_time_zone,
    p_terminology,
    auth.uid()
  )
  returning id into new_facility_id;

  -- Reuse the existing complete validator and replacement transaction for
  -- module/program configuration.
  result := public.replace_platform_facility_configuration(
    new_facility_id,
    p_name,
    p_logo_url,
    p_primary_color,
    p_secondary_color,
    p_time_zone,
    p_terminology,
    p_modules,
    p_programs
  );

  insert into app_private.platform_audit_events (
    actor_profile_id,
    facility_id,
    action,
    details
  ) values (
    auth.uid(),
    new_facility_id,
    'facility.created',
    jsonb_build_object('name', btrim(p_name), 'slug', normalized_slug)
  );

  return result;
exception
  when unique_violation then
    raise exception 'That facility slug is already in use.' using errcode = '23505';
end;
$$;
commit;
