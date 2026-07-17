-- =====================================================
-- RIP CITY PROFILE GENDER FIELD
-- =====================================================
-- Non-destructive migration proposal. Run this in Supabase before expecting
-- profile.html to save the optional Gender dropdown.

alter table public.member_profiles
  add column if not exists gender text;

alter table public.member_profiles
  drop constraint if exists member_profiles_gender_check;

alter table public.member_profiles
  add constraint member_profiles_gender_check
  check (
    gender is null
    or gender in ('female', 'male', 'nonbinary', 'other')
  );
