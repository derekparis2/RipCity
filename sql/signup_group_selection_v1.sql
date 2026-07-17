-- =====================================================
-- Signup group selection support
-- =====================================================
-- Purpose:
-- Allow athlete signups to choose an initial Rip City training group, then save
-- that selection into group_members while the member is still pending approval.
--
-- Safe to run after rls_policies_v1.sql.

grant select on public.groups to anon;

drop policy if exists "groups anon can read rip city signup groups" on public.groups;
drop policy if exists "groups pending users can read signup facility groups" on public.groups;
drop policy if exists "group_members users can insert own signup group membership" on public.group_members;

create policy "groups anon can read rip city signup groups"
on public.groups
for select
to anon
using (
  member_type in ('athlete', 'both')
  and exists (
    select 1
    from public.facilities f
    where f.id = groups.facility_id
      and f.slug = 'rip-city'
  )
);

create policy "groups pending users can read signup facility groups"
on public.groups
for select
to authenticated
using (
  member_type in ('athlete', 'both')
  and exists (
    select 1
    from public.facility_members fm
    where fm.facility_id = groups.facility_id
      and fm.profile_id = auth.uid()
      and fm.status = 'pending'
      and fm.role = 'athlete'
  )
);

create policy "group_members users can insert own signup group membership"
on public.group_members
for insert
to authenticated
with check (
  app_private.owns_member_profile(member_profile_id)
  and exists (
    select 1
    from public.member_profiles mp
    join public.facility_members fm on fm.id = mp.facility_member_id
    where mp.id = group_members.member_profile_id
      and fm.profile_id = auth.uid()
      and fm.status = 'pending'
      and fm.role = 'athlete'
      and mp.member_type = 'athlete'
  )
  and exists (
    select 1
    from public.groups g
    where g.id = group_members.group_id
      and g.facility_id = app_private.member_profile_facility_id(group_members.member_profile_id)
      and g.member_type in ('athlete', 'both')
  )
);
