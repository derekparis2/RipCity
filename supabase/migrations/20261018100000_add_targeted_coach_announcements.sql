-- Targeted V2 coach announcements for facility, group, and individual audiences.

create table public.coach_announcements (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.facilities(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  importance text not null default 'standard'
    check (importance in ('standard', 'important')),
  audience_type text not null check (audience_type in ('facility', 'targeted')),
  publish_at timestamptz not null default now(),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  constraint coach_announcements_expiration_check
    check (expires_at is null or expires_at > publish_at)
);

create table public.coach_announcement_groups (
  announcement_id uuid not null references public.coach_announcements(id) on delete cascade,
  group_id uuid not null references public.groups(id) on delete cascade,
  primary key (announcement_id, group_id)
);

create table public.coach_announcement_members (
  announcement_id uuid not null references public.coach_announcements(id) on delete cascade,
  member_profile_id uuid not null references public.member_profiles(id) on delete cascade,
  primary key (announcement_id, member_profile_id)
);

create index coach_announcements_facility_publish_idx
  on public.coach_announcements(facility_id, publish_at desc);
create index coach_announcement_groups_group_idx
  on public.coach_announcement_groups(group_id, announcement_id);
create index coach_announcement_members_member_idx
  on public.coach_announcement_members(member_profile_id, announcement_id);

alter table public.coach_announcements enable row level security;
alter table public.coach_announcement_groups enable row level security;
alter table public.coach_announcement_members enable row level security;

grant select, insert, delete on public.coach_announcements to authenticated;
grant select, insert, delete on public.coach_announcement_groups to authenticated;
grant select, insert, delete on public.coach_announcement_members to authenticated;

create or replace function app_private.can_view_coach_announcement(check_announcement_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.coach_announcements announcement
    where announcement.id = check_announcement_id
      and (
        app_private.is_facility_coach(announcement.facility_id)
        or (
          app_private.is_approved_facility_member(announcement.facility_id)
          and announcement.publish_at <= now()
          and (announcement.expires_at is null or announcement.expires_at > now())
          and (
            announcement.audience_type = 'facility'
            or exists (
              select 1
              from public.coach_announcement_groups target
              where target.announcement_id = announcement.id
                and app_private.is_group_member(target.group_id)
            )
            or exists (
              select 1
              from public.coach_announcement_members target
              where target.announcement_id = announcement.id
                and app_private.owns_member_profile(target.member_profile_id)
            )
          )
        )
      )
  );
$$;

create policy "coach_announcements authorized users can read"
on public.coach_announcements
for select to authenticated
using (app_private.can_view_coach_announcement(id));

create policy "coach_announcements coaches can insert"
on public.coach_announcements
for insert to authenticated
with check (
  app_private.is_facility_coach(facility_id)
  and created_by = auth.uid()
);

create policy "coach_announcements creators and admins can delete"
on public.coach_announcements
for delete to authenticated
using (
  created_by = auth.uid()
  or app_private.is_facility_admin(facility_id)
);

create policy "coach_announcement_groups authorized users can read"
on public.coach_announcement_groups
for select to authenticated
using (app_private.can_view_coach_announcement(announcement_id));

create policy "coach_announcement_groups managers can insert"
on public.coach_announcement_groups
for insert to authenticated
with check (
  exists (
    select 1
    from public.coach_announcements announcement
    join public.groups target_group
      on target_group.id = coach_announcement_groups.group_id
    where announcement.id = coach_announcement_groups.announcement_id
      and target_group.facility_id = announcement.facility_id
      and (
        announcement.created_by = auth.uid()
        or app_private.is_facility_admin(announcement.facility_id)
      )
  )
);

create policy "coach_announcement_members authorized users can read"
on public.coach_announcement_members
for select to authenticated
using (app_private.can_view_coach_announcement(announcement_id));

create policy "coach_announcement_members managers can insert"
on public.coach_announcement_members
for insert to authenticated
with check (
  exists (
    select 1
    from public.coach_announcements announcement
    where announcement.id = coach_announcement_members.announcement_id
      and app_private.member_profile_facility_id(coach_announcement_members.member_profile_id) = announcement.facility_id
      and (
        announcement.created_by = auth.uid()
        or app_private.is_facility_admin(announcement.facility_id)
      )
  )
);

create or replace function public.create_coach_announcement(
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
set search_path = public, pg_temp
as $$
declare
  actor_facility_id uuid;
  new_announcement_id uuid;
  clean_group_ids uuid[];
  clean_member_ids uuid[];
begin
  select fm.facility_id into actor_facility_id
  from public.facility_members fm
  where fm.profile_id = auth.uid()
    and fm.status = 'approved'
    and fm.role in ('coach', 'admin')
  limit 1;

  if actor_facility_id is null then
    raise exception 'Approved coach access is required';
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

  if (select count(*) from public.groups g where g.id = any(clean_group_ids) and g.facility_id = actor_facility_id)
    <> cardinality(clean_group_ids) then
    raise exception 'Every selected group must belong to the coach facility';
  end if;

  if (select count(*) from public.member_profiles mp
      where mp.id = any(clean_member_ids)
        and app_private.member_profile_facility_id(mp.id) = actor_facility_id)
    <> cardinality(clean_member_ids) then
    raise exception 'Every selected member must belong to the coach facility';
  end if;

  insert into public.coach_announcements (
    facility_id, created_by, title, body, importance, audience_type, expires_at
  ) values (
    actor_facility_id,
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

revoke all on function public.create_coach_announcement(text, text, text, text, uuid[], uuid[], timestamptz)
  from public, anon;
grant execute on function public.create_coach_announcement(text, text, text, text, uuid[], uuid[], timestamptz)
  to authenticated;
