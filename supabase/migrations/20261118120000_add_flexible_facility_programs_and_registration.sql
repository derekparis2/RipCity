-- Flexible facility programs, code registration, and configurable page content.
-- Preserves legacy profile types/roles and all existing member history.
begin;
alter table public.facility_programs drop constraint facility_programs_key_check;
alter table public.facility_programs add constraint facility_programs_key_check
 check (program_key ~ '^[a-z0-9][a-z0-9_-]{0,63}$');
alter table public.facility_programs add column profile_type text not null default 'general'
 check (profile_type in ('athlete','general'));
update public.facility_programs set profile_type = 'athlete' where program_key = 'athlete';
alter table public.facility_members add column program_key text;
update public.facility_members set program_key = case role when 'athlete' then 'athlete' when 'h2k_member' then 'h2k' end;
alter table public.facility_members add constraint facility_members_program_fkey
 foreign key(facility_id,program_key) references public.facility_programs(facility_id,program_key) on delete restrict;
alter table public.groups add column program_key text;
alter table public.groups add constraint groups_program_fkey
 foreign key(facility_id,program_key) references public.facility_programs(facility_id,program_key) on delete restrict;
create index facility_members_program_idx on public.facility_members(facility_id,program_key,status);
alter table public.facilities add column registration_code text not null
 default upper(substr(replace(gen_random_uuid()::text,'-',''),1,10)) unique;
alter table public.facilities add column dashboard_content jsonb not null default '{}'::jsonb;

