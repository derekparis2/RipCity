-- Appearance, member-program features, and facility-admin invitations.
begin;
alter table public.facilities add column ui_theme text not null default 'midnight'
  check (ui_theme in ('midnight', 'slate', 'forest'));
alter table public.facility_programs add column module_overrides jsonb not null default '{}'::jsonb;

create or replace function app_private.valid_program_module_overrides(value jsonb)
returns boolean language plpgsql immutable set search_path = public, pg_temp as $$
begin
  if jsonb_typeof(value) is distinct from 'object' then return false; end if;
  return not exists (select 1 from jsonb_each(value) entry
    where entry.key not in ('workouts','habits','goals','leaderboards','announcements','testing_days')
      or jsonb_typeof(entry.value) <> 'boolean');
end;
$$;
revoke all on function app_private.valid_program_module_overrides(jsonb) from public, anon;
grant execute on function app_private.valid_program_module_overrides(jsonb) to authenticated;
alter table public.facility_programs add constraint valid_program_module_overrides
  check (app_private.valid_program_module_overrides(module_overrides));

create or replace function app_private.protect_platform_facility_configuration()
returns trigger
language plpgsql
security definer
set search_path = public, app_private, pg_temp
as $$
begin
  if auth.uid() is not null
     and not app_private.is_platform_owner()
     and (
       new.ui_theme is distinct from old.ui_theme
       or new.name is distinct from old.name
       or new.slug is distinct from old.slug
       or new.logo_url is distinct from old.logo_url
       or new.primary_color is distinct from old.primary_color
       or new.secondary_color is distinct from old.secondary_color
       or new.time_zone is distinct from old.time_zone
       or new.status is distinct from old.status
       or new.terminology is distinct from old.terminology
       or new.archived_at is distinct from old.archived_at
       or new.archived_by is distinct from old.archived_by
       or new.created_at is distinct from old.created_at
       or new.updated_by is distinct from old.updated_by
     ) then
    raise exception 'Platform owner access is required to configure a facility.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create or replace function public.get_facility_configuration(p_facility_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, app_private, pg_temp
as $$
declare
  result jsonb;
begin
  if auth.uid() is null or not (
    app_private.is_platform_owner()
    or app_private.is_approved_facility_member(p_facility_id)
  ) then
    raise exception 'Facility access is required.' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'id', f.id,
    'name', f.name,
    'slug', f.slug,
    'logo_url', f.logo_url,
    'primary_color', f.primary_color,
    'secondary_color', f.secondary_color,
    'time_zone', f.time_zone,
    'ui_theme', f.ui_theme,
    'status', f.status,
    'terminology', f.terminology,
    'modules', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'module_key', fm.module_key,
          'enabled', fm.enabled,
          'settings', fm.settings
        )
        order by fm.module_key
      )
      from public.facility_modules fm
      where fm.facility_id = f.id
    ), '[]'::jsonb),
    'programs', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'program_key', fp.program_key,
          'display_name', fp.display_name,
          'plural_name', fp.plural_name,
          'enabled', fp.enabled,
          'sort_order', fp.sort_order,
          'module_overrides', fp.module_overrides
        )
        order by fp.sort_order, fp.program_key
      )
      from public.facility_programs fp
      where fp.facility_id = f.id
    ), '[]'::jsonb)
  )
  into result
  from public.facilities f
  where f.id = p_facility_id;

  if result is null then
    raise exception 'Facility not found.' using errcode = 'P0002';
  end if;

  return result;
end;
$$;

create or replace function public.lookup_signup_facility(p_facility_slug text)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'facility_id', f.id,
    'facility_name', f.name,
    'facility_slug', f.slug,
    'logo_url', f.logo_url,
    'primary_color', f.primary_color,
    'secondary_color', f.secondary_color,
    'ui_theme', f.ui_theme,
    'time_zone', f.time_zone,
    'programs', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'program_key', fp.program_key,
          'display_name', fp.display_name,
          'plural_name', fp.plural_name,
          'enabled', fp.enabled,
          'sort_order', fp.sort_order
        )
        order by fp.sort_order, fp.program_key
      )
      from public.facility_programs fp
      where fp.facility_id = f.id
        and fp.enabled = true
    ), '[]'::jsonb)
  )
  from public.facilities f
  where f.slug = lower(btrim(coalesce(p_facility_slug, '')))
    and f.status = 'active'
  limit 1;
$$;

create or replace function public.lookup_coach_invite_configuration(lookup_invite_code text)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'facility_name', f.name,
    'facility_slug', f.slug,
    'logo_url', f.logo_url,
    'primary_color', f.primary_color,
    'secondary_color', f.secondary_color,
    'ui_theme', f.ui_theme,
    'expires_at', fi.expires_at
  )
  from public.facility_invites fi
  join public.facilities f on f.id = fi.facility_id
  where fi.invite_code = lookup_invite_code
    and fi.default_role = 'coach'
    and fi.active = true
    and fi.claimed_by is null
    and fi.claimed_at is null
    and fi.expires_at is not null
    and fi.expires_at > now()
    and f.status = 'active'
  limit 1;
