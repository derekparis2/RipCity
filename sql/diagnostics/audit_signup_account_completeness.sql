-- Read-only production/staging audit for interrupted member signups.
-- Run in the target Supabase SQL editor. Any returned row needs review.

select
  'auth user missing public profile' as issue,
  u.id as user_id,
  u.email,
  u.created_at
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null

union all

select
  'profile missing facility membership' as issue,
  p.id as user_id,
  p.email,
  p.created_at
from public.profiles p
left join public.facility_members fm on fm.profile_id = p.id
where fm.id is null

union all

select
  'member membership missing member profile' as issue,
  p.id as user_id,
  p.email,
  fm.created_at
from public.facility_members fm
join public.profiles p on p.id = fm.profile_id
left join public.member_profiles mp on mp.facility_member_id = fm.id
where fm.role in ('athlete', 'h2k_member')
  and mp.id is null

union all

select
  'profile missing username' as issue,
  p.id as user_id,
  p.email,
  p.created_at
from public.profiles p
where nullif(btrim(p.username), '') is null

order by created_at, email;
