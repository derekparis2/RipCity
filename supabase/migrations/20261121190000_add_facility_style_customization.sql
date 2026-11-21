-- Owner-configured presentation. Existing facilities retain their current appearance.
begin;
alter table public.facilities add column if not exists appearance_settings jsonb not null default '{}'::jsonb;

create or replace function app_private.validate_facility_appearance(value jsonb)
returns boolean language plpgsql immutable set search_path=pg_catalog,pg_temp as $$
declare k text; role_name text; item jsonb; allowed text[]; arr jsonb;
begin
 if value is null or jsonb_typeof(value) <> 'object' then return false; end if;
 for k in select jsonb_object_keys(value) loop
  if k not in ('style','background','member_order','coach_order','member_hidden','coach_hidden') then return false; end if;
 end loop;
 if value ? 'style' and (jsonb_typeof(value->'style') <> 'string' or value->>'style' not in ('performance','clean','community')) then return false; end if;
 if value ? 'background' and (jsonb_typeof(value->'background') <> 'string' or value->>'background' not in ('default','light','dark')) then return false; end if;
 foreach role_name in array array['member','coach'] loop
  allowed:=case when role_name='member' then array['welcome','announcements','feedback','scores','tools'] else array['welcome','feedback','announcements','scores','attention','workouts'] end;
  foreach k in array array[role_name||'_order',role_name||'_hidden'] loop
   if not value ? k then continue; end if;
   arr:=value->k;
   if jsonb_typeof(arr) <> 'array' then return false; end if;
   for item in select jsonb_array_elements(arr) loop
    if jsonb_typeof(item) <> 'string' or not ((item#>>'{}')=any(allowed)) then return false; end if;
   end loop;
   if (select count(*)<>count(distinct e) from jsonb_array_elements_text(arr) e) then return false; end if;
   if k=role_name||'_order' and jsonb_array_length(arr)<>cardinality(allowed) then return false; end if;
  end loop;
 end loop;
 return true;
end;
$$;
alter table public.facilities add constraint facilities_appearance_settings_valid check(app_private.validate_facility_appearance(appearance_settings));

create or replace function app_private.protect_facility_appearance()
returns trigger language plpgsql security definer set search_path=public,app_private,pg_temp as $$
begin
 if ((tg_op='INSERT' and new.appearance_settings <> '{}'::jsonb)
     or (tg_op='UPDATE' and new.appearance_settings is distinct from old.appearance_settings))
    and not app_private.is_platform_owner() then
  raise exception 'Only a platform owner can change facility appearance' using errcode='42501';
 end if;
 return new;
end;
$$;
create trigger protect_facility_appearance before insert or update on public.facilities for each row execute function app_private.protect_facility_appearance();

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
    'appearance_settings', f.appearance_settings,
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
    'appearance_settings', f.appearance_settings,
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

create or replace function public.create_platform_facility(p_name text, p_slug text, p_logo_url text, p_primary_color text, p_secondary_color text, p_time_zone text, p_terminology jsonb, p_modules jsonb, p_programs jsonb, p_ui_theme text, p_dashboard_content jsonb, p_appearance_settings jsonb)
returns jsonb language plpgsql security definer set search_path=public,app_private,pg_temp as $$
declare result jsonb; target_id uuid;
begin
 if auth.uid() is null or not app_private.is_platform_owner() then raise exception 'Platform owner access required' using errcode='42501'; end if;
 if not app_private.validate_facility_appearance(p_appearance_settings) then raise exception 'Invalid facility appearance'; end if;
 result:=public.create_platform_facility(p_name,p_slug,p_logo_url,p_primary_color,p_secondary_color,p_time_zone,p_terminology,p_modules,p_programs,p_ui_theme,p_dashboard_content);
 target_id:=(result->>'id')::uuid;
 update public.facilities set appearance_settings=p_appearance_settings where id=target_id;
 insert into app_private.platform_audit_events(actor_profile_id,facility_id,action) values(auth.uid(),target_id,'facility.appearance_updated');
 return public.get_facility_configuration(target_id);
end;
$$;
revoke all on function public.create_platform_facility(text,text,text,text,text,text,jsonb,jsonb,jsonb,text,jsonb,jsonb) from public,anon;
grant execute on function public.create_platform_facility(text,text,text,text,text,text,jsonb,jsonb,jsonb,text,jsonb,jsonb) to authenticated;

create or replace function public.replace_platform_facility_configuration(p_facility_id uuid, p_name text, p_logo_url text, p_primary_color text, p_secondary_color text, p_time_zone text, p_terminology jsonb, p_modules jsonb, p_programs jsonb, p_ui_theme text, p_dashboard_content jsonb, p_appearance_settings jsonb)
returns jsonb language plpgsql security definer set search_path=public,app_private,pg_temp as $$
declare result jsonb; target_id uuid;
begin
 if auth.uid() is null or not app_private.is_platform_owner() then raise exception 'Platform owner access required' using errcode='42501'; end if;
 if not app_private.validate_facility_appearance(p_appearance_settings) then raise exception 'Invalid facility appearance'; end if;
 result:=public.replace_platform_facility_configuration(p_facility_id,p_name,p_logo_url,p_primary_color,p_secondary_color,p_time_zone,p_terminology,p_modules,p_programs,p_ui_theme,p_dashboard_content);
 target_id:=(result->>'id')::uuid;
 update public.facilities set appearance_settings=p_appearance_settings where id=target_id;
 insert into app_private.platform_audit_events(actor_profile_id,facility_id,action) values(auth.uid(),target_id,'facility.appearance_updated');
 return public.get_facility_configuration(target_id);
end;
$$;
revoke all on function public.replace_platform_facility_configuration(uuid,text,text,text,text,text,jsonb,jsonb,jsonb,text,jsonb,jsonb) from public,anon;
grant execute on function public.replace_platform_facility_configuration(uuid,text,text,text,text,text,jsonb,jsonb,jsonb,text,jsonb,jsonb) to authenticated;

commit;