create or replace function app_private.validate_dashboard_content(content jsonb)
returns boolean language plpgsql immutable set search_path = public,pg_temp as $$
begin
 if jsonb_typeof(content) is distinct from 'object' then return false; end if;
 return not exists (select 1 from jsonb_each(content) entry where
  case when entry.key in ('member_title','member_message','coach_title','coach_message')
   then jsonb_typeof(entry.value) <> 'string' or length(entry.value #>> '{}') > 500
  when entry.key in ('show_feedback','show_scores') then jsonb_typeof(entry.value) <> 'boolean'
  else true end);
end;
$$;
revoke all on function app_private.validate_dashboard_content(jsonb) from public,anon;
grant execute on function app_private.validate_dashboard_content(jsonb) to authenticated;
alter table public.facilities add constraint valid_dashboard_content check(app_private.validate_dashboard_content(dashboard_content));

-- Member programs cannot be reassigned by members, or changed to incompatible
-- legacy profile shapes. One membership contains exactly one member program.
create or replace function app_private.validate_membership_program()
returns trigger language plpgsql security definer set search_path = public,app_private,pg_temp as $$
declare shape text;
begin
 if new.role not in ('athlete','h2k_member') then
  if new.program_key is not null then raise exception 'Staff memberships do not have a member program'; end if;
  return new;
 end if;
 if new.program_key is null then new.program_key := case new.role when 'athlete' then 'athlete' else 'h2k' end; end if;
 select profile_type into shape from public.facility_programs where facility_id = new.facility_id and program_key = new.program_key;
 if shape is null then raise exception 'Member program not found'; end if;
 if tg_op='INSERT' and (shape='athlete') <> (new.role='athlete') then raise exception 'Registration details do not match the selected program'; end if;
 if tg_op = 'UPDATE' and new.program_key is distinct from old.program_key then
  if not app_private.is_facility_admin(old.facility_id) and not app_private.is_platform_owner() then
   raise exception 'Only a facility admin can change a member program' using errcode='42501';
  end if;
  if exists(select 1 from public.group_members gm join public.member_profiles mp on mp.id=gm.member_profile_id
   join public.groups g on g.id=gm.group_id where mp.facility_member_id=old.id
   and g.program_key is not null and g.program_key <> new.program_key) then
   raise exception 'Remove incompatible program groups before changing this member program';
  end if;
 end if;
 return new;
end;
$$;
revoke all on function app_private.validate_membership_program() from public,anon,authenticated;
create trigger validate_membership_program before insert or update of program_key,role,facility_id on public.facility_members
 for each row execute function app_private.validate_membership_program();

create or replace function app_private.protect_program_profile_type()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if (new.profile_type is distinct from old.profile_type or new.program_key is distinct from old.program_key)
 and exists(select 1 from public.facility_members where facility_id=old.facility_id and program_key=old.program_key) then
  raise exception 'A program with members cannot change its profile type or key';
 end if;
 return new;
end;
$$;
revoke all on function app_private.protect_program_profile_type() from public,anon,authenticated;
create trigger protect_program_profile_type before update on public.facility_programs
 for each row execute function app_private.protect_program_profile_type();

create or replace function app_private.validate_group_program_membership()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not exists(select 1 from public.groups g join public.member_profiles mp on mp.id=new.member_profile_id
  join public.facility_members fm on fm.id=mp.facility_member_id
  where g.id=new.group_id and g.facility_id=fm.facility_id
   and (g.program_key is null or g.program_key=fm.program_key)) then
  raise exception 'The group must belong to this member facility and program';
 end if;
 return new;
end;
$$;
revoke all on function app_private.validate_group_program_membership() from public,anon,authenticated;
create trigger validate_group_program_membership before insert or update on public.group_members
 for each row execute function app_private.validate_group_program_membership();

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
    'dashboard_content', f.dashboard_content,
    'registration_code', case when app_private.is_facility_coach(f.id) or app_private.is_platform_owner() then f.registration_code else null end,
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
          'profile_type', fp.profile_type,
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
          'profile_type', fp.profile_type,
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
       new.dashboard_content is distinct from old.dashboard_content
       or (new.registration_code is distinct from old.registration_code and not app_private.is_facility_admin(old.id))
       or new.ui_theme is distinct from old.ui_theme
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

  if distinct_item_count = 0 or distinct_item_count <> total_item_count then
    raise exception 'Provide at least one program, with unique stable program keys.' using errcode = '22023';
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
    where item.program_key is null or item.program_key !~ '^[a-z0-9][a-z0-9_-]{0,63}$'
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

  -- Disable omitted programs instead of deleting members' referenced records.
  update public.facility_programs set enabled=false
   where facility_id=p_facility_id and program_key not in
    (select item->>'program_key' from jsonb_array_elements(p_programs) item);
  insert into public.facility_programs(facility_id,program_key,display_name,plural_name,enabled,sort_order,updated_by,profile_type,module_overrides)
  select p_facility_id,item.program_key,btrim(item.display_name),btrim(item.plural_name),item.enabled,item.sort_order,auth.uid(),
   coalesce(item.profile_type,case item.program_key when 'athlete' then 'athlete' else 'general' end),coalesce(item.module_overrides,'{}'::jsonb)
  from jsonb_to_recordset(p_programs) item(program_key text,display_name text,plural_name text,enabled boolean,sort_order integer,profile_type text,module_overrides jsonb)
  on conflict(facility_id,program_key) do update set display_name=excluded.display_name,plural_name=excluded.plural_name,
   enabled=excluded.enabled,sort_order=excluded.sort_order,updated_by=excluded.updated_by,profile_type=excluded.profile_type,module_overrides=excluded.module_overrides;

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

create or replace function public.complete_member_signup(
  p_full_name text,
  p_username text,
  p_member_type text,
  p_sport text,
  p_position text,
  p_school text,
  p_graduation_year integer,
  p_body_weight numeric,
  p_facility_slug text default 'rip-city'
)
returns table (
  facility_member_id uuid,
  member_profile_id uuid,
  membership_status text
)
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  requester_id uuid := auth.uid();
  requester_email text;
  normalized_name text := btrim(coalesce(p_full_name, ''));
  normalized_username text := lower(btrim(trim(leading '@' from coalesce(p_username, ''))));
  normalized_facility_slug text := lower(btrim(coalesce(p_facility_slug, '')));
  target_facility_id uuid;
  expected_role text;
  selected_profile_type text;
  legacy_member_type text;
  existing_profile public.profiles%rowtype;
  target_membership public.facility_members%rowtype;
  target_member_profile public.member_profiles%rowtype;
begin
  if requester_id is null then
    raise exception 'Authentication is required to complete signup.';
  end if;

  select lower(u.email)
  into requester_email
  from auth.users u
  where u.id = requester_id;

  if requester_email is null or requester_email = '' then
    raise exception 'The authenticated account does not have an email address.';
  end if;

  if normalized_name = '' then
    raise exception 'Full name is required.';
  end if;

  if normalized_username = '' or normalized_username !~ '^[a-z0-9._-]+$' then
    raise exception 'Username may use letters, numbers, periods, underscores, and hyphens.';
  end if;

  if p_member_type is null or p_member_type !~ '^[a-z0-9][a-z0-9_-]{0,63}$' then
    raise exception 'Choose a valid member program.';
  end if;

  if p_graduation_year is not null and (p_graduation_year < 2000 or p_graduation_year > 2100) then
    raise exception 'Graduation year is outside the supported range.';
  end if;

  if p_body_weight is not null and p_body_weight <= 0 then
    raise exception 'Body weight must be greater than zero.';
  end if;

  select f.id
  into target_facility_id
  from public.facilities f
  where f.slug = normalized_facility_slug
    and f.status = 'active'
  limit 1;

  if target_facility_id is null then
    raise exception 'This facility signup link is invalid or no longer active.';
  end if;

  if not exists (
    select 1
    from public.facility_programs fp
    where fp.facility_id = target_facility_id
      and fp.program_key = p_member_type
      and fp.enabled = true
  ) then
    raise exception 'This member program is not enabled for the facility.';
  end if;

  if exists (
    select 1
    from public.profiles p
    where lower(p.username) = normalized_username
      and p.id <> requester_id
  ) then
    raise exception 'That username is already taken.';
  end if;

  select p.*
  into existing_profile
  from public.profiles p
  where p.id = requester_id;

  if existing_profile.id is null then
    insert into public.profiles (id, email, full_name, username, global_role)
    values (requester_id, requester_email, normalized_name, normalized_username, 'member');
  elsif lower(existing_profile.email) <> requester_email
     or lower(btrim(coalesce(existing_profile.username, ''))) <> normalized_username then
    raise exception 'Use the email and username already saved for this account.';
  end if;

  if exists (
    select 1
    from public.facility_members fm
    where fm.profile_id = requester_id
      and fm.facility_id <> target_facility_id
  ) then
    raise exception 'This account already belongs to another facility.';
  end if;

  select profile_type into selected_profile_type from public.facility_programs where facility_id=target_facility_id and program_key=p_member_type;
  legacy_member_type := case selected_profile_type when 'athlete' then 'athlete' else 'h2k' end;
  expected_role := case selected_profile_type when 'athlete' then 'athlete' else 'h2k_member' end;

  insert into public.facility_members (facility_id, profile_id, role, status, program_key)
  values (target_facility_id, requester_id, expected_role, 'pending', p_member_type)
  on conflict (facility_id, profile_id) do nothing;

  select fm.*
  into target_membership
  from public.facility_members fm
  where fm.facility_id = target_facility_id
    and fm.profile_id = requester_id;

  if target_membership.id is null then
    raise exception 'The facility membership could not be created.';
  end if;

  if target_membership.role <> expected_role or target_membership.program_key <> p_member_type then
    raise exception 'Use the member program already saved for this account.';
  end if;

  insert into public.member_profiles (
    facility_member_id,
    member_type,
    sport,
    age_group,
    position,
    school,
    graduation_year,
    body_weight
  )
  values (
    target_membership.id,
    legacy_member_type,
    case when legacy_member_type = 'athlete' then nullif(btrim(coalesce(p_sport, '')), '') end,
    null,
    case when legacy_member_type = 'athlete' then nullif(btrim(coalesce(p_position, '')), '') end,
    case when legacy_member_type = 'athlete' then nullif(btrim(coalesce(p_school, '')), '') end,
    p_graduation_year,
    p_body_weight
  )
  on conflict do nothing;

  select mp.*
  into target_member_profile
  from public.member_profiles mp
  where mp.facility_member_id = target_membership.id;

  if target_member_profile.id is null then
    raise exception 'The member profile could not be created.';
  end if;

  if target_member_profile.member_type <> legacy_member_type then
    raise exception 'Use the member program already saved for this account.';
  end if;

  return query
  select target_membership.id, target_member_profile.id, target_membership.status;
end;
$$;

create or replace function public.get_member_habit_leaderboard(
  metric_key text,
  scope_group_id uuid default null,
  as_of_date date default current_date
)
returns table (
  member_profile_id uuid,
  full_name text,
  profile_picture_url text,
  group_names text,
  rank bigint,
  score numeric,
  score_max numeric,
  detail_count integer,
  is_self boolean
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  requester_facility_id uuid;
  requester_member_profile_id uuid;
  requester_member_type text;
  requester_program_key text;
  current_week_start date;
  completed_weeks_start date;
  active_habit_count integer;
begin
  if metric_key not in (
    'fourWeekAverage',
    'currentWeekScore',
    'currentStreak',
    'longestStreak'
  ) then
    raise exception 'Unsupported member leaderboard metric.';
  end if;

  select fm.facility_id, mp.id, mp.member_type, fm.program_key
    into requester_facility_id, requester_member_profile_id, requester_member_type, requester_program_key
  from public.facility_members fm
  join public.member_profiles mp on mp.facility_member_id = fm.id
  where fm.profile_id = auth.uid()
    and fm.status = 'approved'
    and (
      (fm.role = 'athlete' and mp.member_type = 'athlete')
      or (fm.role = 'h2k_member' and mp.member_type = 'h2k')
    )
  limit 1;

  if requester_member_profile_id is null then
    raise exception 'An approved member program membership is required.';
  end if;

  if scope_group_id is not null and not exists (
    select 1
    from public.group_members own_group
    join public.groups g on g.id = own_group.group_id
    where own_group.member_profile_id = requester_member_profile_id
      and own_group.group_id = scope_group_id
      and g.facility_id = requester_facility_id
      and g.member_type in (requester_member_type, 'both')
  ) then
    raise exception 'Members may only view leaderboards for their own groups.';
  end if;

  current_week_start := as_of_date - (extract(isodow from as_of_date)::integer - 1);
  completed_weeks_start := current_week_start - 28;

  select count(*)::integer
    into active_habit_count
  from public.habits h
  where h.facility_id = requester_facility_id
    and h.active = true;

  active_habit_count := greatest(active_habit_count, 1);

  return query
  with eligible_members as (
    select
      mp.id,
      p.full_name,
      p.profile_picture_url,
      coalesce(string_agg(distinct g.name, ', ' order by g.name), 'No group') as group_names
    from public.member_profiles mp
    join public.facility_members fm on fm.id = mp.facility_member_id
    join public.profiles p on p.id = fm.profile_id
    left join public.group_members gm on gm.member_profile_id = mp.id
    left join public.groups g
      on g.id = gm.group_id
      and g.facility_id = requester_facility_id
    where fm.facility_id = requester_facility_id
      and fm.status = 'approved'
      and fm.program_key = requester_program_key
      and fm.role in ('athlete','h2k_member')
      and (
        scope_group_id is null
        or exists (
          select 1
          from public.group_members scoped_membership
          where scoped_membership.member_profile_id = mp.id
            and scoped_membership.group_id = scope_group_id
        )
      )
    group by mp.id, p.full_name, p.profile_picture_url
  ),
  day_scores as (
    select
      hl.member_profile_id,
      hl.log_date,
      count(distinct hl.habit_id)::integer as completed_habits,
      sum(hl.points_earned)::numeric as points
    from public.habit_logs hl
    join eligible_members em on em.id = hl.member_profile_id
    join public.habits h
      on h.id = hl.habit_id
      and h.facility_id = requester_facility_id
      and h.active = true
    where hl.completed = true
      and hl.log_date <= as_of_date
    group by hl.member_profile_id, hl.log_date
  ),
  qualified_days as (
    select
      ds.member_profile_id,
      ds.log_date,
      ds.log_date - (
        row_number() over (
          partition by ds.member_profile_id
          order by ds.log_date
        )::integer
      ) as streak_island
    from day_scores ds
    where ds.completed_habits >= 4
  ),
  streaks as (
    select
      qd.member_profile_id,
      min(qd.log_date) as start_date,
      max(qd.log_date) as end_date,
      count(*)::integer as day_count
    from qualified_days qd
    group by qd.member_profile_id, qd.streak_island
  ),
  member_metrics as (
    select
      em.id,
      em.full_name,
      em.profile_picture_url,
      em.group_names,
      case
        when coalesce(sum(ds.points) filter (
          where ds.log_date between completed_weeks_start and current_week_start - 1
        ), 0) > 0
          then round((sum(ds.points) filter (
            where ds.log_date between completed_weeks_start and current_week_start - 1
          )) / 4.0, 1)
        else null
      end as four_week_average,
      case
        when count(ds.log_date) filter (
          where ds.log_date between current_week_start and as_of_date
        ) > 0
          then coalesce(sum(ds.points) filter (
            where ds.log_date between current_week_start and as_of_date
          ), 0)
        else null
      end as current_week_score,
      count(ds.log_date) filter (
        where ds.log_date between current_week_start and as_of_date
          and ds.completed_habits >= 4
      )::integer as current_week_qualified_days,
      case
        when count(ds.log_date) > 0 then coalesce((
          select max(s.day_count)
          from streaks s
          where s.member_profile_id = em.id
            and s.end_date = case
              when exists (
                select 1
                from qualified_days today
                where today.member_profile_id = em.id
                  and today.log_date = as_of_date
              ) then as_of_date
              else as_of_date - 1
            end
        ), 0)
        else null
      end as current_streak,
      case
        when count(ds.log_date) > 0 then coalesce((
          select max(s.day_count)
          from streaks s
          where s.member_profile_id = em.id
        ), 0)
        else null
      end as longest_streak
    from eligible_members em
    left join day_scores ds on ds.member_profile_id = em.id
    group by em.id, em.full_name, em.profile_picture_url, em.group_names
  ),
  selected_scores as (
    select
      mm.*,
      case metric_key
        when 'fourWeekAverage' then mm.four_week_average
        when 'currentWeekScore' then mm.current_week_score
        when 'currentStreak' then mm.current_streak
        when 'longestStreak' then mm.longest_streak
      end::numeric as selected_score,
      case metric_key
        when 'fourWeekAverage' then (active_habit_count * 7)::numeric
        when 'currentWeekScore' then (active_habit_count * 7)::numeric
        else null
      end as selected_score_max,
      case metric_key
        when 'currentWeekScore' then mm.current_week_qualified_days
        else null
      end as selected_detail_count
    from member_metrics mm
  ),
  ranked as (
    select
      ss.*,
      case
        when ss.selected_score is null then null
        else rank() over (order by ss.selected_score desc nulls last)
      end as selected_rank
    from selected_scores ss
  )
  select
    r.id,
    r.full_name,
    r.profile_picture_url,
    r.group_names,
    r.selected_rank,
    r.selected_score,
    r.selected_score_max,
    r.selected_detail_count,
    r.id = requester_member_profile_id
  from ranked r
  where (r.selected_rank is not null and r.selected_rank <= 5)
     or r.id = requester_member_profile_id
  order by r.selected_rank asc nulls last, r.full_name asc;
end;
$$;

create or replace function public.lookup_registration_facility(p_code text)
returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
 select public.lookup_signup_facility(f.slug) from public.facilities f
 where f.registration_code=upper(regexp_replace(btrim(coalesce(p_code,'')),'[^a-zA-Z0-9]','','g')) and f.status='active' limit 1;
$$;
revoke all on function public.lookup_registration_facility(text) from public;
grant execute on function public.lookup_registration_facility(text) to anon,authenticated;

create or replace function public.rotate_facility_registration_code(p_facility_id uuid)
returns text language plpgsql security definer set search_path=public,app_private,pg_temp as $$
declare code text;
begin
 if auth.uid() is null or not (app_private.is_platform_owner() or app_private.is_facility_admin(p_facility_id)) then
  raise exception 'Facility admin access required' using errcode='42501';
 end if;
 -- The existing configuration guard is owner-only; code rotation is delegated
 -- through this narrow helper via a separate validated trigger below.
 update public.facilities set registration_code=upper(substr(replace(gen_random_uuid()::text,'-',''),1,10))
 where id=p_facility_id and status='active' returning registration_code into code;
 if code is null then raise exception 'Active facility not found'; end if;
 insert into app_private.platform_audit_events(actor_profile_id,facility_id,action) values(auth.uid(),p_facility_id,'facility.registration_code_rotated');
 return code;
end;
$$;
revoke all on function public.rotate_facility_registration_code(uuid) from public,anon;
grant execute on function public.rotate_facility_registration_code(uuid) to authenticated;

create or replace function public.replace_platform_facility_configuration(p_facility_id uuid, p_name text, p_logo_url text, p_primary_color text, p_secondary_color text, p_time_zone text, p_terminology jsonb, p_modules jsonb, p_programs jsonb, p_ui_theme text, p_dashboard_content jsonb)
returns jsonb language plpgsql security definer set search_path=public,app_private,pg_temp as $$
declare result jsonb; target_id uuid;
begin
 if auth.uid() is null or not app_private.is_platform_owner() then raise exception 'Platform owner access required' using errcode='42501'; end if;
 if not app_private.validate_dashboard_content(p_dashboard_content) then raise exception 'Invalid dashboard content'; end if;
 result:=public.replace_platform_facility_configuration(p_facility_id,p_name,p_logo_url,p_primary_color,p_secondary_color,p_time_zone,p_terminology,p_modules,p_programs,p_ui_theme);
 target_id:=(result->>'id')::uuid;
 update public.facilities set dashboard_content=p_dashboard_content where id=target_id;
 return public.get_facility_configuration(target_id);
end;
$$;
revoke all on function public.replace_platform_facility_configuration(uuid,text,text,text,text,text,jsonb,jsonb,jsonb,text,jsonb) from public,anon;
grant execute on function public.replace_platform_facility_configuration(uuid,text,text,text,text,text,jsonb,jsonb,jsonb,text,jsonb) to authenticated;

create or replace function public.create_platform_facility(p_name text, p_slug text, p_logo_url text, p_primary_color text, p_secondary_color text, p_time_zone text, p_terminology jsonb, p_modules jsonb, p_programs jsonb, p_ui_theme text, p_dashboard_content jsonb)
returns jsonb language plpgsql security definer set search_path=public,app_private,pg_temp as $$
declare result jsonb; target_id uuid;
begin
 if auth.uid() is null or not app_private.is_platform_owner() then raise exception 'Platform owner access required' using errcode='42501'; end if;
 if not app_private.validate_dashboard_content(p_dashboard_content) then raise exception 'Invalid dashboard content'; end if;
 result:=public.create_platform_facility(p_name,p_slug,p_logo_url,p_primary_color,p_secondary_color,p_time_zone,p_terminology,p_modules,p_programs,p_ui_theme);
 target_id:=(result->>'id')::uuid;
 update public.facilities set dashboard_content=p_dashboard_content where id=target_id;
 return public.get_facility_configuration(target_id);
end;
$$;
revoke all on function public.create_platform_facility(text,text,text,text,text,text,jsonb,jsonb,jsonb,text,jsonb) from public,anon;
grant execute on function public.create_platform_facility(text,text,text,text,text,text,jsonb,jsonb,jsonb,text,jsonb) to authenticated;


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
      program_key = null,
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
          program_key = support_row.previous_membership->>'program_key',
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

-- A group's programme boundary cannot be moved around existing memberships.
create or replace function app_private.protect_group_program()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if exists(select 1 from public.group_members gm join public.member_profiles mp on mp.id=gm.member_profile_id
  join public.facility_members fm on fm.id=mp.facility_member_id where gm.group_id=old.id
  and (fm.facility_id<>new.facility_id or (new.program_key is not null and fm.program_key<>new.program_key))) then
   raise exception 'Existing group members do not match the requested facility/program';
 end if;
 return new;
end;
$$;
revoke all on function app_private.protect_group_program() from public,anon,authenticated;
create trigger protect_group_program before update of facility_id,program_key on public.groups
 for each row execute function app_private.protect_group_program();

-- Code links are revalidated at submission, including forms opened before rotation.
-- Null permits existing facility-slug registration links to remain compatible.
create or replace function public.complete_member_signup(
 p_full_name text,p_username text,p_member_type text,p_sport text,p_position text,p_school text,
 p_graduation_year integer,p_body_weight numeric,p_facility_slug text,p_registration_code text
) returns table(facility_member_id uuid,member_profile_id uuid,membership_status text)
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if p_registration_code is not null then
  perform 1 from public.facilities where slug=lower(btrim(p_facility_slug)) and status='active'
   and registration_code=upper(regexp_replace(btrim(p_registration_code),'[^a-zA-Z0-9]','','g')) for share;
  if not found then raise exception 'This registration code is no longer active. Ask the facility for a current link.'; end if;
 end if;
 return query select * from public.complete_member_signup(p_full_name,p_username,p_member_type,p_sport,p_position,p_school,p_graduation_year,p_body_weight,p_facility_slug);
end;
$$;
revoke all on function public.complete_member_signup(text,text,text,text,text,text,integer,numeric,text,text) from public,anon;
grant execute on function public.complete_member_signup(text,text,text,text,text,text,integer,numeric,text,text) to authenticated;

-- Changing the member's single program preserves their profile fields and logs.
create or replace function public.change_member_facility_program(p_membership_id uuid,p_program_key text)
returns void language plpgsql security definer set search_path=public,app_private,pg_temp as $$
declare membership public.facility_members%rowtype;
begin
 select * into membership from public.facility_members where id=p_membership_id for update;
 if membership.id is null or membership.role not in ('athlete','h2k_member')
  or not app_private.is_facility_admin(membership.facility_id) then
  raise exception 'Only this facility admin can change a member program' using errcode='42501';
 end if;
 perform 1 from public.facility_programs where facility_id=membership.facility_id and program_key=p_program_key and enabled for share;
 if not found then raise exception 'Choose an enabled program from this facility'; end if;
 update public.facility_members set program_key=p_program_key where id=membership.id;
 insert into app_private.platform_audit_events(actor_profile_id,facility_id,action,details)
 values(auth.uid(),membership.facility_id,'facility.member_program_changed',jsonb_build_object('membership_id',membership.id,'from',membership.program_key,'to',p_program_key));
end;
$$;
revoke all on function public.change_member_facility_program(uuid,text) from public,anon;
grant execute on function public.change_member_facility_program(uuid,text) to authenticated;
commit;
