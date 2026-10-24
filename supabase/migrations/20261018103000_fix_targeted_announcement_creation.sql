-- Make announcement creation explicitly facility-scoped and atomic. The
-- original invoker RPC could not pass the table's insert RLS policy in staging.

drop function if exists public.create_coach_announcement(
  text, text, text, text, uuid[], uuid[], timestamptz
);

create function public.create_coach_announcement(
  announcement_facility_id uuid,
  announcement_title text,
  announcement_body text,
  announcement_importance text,
  announcement_audience_type text,
  target_group_ids uuid[],
  target_member_profile_ids uuid[],
  announcement_expires_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  new_announcement_id uuid;
  clean_group_ids uuid[];
  clean_member_ids uuid[];
begin
  if not exists (
    select 1
    from public.facility_members fm
    where fm.facility_id = announcement_facility_id
      and fm.profile_id = auth.uid()
      and fm.status = 'approved'
      and fm.role in ('coach', 'admin')
  ) then
    raise exception 'Approved coach access is required for this facility';
  end if;

  clean_group_ids := array(select distinct unnest(coalesce(target_group_ids, '{}'::uuid[])));
  clean_member_ids := array(select distinct unnest(coalesce(target_member_profile_ids, '{}'::uuid[])));

  if announcement_audience_type not in ('facility', 'targeted') then
    raise exception 'Choose a valid announcement audience';
  end if;

  if announcement_importance not in ('standard', 'important') then
    raise exception 'Choose a valid announcement importance';
  end if;

  if announcement_audience_type = 'facility'
    and (cardinality(clean_group_ids) > 0 or cardinality(clean_member_ids) > 0) then
    raise exception 'Facility announcements cannot include selected recipients';
  end if;

  if announcement_audience_type = 'targeted'
    and cardinality(clean_group_ids) = 0
    and cardinality(clean_member_ids) = 0 then
    raise exception 'Choose at least one group or member';
  end if;

  if (select count(*) from public.groups g
      where g.id = any(clean_group_ids)
        and g.facility_id = announcement_facility_id)
    <> cardinality(clean_group_ids) then
    raise exception 'Every selected group must belong to the coach facility';
  end if;

  if (select count(*) from public.member_profiles mp
      where mp.id = any(clean_member_ids)
        and app_private.member_profile_facility_id(mp.id) = announcement_facility_id)
    <> cardinality(clean_member_ids) then
    raise exception 'Every selected member must belong to the coach facility';
  end if;

  insert into public.coach_announcements (
    facility_id, created_by, title, body, importance, audience_type, expires_at
  ) values (
    announcement_facility_id,
    auth.uid(),
    btrim(announcement_title),
    btrim(announcement_body),
    announcement_importance,
    announcement_audience_type,
    announcement_expires_at
  ) returning id into new_announcement_id;

  insert into public.coach_announcement_groups (announcement_id, group_id)
  select new_announcement_id, selected.group_id
  from unnest(clean_group_ids) as selected(group_id);

  insert into public.coach_announcement_members (announcement_id, member_profile_id)
  select new_announcement_id, selected.member_profile_id
  from unnest(clean_member_ids) as selected(member_profile_id);

  return new_announcement_id;
end;
$$;

revoke all on function public.create_coach_announcement(
  uuid, text, text, text, text, uuid[], uuid[], timestamptz
) from public, anon;
grant execute on function public.create_coach_announcement(
  uuid, text, text, text, text, uuid[], uuid[], timestamptz
) to authenticated;
