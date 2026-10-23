-- Track group ownership so ordinary coaches cannot remove groups or existing
-- group members that another coach/admin created. Facility admins retain full
-- management access. Existing seeded groups remain null-owned/admin-managed.

alter table public.groups
  add column if not exists created_by uuid references public.profiles(id) on delete set null;

create index if not exists groups_created_by_idx
  on public.groups(created_by);

drop policy if exists "groups coaches can insert facility groups" on public.groups;
drop policy if exists "groups coaches can update facility groups" on public.groups;
drop policy if exists "groups coaches can delete facility groups" on public.groups;

create policy "groups coaches can insert facility groups"
on public.groups
for insert
to authenticated
with check (
  app_private.is_facility_admin(facility_id)
  or (
    app_private.is_facility_coach(facility_id)
    and created_by = auth.uid()
  )
);

create policy "groups coaches can update owned facility groups"
on public.groups
for update
to authenticated
using (
  app_private.is_facility_admin(facility_id)
  or (
    app_private.is_facility_coach(facility_id)
    and created_by = auth.uid()
  )
)
with check (
  app_private.is_facility_admin(facility_id)
  or (
    app_private.is_facility_coach(facility_id)
    and created_by = auth.uid()
  )
);

create policy "groups coaches can delete owned facility groups"
on public.groups
for delete
to authenticated
using (
  app_private.is_facility_admin(facility_id)
  or (
    app_private.is_facility_coach(facility_id)
    and created_by = auth.uid()
  )
);

-- Updating a group_members row can move a member out of one group and into
-- another, so both the old and new group must be coach-owned (or admin-managed).
drop policy if exists "group_members coaches can update facility group memberships"
on public.group_members;
drop policy if exists "group_members coaches can delete facility group memberships"
on public.group_members;

create policy "group_members coaches can update owned group memberships"
on public.group_members
for update
to authenticated
using (
  exists (
    select 1
    from public.groups g
    where g.id = group_members.group_id
      and (
        app_private.is_facility_admin(g.facility_id)
        or (
          app_private.is_facility_coach(g.facility_id)
          and g.created_by = auth.uid()
        )
      )
  )
)
with check (
  exists (
    select 1
    from public.groups g
    where g.id = group_members.group_id
      and g.facility_id = app_private.member_profile_facility_id(group_members.member_profile_id)
      and (
        app_private.is_facility_admin(g.facility_id)
        or (
          app_private.is_facility_coach(g.facility_id)
          and g.created_by = auth.uid()
        )
      )
  )
);

create policy "group_members coaches can delete owned group memberships"
on public.group_members
for delete
to authenticated
using (
  exists (
    select 1
    from public.groups g
    where g.id = group_members.group_id
      and (
        app_private.is_facility_admin(g.facility_id)
        or (
          app_private.is_facility_coach(g.facility_id)
          and g.created_by = auth.uid()
        )
      )
  )
);

comment on column public.groups.created_by is
  'Profile that created the group. Null identifies seeded/legacy groups managed only by facility admins.';
