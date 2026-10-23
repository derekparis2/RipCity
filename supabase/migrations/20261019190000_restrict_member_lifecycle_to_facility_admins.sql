-- Restrict every facility membership lifecycle change to facility admins.
-- Coaches retain read access to own-facility membership rows and continue to
-- manage coaching data through the policies on member_profiles, groups, and
-- other feature tables, but can no longer change account status or role.

drop policy if exists "facility_members coaches can update non coach rows"
on public.facility_members;

comment on table public.facility_members is
  'Facility memberships and account lifecycle state. Only facility admins may update existing rows.';