$$;

create or replace function public.lookup_platform_admin_invite_configuration(lookup_invite_code text)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'facility_name', f.name,
    'facility_slug', f.slug,
    'logo_url', f.logo_url,
    'primary_color', f.primary_color,
    'secondary_color', f.secondary_color,
    'ui_theme', f.ui_theme,
    'expires_at', fi.expires_at
  )
  from public.facility_invites fi
  join public.facilities f on f.id = fi.facility_id
  where fi.invite_code = lookup_invite_code
    and fi.default_role = 'admin'
    and fi.active = true
    and fi.claimed_at is null
    and fi.expires_at > now()
    and f.status = 'active'
  limit 1;
$$;

create or replace function public.replace_platform_facility_configuration(p_facility_id uuid, p_name text, p_logo_url text, p_primary_color text, p_secondary_color text, p_time_zone text, p_terminology jsonb, p_modules jsonb, p_programs jsonb, p_ui_theme text)
returns jsonb language plpgsql security definer set search_path = public, app_private, pg_temp as $$
declare result jsonb; target_id uuid;
begin
  if auth.uid() is null or not app_private.is_platform_owner() then
    raise exception 'Platform owner access is required.' using errcode = '42501';
  end if;
  if p_ui_theme is null or p_ui_theme not in ('midnight','slate','forest') then
    raise exception 'Choose a supported page theme.' using errcode = '22023';
  end if;
  result := public.replace_platform_facility_configuration(p_facility_id, p_name, p_logo_url, p_primary_color, p_secondary_color, p_time_zone, p_terminology, p_modules, p_programs);
  target_id := (result->>'id')::uuid;
  update public.facilities set ui_theme = p_ui_theme where id = target_id;
  update public.facility_programs program
  set module_overrides = coalesce(item.value->'module_overrides', '{}'::jsonb)
  from jsonb_array_elements(p_programs) item(value)
  where program.facility_id = target_id and program.program_key = item.value->>'program_key';
  return public.get_facility_configuration(target_id);
end;
$$;
revoke all on function public.replace_platform_facility_configuration(uuid,text,text,text,text,text,jsonb,jsonb,jsonb,text) from public, anon;
grant execute on function public.replace_platform_facility_configuration(uuid,text,text,text,text,text,jsonb,jsonb,jsonb,text) to authenticated;

create or replace function public.create_platform_facility(p_name text, p_slug text, p_logo_url text, p_primary_color text, p_secondary_color text, p_time_zone text, p_terminology jsonb, p_modules jsonb, p_programs jsonb, p_ui_theme text)
returns jsonb language plpgsql security definer set search_path = public, app_private, pg_temp as $$
declare result jsonb; target_id uuid;
begin
  if auth.uid() is null or not app_private.is_platform_owner() then
    raise exception 'Platform owner access is required.' using errcode = '42501';
  end if;
  if p_ui_theme is null or p_ui_theme not in ('midnight','slate','forest') then
    raise exception 'Choose a supported page theme.' using errcode = '22023';
  end if;
  result := public.create_platform_facility(p_name, p_slug, p_logo_url, p_primary_color, p_secondary_color, p_time_zone, p_terminology, p_modules, p_programs);
  target_id := (result->>'id')::uuid;
  update public.facilities set ui_theme = p_ui_theme where id = target_id;
  update public.facility_programs program
  set module_overrides = coalesce(item.value->'module_overrides', '{}'::jsonb)
  from jsonb_array_elements(p_programs) item(value)
  where program.facility_id = target_id and program.program_key = item.value->>'program_key';
  return public.get_facility_configuration(target_id);
end;
$$;
revoke all on function public.create_platform_facility(text,text,text,text,text,text,jsonb,jsonb,jsonb,text) from public, anon;
grant execute on function public.create_platform_facility(text,text,text,text,text,text,jsonb,jsonb,jsonb,text) to authenticated;

create or replace function public.create_facility_admin_invite(p_facility_id uuid)
returns table (
  invite_id uuid,
  invite_code text,
  created_at timestamptz,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public, app_private, pg_temp
as $$
declare
  server_now timestamptz := statement_timestamp();
  generated_code text := 'admin-' || replace(gen_random_uuid()::text, '-', '');
begin
  if auth.uid() is null or not app_private.is_facility_admin(p_facility_id) then
    raise exception 'Approved facility admin access is required.' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.facilities f
    where f.id = p_facility_id and f.status = 'active'
  ) then
    raise exception 'An active facility is required.' using errcode = '22023';
  end if;

  return query
  insert into public.facility_invites (
    facility_id, created_by, invite_code, default_role,
    default_member_type, default_group_id, active, expires_at, created_at
  ) values (
    p_facility_id, auth.uid(), generated_code, 'admin',
    null, null, true, server_now + interval '7 days', server_now
  )
  returning facility_invites.id, facility_invites.invite_code,
    facility_invites.created_at, facility_invites.expires_at;
end;
$$;

revoke all on function public.create_facility_admin_invite(uuid) from public, anon;
grant execute on function public.create_facility_admin_invite(uuid) to authenticated;
commit;
