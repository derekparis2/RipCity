begin;

-- Platform owners create facilities only through this atomic operation. The
-- creator receives a normal, auditable facility-admin membership; platform
-- ownership itself still does not bypass facility-scoped RLS.
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

  insert into public.facility_members (
    facility_id,
    profile_id,
    role,
    status,
    approved_by,
    approved_at
  ) values (
    new_facility_id,
    auth.uid(),
    'admin',
    'approved',
    auth.uid(),
    now()
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

revoke all on function public.create_platform_facility(
  text, text, text, text, text, text, jsonb, jsonb, jsonb
) from public;
grant execute on function public.create_platform_facility(
  text, text, text, text, text, text, jsonb, jsonb, jsonb
) to authenticated;

-- Entering admin mode is an explicit, logged membership grant. This avoids an
-- invisible support bypass while allowing Derek and Sam to support a facility
-- through exactly the same UI and RLS rules as its admins.
create or replace function public.enter_platform_facility_admin(p_facility_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, app_private, pg_temp
as $$
declare
  membership_id uuid;
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

revoke all on function public.enter_platform_facility_admin(uuid) from public;
grant execute on function public.enter_platform_facility_admin(uuid) to authenticated;

commit;
