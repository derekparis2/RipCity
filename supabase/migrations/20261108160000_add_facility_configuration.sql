begin;

-- Facility configuration is shared platform metadata. It does not grant a
-- platform owner access to facility members or activity data.
alter table public.facilities
  add column if not exists time_zone text not null default 'America/New_York',
  add column if not exists status text not null default 'active',
  add column if not exists terminology jsonb not null default jsonb_build_object(
    'member_singular', 'Member',
    'member_plural', 'Members',
    'coach_singular', 'Coach',
    'coach_plural', 'Coaches',
    'group_singular', 'Group',
    'group_plural', 'Groups'
  ),
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references public.profiles(id) on delete set null,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists updated_by uuid references public.profiles(id) on delete set null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'facilities_status_check'
  ) then
    alter table public.facilities
      add constraint facilities_status_check
      check (status in ('active', 'archived'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'facilities_terminology_object_check'
  ) then
    alter table public.facilities
      add constraint facilities_terminology_object_check
      check (jsonb_typeof(terminology) = 'object');
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'facilities_archive_state_check'
  ) then
    alter table public.facilities
      add constraint facilities_archive_state_check
      check (
        (status = 'active' and archived_at is null)
        or (status = 'archived' and archived_at is not null)
      );
  end if;
end
$$;

create table if not exists public.facility_modules (
  facility_id uuid not null references public.facilities(id) on delete cascade,
  module_key text not null,
  enabled boolean not null default true,
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null,
  primary key (facility_id, module_key),
  constraint facility_modules_key_check check (
    module_key in (
      'workouts',
      'habits',
      'goals',
      'leaderboards',
      'announcements',
      'testing_days'
    )
  ),
  constraint facility_modules_settings_object_check
    check (jsonb_typeof(settings) = 'object')
);

create table if not exists public.facility_programs (
  facility_id uuid not null references public.facilities(id) on delete cascade,
  program_key text not null,
  display_name text not null,
  plural_name text not null,
  enabled boolean not null default true,
  sort_order integer not null default 0,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null,
  primary key (facility_id, program_key),
  constraint facility_programs_key_check check (program_key in ('athlete', 'h2k')),
  constraint facility_programs_display_name_check check (btrim(display_name) <> ''),
  constraint facility_programs_plural_name_check check (btrim(plural_name) <> '')
);

create index if not exists facility_modules_enabled_idx
  on public.facility_modules (facility_id, enabled, module_key);

create index if not exists facility_programs_enabled_idx
  on public.facility_programs (facility_id, enabled, sort_order, program_key);

-- Existing facilities keep the complete shipped V2/V3 experience. A future
-- provisioning operation will insert the chosen configuration for a new
-- facility in the same transaction that creates it.
insert into public.facility_modules (facility_id, module_key, enabled)
select f.id, module.module_key, true
from public.facilities f
cross join (
  values
    ('workouts'::text),
    ('habits'::text),
    ('goals'::text),
    ('leaderboards'::text),
    ('announcements'::text),
    ('testing_days'::text)
) as module(module_key)
on conflict (facility_id, module_key) do nothing;

insert into public.facility_programs (
  facility_id,
  program_key,
  display_name,
  plural_name,
  enabled,
  sort_order
)
select
  f.id,
  program.program_key,
  program.display_name,
  program.plural_name,
  true,
  program.sort_order
from public.facilities f
cross join (
  values
    ('athlete'::text, 'Athlete'::text, 'Athletes'::text, 10),
    ('h2k'::text, 'H2K Member'::text, 'H2K Members'::text, 20)
) as program(program_key, display_name, plural_name, sort_order)
on conflict (facility_id, program_key) do nothing;

alter table public.facility_modules enable row level security;
alter table public.facility_programs enable row level security;

drop policy if exists "facility modules members can read own facility" on public.facility_modules;
create policy "facility modules members can read own facility"
on public.facility_modules
for select
to authenticated
using (
  app_private.is_approved_facility_member(facility_id)
  or app_private.is_platform_owner()
);

drop policy if exists "facility programs members can read own facility" on public.facility_programs;
create policy "facility programs members can read own facility"
on public.facility_programs
for select
to authenticated
using (
  app_private.is_approved_facility_member(facility_id)
  or app_private.is_platform_owner()
);

revoke all on table public.facility_modules from public, anon, authenticated;
revoke all on table public.facility_programs from public, anon, authenticated;
grant select on table public.facility_modules to authenticated;
grant select on table public.facility_programs to authenticated;

-- Step 1 exposed only the original facility columns. Replace that owner-only
-- directory with the configuration fields the future platform screen needs.
drop function if exists public.list_platform_facilities();

create function public.list_platform_facilities()
returns table (
  facility_id uuid,
  facility_name text,
  facility_slug text,
  logo_url text,
  primary_color text,
  secondary_color text,
  facility_time_zone text,
  facility_status text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, app_private, pg_temp
as $$
begin
  if auth.uid() is null or not app_private.is_platform_owner() then
    raise exception 'Platform owner access is required.' using errcode = '42501';
  end if;

  return query
  select
    f.id,
    f.name,
    f.slug,
    f.logo_url,
    f.primary_color,
    f.secondary_color,
    f.time_zone,
    f.status,
    f.created_at
  from public.facilities f
  order by f.name, f.created_at;
end;
$$;

revoke all on function public.list_platform_facilities() from public;
grant execute on function public.list_platform_facilities() to authenticated;

create or replace function app_private.is_valid_time_zone(candidate text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, pg_temp
as $$
  select exists (
    select 1
    from pg_catalog.pg_timezone_names
    where name = candidate
  );
$$;

revoke all on function app_private.is_valid_time_zone(text) from public, anon, authenticated;

create or replace function app_private.validate_facility_configuration()
returns trigger
language plpgsql
security definer
set search_path = public, app_private, pg_temp
as $$
declare
  required_term text;
begin
  if not app_private.is_valid_time_zone(new.time_zone) then
    raise exception 'Unknown IANA time zone: %', new.time_zone using errcode = '22023';
  end if;

  if new.primary_color is not null
     and new.primary_color !~ '^#[0-9A-Fa-f]{6}$' then
    raise exception 'Primary color must use #RRGGBB format.' using errcode = '22023';
  end if;

  if new.secondary_color is not null
     and new.secondary_color !~ '^#[0-9A-Fa-f]{6}$' then
    raise exception 'Secondary color must use #RRGGBB format.' using errcode = '22023';
  end if;

  foreach required_term in array array[
    'member_singular',
    'member_plural',
    'coach_singular',
    'coach_plural',
    'group_singular',
    'group_plural'
  ] loop
    if jsonb_typeof(new.terminology -> required_term) is distinct from 'string'
       or btrim(new.terminology ->> required_term) = '' then
      raise exception 'Facility terminology requires a non-empty % value.', required_term
        using errcode = '22023';
    end if;
  end loop;

  new.updated_at := now();
  return new;
end;
$$;

revoke all on function app_private.validate_facility_configuration() from public, anon, authenticated;

drop trigger if exists validate_facility_configuration on public.facilities;
create trigger validate_facility_configuration
before insert or update on public.facilities
for each row execute function app_private.validate_facility_configuration();

-- Configuration is now written only through the audited platform-owner RPC.
-- Facility admins retain their normal facility-management powers, but cannot
-- change platform setup metadata directly.
drop policy if exists "facilities admins can update own facility" on public.facilities;

-- The broad legacy facilities UPDATE policy predates platform ownership.
-- This trigger prevents a facility admin from changing platform-controlled
-- configuration while keeping service-role/migration maintenance possible.
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
       new.name is distinct from old.name
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

revoke all on function app_private.protect_platform_facility_configuration() from public, anon, authenticated;

drop trigger if exists protect_platform_facility_configuration on public.facilities;
create trigger protect_platform_facility_configuration
before update on public.facilities
for each row execute function app_private.protect_platform_facility_configuration();

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
          'sort_order', fp.sort_order
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

revoke all on function public.get_facility_configuration(uuid) from public;
grant execute on function public.get_facility_configuration(uuid) to authenticated;

create or replace function public.replace_platform_facility_configuration(
  p_facility_id uuid,
  p_name text,
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
  distinct_item_count integer;
  total_item_count integer;
begin
  if auth.uid() is null or not app_private.is_platform_owner() then
    raise exception 'Platform owner access is required.' using errcode = '42501';
  end if;

  if not exists (select 1 from public.facilities where id = p_facility_id) then
    raise exception 'Facility not found.' using errcode = 'P0002';
  end if;

  if btrim(coalesce(p_name, '')) = '' then
    raise exception 'Facility name is required.' using errcode = '22023';
  end if;

  if jsonb_typeof(p_modules) <> 'array' then
    raise exception 'Modules must be a JSON array.' using errcode = '22023';
  end if;

  if jsonb_typeof(p_programs) <> 'array' then
    raise exception 'Programs must be a JSON array.' using errcode = '22023';
  end if;

  select count(distinct module_key), count(*)
  into distinct_item_count, total_item_count
  from jsonb_to_recordset(p_modules) as item(module_key text, enabled boolean, settings jsonb);

  if distinct_item_count <> 6 or total_item_count <> 6 then
    raise exception 'Provide each supported module exactly once.' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_modules) as item(module_key text, enabled boolean, settings jsonb)
    where item.module_key not in (
      'workouts', 'habits', 'goals', 'leaderboards', 'announcements', 'testing_days'
    )
      or item.enabled is null
      or coalesce(jsonb_typeof(item.settings), 'object') <> 'object'
  ) then
    raise exception 'One or more module settings are invalid.' using errcode = '22023';
  end if;

  select count(distinct program_key), count(*)
  into distinct_item_count, total_item_count
  from jsonb_to_recordset(p_programs) as item(
    program_key text,
    display_name text,
    plural_name text,
    enabled boolean,
    sort_order integer
  );

  if distinct_item_count <> 2 or total_item_count <> 2 then
    raise exception 'Provide each supported member program exactly once.' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_programs) as item(
      program_key text,
      display_name text,
      plural_name text,
      enabled boolean,
      sort_order integer
    )
    where item.program_key not in ('athlete', 'h2k')
      or btrim(coalesce(item.display_name, '')) = ''
      or btrim(coalesce(item.plural_name, '')) = ''
      or item.enabled is null
      or item.sort_order is null
  ) then
    raise exception 'One or more member-program settings are invalid.' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from jsonb_to_recordset(p_programs) as item(
      program_key text,
      display_name text,
      plural_name text,
      enabled boolean,
      sort_order integer
    )
    where item.enabled = true
  ) then
    raise exception 'At least one member program must remain enabled.' using errcode = '22023';
  end if;

  update public.facilities
  set
    name = btrim(p_name),
    logo_url = nullif(btrim(coalesce(p_logo_url, '')), ''),
    primary_color = nullif(btrim(coalesce(p_primary_color, '')), ''),
    secondary_color = nullif(btrim(coalesce(p_secondary_color, '')), ''),
    time_zone = p_time_zone,
    terminology = p_terminology,
    updated_by = auth.uid()
  where id = p_facility_id;

  delete from public.facility_modules where facility_id = p_facility_id;
  insert into public.facility_modules (
    facility_id,
    module_key,
    enabled,
    settings,
    updated_by
  )
  select
    p_facility_id,
    item.module_key,
    item.enabled,
    coalesce(item.settings, '{}'::jsonb),
    auth.uid()
  from jsonb_to_recordset(p_modules) as item(module_key text, enabled boolean, settings jsonb);

  delete from public.facility_programs where facility_id = p_facility_id;
  insert into public.facility_programs (
    facility_id,
    program_key,
    display_name,
    plural_name,
    enabled,
    sort_order,
    updated_by
  )
  select
    p_facility_id,
    item.program_key,
    btrim(item.display_name),
    btrim(item.plural_name),
    item.enabled,
    item.sort_order,
    auth.uid()
  from jsonb_to_recordset(p_programs) as item(
    program_key text,
    display_name text,
    plural_name text,
    enabled boolean,
    sort_order integer
  );

  insert into app_private.platform_audit_events (
    actor_profile_id,
    facility_id,
    action,
    details
  ) values (
    auth.uid(),
    p_facility_id,
    'facility.configuration_replaced',
    jsonb_build_object(
      'time_zone', p_time_zone,
      'enabled_modules', (
        select jsonb_agg(item.module_key order by item.module_key)
        from jsonb_to_recordset(p_modules) as item(module_key text, enabled boolean)
        where item.enabled = true
      ),
      'enabled_programs', (
        select jsonb_agg(item.program_key order by item.program_key)
        from jsonb_to_recordset(p_programs) as item(program_key text, enabled boolean)
        where item.enabled = true
      )
    )
  );

  return public.get_facility_configuration(p_facility_id);
end;
$$;

revoke all on function public.replace_platform_facility_configuration(
  uuid, text, text, text, text, text, jsonb, jsonb, jsonb
) from public;
grant execute on function public.replace_platform_facility_configuration(
  uuid, text, text, text, text, text, jsonb, jsonb, jsonb
) to authenticated;

commit;
